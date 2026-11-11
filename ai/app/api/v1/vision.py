"""I01 development integration. Production storage/queue remain separate adapters."""

import hashlib
import logging
import os
import threading
import time
from pathlib import Path, PurePosixPath

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import Field

from app.core.auth import require_internal_token
from app.core.errors import AiError
from app.core.settings import get_settings
from app.schemas.contracts import (
    AcceptedResponse,
    ApiModel,
    CameraExercise,
    VerificationMetrics,
    VisionAnalysisCallback,
    VisionAnalysisRequest,
)

router = APIRouter(tags=["vision"], dependencies=[Depends(require_internal_token)])
ENGINE = "vision-rule@0.1.0"
log = logging.getLogger(__name__)
_lock = threading.Lock()
# Process-local development ledger; no eviction to avoid accidental duplicate execution.
_jobs: dict[str, dict] = {}
_active = 0


def require_local_mode():
    if (
        get_settings().APP_ENV != "development"
        or os.getenv("VISION_ENABLE_LOCAL", "").lower() != "true"
    ):
        raise AiError(
            "AI_VISION_UNAVAILABLE",
            503,
            "로컬 영상 분석은 개발 환경에서만 활성화할 수 있습니다.",
        )


def local_file(key: str) -> Path:
    root = Path(os.getenv("VISION_LOCAL_ROOT", "samples")).resolve()
    # Reject Windows drive, UNC, traversal, alternate streams, and encoded URL inputs.
    parts = PurePosixPath(key).parts
    if (
        not parts
        or key.startswith("/")
        or "\\" in key
        or ":" in key
        or ".." in parts
        or "%" in key
    ):
        raise AiError(
            "AI_INVALID_MEDIA", 400, "samples 내부의 상대 영상 경로가 필요합니다."
        )
    path = (root / key).resolve()
    if not path.is_relative_to(root) or path.suffix.lower() not in {
        ".mp4",
        ".mov",
        ".avi",
        ".webm",
    }:
        raise AiError("AI_INVALID_MEDIA", 400, "허용되지 않는 영상 경로입니다.")
    if not path.is_file():
        raise AiError("AI_MEDIA_NOT_FOUND", 404, "영상 파일을 찾을 수 없습니다.")
    if path.stat().st_size > 100 * 1024 * 1024:
        raise AiError("AI_MEDIA_TOO_LARGE", 413, "개발 영상은 100MB 이하여야 합니다.")
    return path


def analyze_local(exercise: str, path: Path) -> dict:
    # Lazy import keeps health/schema APIs available without loading MediaPipe.
    from analyze_video import analyze

    return analyze(exercise, str(path))


def metrics_for(exercise: str, result: dict, sha: str | None = None):
    return VerificationMetrics(
        exercise_code=exercise,
        rep_count=result.get("repCount"),
        hold_seconds=result.get("holdSeconds"),
        person_detected=result.get("detectedFrames", 0) > 0,
        media_sha256=sha,
        flags=["algorithm_unverified"],
    )


def send_callback(url: str, payload: dict):
    # Exact preconfigured URL only; never follow redirects or environment proxies.
    with httpx.Client(timeout=10, follow_redirects=False, trust_env=False) as client:
        for attempt in range(3):
            try:
                response = client.post(
                    url,
                    json=payload,
                    headers={
                        "X-Internal-Token": get_settings().INTERNAL_API_TOKEN,
                    },
                )
                response.raise_for_status()
                return
            except httpx.HTTPError:
                if attempt == 2:
                    raise
                time.sleep(0.25 * (attempt + 1))


