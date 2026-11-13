"""R2(S3 호환, 로컬 MinIO 포함)에서 인증 영상 내려받기.

- 객체 키는 백엔드가 요청에 담아 준 `media.objectKey`를 그대로 쓴다 (접두어 포함).
- 임시 파일로 스트리밍하며 크기 상한을 넘으면 중단한다. 무결성(크기·sha256)은 호출한 쪽이 검증한다.
"""

import tempfile
from pathlib import Path, PurePosixPath

from app.core.errors import AiError
from app.core.settings import get_settings

ALLOWED_SUFFIXES = {".mp4", ".mov", ".avi", ".webm"}
CHUNK = 1024 * 1024


def check_object_key(key: str) -> str:
    """경로 조작·드라이브·인코딩 입력을 거부하고, 영상 확장자만 허용한다."""
    parts = PurePosixPath(key).parts
    if (
        not parts
        or key.startswith("/")
        or "\\" in key
        or ".." in parts
        or "%" in key
        or PurePosixPath(key).suffix.lower() not in ALLOWED_SUFFIXES
    ):
        raise AiError("AI_INVALID_MEDIA", 400, "허용되지 않는 영상 객체 키입니다.")
    return key


def endpoint_url() -> str | None:
    settings = get_settings()
    if settings.R2_ENDPOINT:
        return settings.R2_ENDPOINT
    if settings.R2_ACCOUNT_ID:
        return f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    return None


def client():
    # boto3는 R2를 쓸 때만 불러온다 (헬스·스키마 API는 의존성 없이 뜨도록)
    import boto3
    from botocore.config import Config

    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url(),
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            retries={"max_attempts": 3, "mode": "standard"},
            connect_timeout=5,
            read_timeout=30,
        ),
    )


def download(key: str, max_bytes: int) -> Path:
    """객체를 임시 파일로 내려받아 경로를 돌려준다. 호출한 쪽이 삭제한다."""
    from botocore.exceptions import ClientError

    check_object_key(key)
    suffix = PurePosixPath(key).suffix.lower()
    handle = tempfile.NamedTemporaryFile(prefix="vision-", suffix=suffix, delete=False)
    path = Path(handle.name)
    try:
        with handle:
            try:
                body = client().get_object(Bucket=get_settings().R2_BUCKET, Key=key)
            except ClientError as error:
                code = error.response.get("Error", {}).get("Code", "")
                if code in {"NoSuchKey", "404", "NotFound"}:
                    raise AiError(
                        "AI_MEDIA_NOT_FOUND", 404, "영상 객체를 찾을 수 없습니다."
                    ) from error
                raise
            size = 0
            for chunk in body["Body"].iter_chunks(CHUNK):
                size += len(chunk)
                if size > max_bytes:
                    raise AiError(
                        "AI_MEDIA_TOO_LARGE", 413, "영상이 허용 크기를 넘었습니다."
                    )
                handle.write(chunk)
        return path
    except BaseException:
        path.unlink(missing_ok=True)
        raise
