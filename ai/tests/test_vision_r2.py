"""VISION_MEDIA_SOURCE=r2: 영상을 R2(MinIO)에서 내려받아 판정한다 (저장소는 가짜로 대체)."""

import hashlib
import io
from pathlib import Path
from uuid import uuid4

import pytest
from app.api.v1 import vision
from app.core.settings import get_settings
from app.main import create_app
from app.storage import r2
from botocore.exceptions import ClientError
from fastapi.testclient import TestClient

HEADERS = {"X-Internal-Token": "dev-internal-token-changed"}
VIDEO = b"r2-test-video"
KEY = "dev/records/clip.mp4"


class FakeBody:
    def __init__(self, data: bytes):
        self.stream = io.BytesIO(data)

    def iter_chunks(self, size):
        while chunk := self.stream.read(size):
            yield chunk


class FakeS3:
    def __init__(self, objects: dict[str, bytes]):
        self.objects = objects
        self.requested: list[tuple[str, str]] = []

    def get_object(self, Bucket, Key):  # noqa: N803 - boto3 인자 이름
        self.requested.append((Bucket, Key))
        if Key not in self.objects:
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")
        return {"Body": FakeBody(self.objects[Key])}


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")  # 로컬 모드 제한 없이 동작해야 함
    monkeypatch.setenv("INTERNAL_API_TOKEN", "dev-internal-token-changed")
    monkeypatch.setenv("VISION_MEDIA_SOURCE", "r2")
    monkeypatch.setenv("VISION_ENGINE", "fixed")
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    monkeypatch.setenv("R2_BUCKET", "dworld-test")
    monkeypatch.setenv(
        "BACKEND_CALLBACK_URL", "http://localhost:3000/internal/v1/ai-callbacks"
    )
    get_settings.cache_clear()
    vision._jobs.clear()
    vision._active = 0
    s3 = FakeS3({KEY: VIDEO})
    monkeypatch.setattr(r2, "client", lambda: s3)
    calls = []
    monkeypatch.setattr(vision, "send_callback", lambda url, payload: calls.append(payload))
    analyzed = []

    def fake_analyze(exercise, path):
        analyzed.append(Path(path).read_bytes())  # 내려받은 임시 파일의 내용
        analyzed.append(Path(path))
        return {"repCount": 3, "holdSeconds": 2.5, "detectedFrames": 10}

    monkeypatch.setattr(vision, "analyze_local", fake_analyze)
    with TestClient(create_app()) as client:
        yield client, calls, s3, analyzed
    get_settings.cache_clear()


def body(key=KEY, data=VIDEO, exercise="squat"):
    record = str(uuid4())
    return {
        "ingestKey": f"vision:{record}:1",
        "recordId": record,
        "missionId": str(uuid4()),
        "submissionNo": 1,
        "categoryCode": "exercise",
        "exerciseCode": exercise,
        "targetValue": 3,
        "targetUnit": "reps",
        "media": [
            {
                "mediaId": str(uuid4()),
                "objectKey": key,
                "mimeType": "video/mp4",
                "mediaKind": "camera_video",
                "sizeBytes": len(data),
                "checksumSha256": hashlib.sha256(data).hexdigest(),
            }
        ],
        "recordStartedAt": "2026-11-06T10:00:00Z",
        "submittedAt": "2026-11-06T10:01:00Z",
        "duplicateOfMediaId": None,
        "criteria": {"versionId": str(uuid4()), "rules": {}},
        "callbackUrl": "http://localhost:3000/internal/v1/ai-callbacks",
    }


def submit(client, data):
    return client.post("/internal/v1/vision/analyses", headers=HEADERS, json=data)


def test_downloads_from_r2_analyzes_and_cleans_up(setup):
    client, calls, s3, analyzed = setup
    assert submit(client, body()).status_code == 202
    assert s3.requested == [("dworld-test", KEY)]
    assert calls[0]["status"] == "completed"
    assert calls[0]["metrics"]["mediaSha256"] == hashlib.sha256(VIDEO).hexdigest()
    content, temp_path = analyzed
    assert content == VIDEO
    assert not temp_path.exists()  # 임시 파일은 지움


def test_missing_object_reports_failure(setup):
    client, calls, _, _ = setup
    assert submit(client, body(key="dev/records/none.mp4")).status_code == 202
    assert calls[0]["status"] == "failed"
    assert calls[0]["failureReason"] == "AI_MEDIA_NOT_FOUND"


def test_integrity_mismatch_reports_failure(setup):
    client, calls, s3, analyzed = setup
    data = body()
    data["media"][0]["checksumSha256"] = hashlib.sha256(b"other").hexdigest()
    assert submit(client, data).status_code == 202
    assert calls[0]["failureReason"] == "AI_MEDIA_INTEGRITY_MISMATCH"
    assert analyzed == []


def test_too_large_object_reports_failure(setup, monkeypatch):
    client, calls, _, _ = setup
    monkeypatch.setattr(vision, "MAX_MEDIA_BYTES", 4)
    assert submit(client, body()).status_code == 202
    assert calls[0]["failureReason"] == "AI_MEDIA_TOO_LARGE"


@pytest.mark.parametrize(
    "key",
    ["../secret.mp4", "/secret.mp4", "a\\b.mp4", "dev/%2e%2e/x.mp4", "dev/clip.txt"],
)
def test_rejects_unsafe_object_keys(setup, key):
    client, calls, s3, _ = setup
    assert submit(client, body(key=key)).status_code == 400
    assert s3.requested == []
    assert calls == []