def run_job(request: VisionAnalysisRequest, path: Path):
    global _active
    callback = VisionAnalysisCallback(
        ingest_key=request.ingest_key,
        record_id=request.record_id,
        status="failed",
        engine_version=ENGINE,
    )
    try:
        digest = hashlib.sha256()
        size = 0
        with path.open("rb") as stream:
            while chunk := stream.read(1024 * 1024):
                size += len(chunk)
                if size > 100 * 1024 * 1024:
                    raise ValueError("size")
                digest.update(chunk)
        media = request.media[0]
        if (
            size != media.size_bytes
            or digest.hexdigest() != media.checksum_sha256.lower()
        ):
            callback.failure_reason = "AI_MEDIA_INTEGRITY_MISMATCH"
        else:
            result = analyze_local(request.exercise_code, path)
            callback.status = "completed"
            callback.decision = "review_required"
            callback.reason = (
                "운동 알고리즘 정확도 검증 전이므로 수동 검토가 필요합니다."
            )
            callback.metrics = metrics_for(
                request.exercise_code, result, digest.hexdigest()
            )
    except FileNotFoundError:
        callback.failure_reason = "AI_MODEL_OR_MEDIA_NOT_FOUND"
    except Exception:  # noqa: BLE001 - isolate third-party analysis and delivery failures
        callback.failure_reason = "AI_VIDEO_ANALYSIS_FAILED"
    payload = callback.model_dump(mode="json", by_alias=True)
    try:
        with _lock:
            _jobs[request.ingest_key]["callback"] = payload
        send_callback(get_settings().BACKEND_CALLBACK_URL, payload)
        with _lock:
            _jobs[request.ingest_key]["state"] = "delivered"
    except Exception:  # noqa: BLE001 - isolate third-party analysis and delivery failures
        with _lock:
            _jobs[request.ingest_key]["state"] = "callback_failed"
        log.error("Vision callback delivery failed; development ledger retains result")
    finally:
        with _lock:
            _active -= 1


@router.post("/vision/analyses", status_code=202, response_model=AcceptedResponse)
def submit(request: VisionAnalysisRequest, background: BackgroundTasks):
    global _active
    require_local_mode()
    if request.callback_url != get_settings().BACKEND_CALLBACK_URL:
        raise AiError(
            "AI_INVALID_CALLBACK", 400, "설정된 백엔드 콜백 주소만 사용할 수 있습니다."
        )
    media = request.media[0]
    if media.media_kind != "camera_video" or not media.mime_type.startswith("video/"):
        raise AiError(
            "AI_UNSUPPORTED_MEDIA", 400, "현재 구현은 운동 영상만 지원합니다."
        )
    expected_unit = "seconds" if request.exercise_code == "plank" else "reps"
    if request.target_unit != expected_unit:
        raise AiError("AI_INVALID_TARGET", 400, "운동과 목표 단위가 맞지 않습니다.")
    fingerprint = hashlib.sha256(
        request.model_dump_json(by_alias=True).encode()
    ).hexdigest()
    with _lock:
        existing = _jobs.get(request.ingest_key)
        if existing:
            if existing["fingerprint"] != fingerprint:
                raise AiError(
                    "AI_INGEST_CONFLICT", 409, "동일 ingestKey의 요청 내용이 다릅니다."
                )
            return AcceptedResponse(ingest_key=request.ingest_key)
        if _active >= get_settings().MAX_CONCURRENT_ANALYSES or len(_jobs) >= 1000:
            raise AiError("AI_VISION_BUSY", 503, "개발 분석 용량이 가득 찼습니다.")
        path = local_file(media.object_key)
        _jobs[request.ingest_key] = {"fingerprint": fingerprint, "state": "accepted"}
        _active += 1
    background.add_task(run_job, request, path)
    return AcceptedResponse(ingest_key=request.ingest_key)


class LocalVideoRequest(ApiModel):
    exercise_code: CameraExercise
    video_file: str = Field(min_length=1)


@router.post("/dev/vision/local-video")
def test_local_video(request: LocalVideoRequest):
    """Synchronous, no callback, no R2 access. Development smoke test only."""
    global _active
    require_local_mode()
    path = local_file(request.video_file)
    with _lock:
        if _active >= get_settings().MAX_CONCURRENT_ANALYSES:
            raise AiError("AI_VISION_BUSY", 503, "개발 분석 용량이 가득 찼습니다.")
        _active += 1
    try:
        result = analyze_local(request.exercise_code, path)
        return {
            "decision": "review_required",
            "engineVersion": ENGINE,
            "metrics": metrics_for(request.exercise_code, result).model_dump(
                by_alias=True
            ),
            "validationStatus": "unverified",
        }
    except FileNotFoundError:
        raise AiError(
            "AI_MODEL_OR_MEDIA_NOT_FOUND", 503, "모델 또는 영상 파일을 확인해 주세요."
        ) from None
    except Exception:  # noqa: BLE001 - isolate third-party analysis and delivery failures
        raise AiError(
            "AI_VIDEO_ANALYSIS_FAILED", 422, "영상을 분석할 수 없습니다."
        ) from None
    finally:
        with _lock:
            _active -= 1
