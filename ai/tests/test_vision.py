import hashlib
from tests.conftest import new_id

import pytest
from app.api.v1 import vision
from app.core.settings import get_settings
from app.main import create_app
from fastapi.testclient import TestClient

HEADERS = {"X-Internal-Token": "dev-internal-token"}


@pytest.fixture
def setup(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("VISION_ENABLE_LOCAL", "true")
    monkeypatch.setenv("VISION_LOCAL_ROOT", str(tmp_path))
    monkeypatch.setenv("VISION_ENGINE", "fixed")
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    monkeypatch.setenv("INTERNAL_API_TOKEN", "dev-internal-token")
    monkeypatch.setenv(
        "BACKEND_CALLBACK_URL", "http://localhost:3000/internal/v1/ai-callbacks"
    )
    get_settings.cache_clear()
    vision._jobs.clear()
    vision._active = 0
    (tmp_path / "clip.mp4").write_bytes(b"test-video")
    calls = []
    monkeypatch.setattr(
        vision, "send_callback", lambda url, payload: calls.append(payload)
    )
    monkeypatch.setattr(
        vision,
        "analyze_local",
        lambda exercise, path: {
            "repCount": 3,
            "holdSeconds": 2.5,
            "detectedFrames": 10,
        },
    )
    with TestClient(create_app()) as client:
        yield client, calls
    get_settings.cache_clear()


def request_data(exercise="squat"):
    record = new_id()
    return {
        "ingestKey": f"vision:{record}:1",
        "recordId": record,
        "missionId": new_id(),
        "submissionNo": 1,
        "categoryCode": "exercise",
        "exerciseCode": exercise,
        "targetValue": 3,
        "targetUnit": "seconds" if exercise == "plank" else "reps",
        "media": [
            {
                "mediaId": new_id(),
                "objectKey": "clip.mp4",
                "mimeType": "video/mp4",
                "mediaKind": "camera_video",
                "sizeBytes": 10,
                "checksumSha256": hashlib.sha256(b"test-video").hexdigest(),
            }
        ],
        "recordStartedAt": "2026-11-06T10:00:00Z",
        "submittedAt": "2026-11-06T10:01:00Z",
        "duplicateOfMediaId": None,
        "criteria": {"versionId": new_id(), "rules": {}},
        "callbackUrl": "http://localhost:3000/internal/v1/ai-callbacks",
    }


@pytest.mark.parametrize("exercise", ["squat", "push_up", "lunge", "plank", "burpee"])
def test_i01_contract_and_dedup(setup, exercise):
    client, calls = setup
    data = request_data(exercise)
    response = client.post("/internal/v1/vision/analyses", headers=HEADERS, json=data)
    assert response.status_code == 202
    assert response.json() == {"ingestKey": data["ingestKey"], "status": "accepted"}
    assert calls[0]["status"] == "completed"
    assert calls[0]["decision"] == "review_required"
    assert calls[0]["metrics"]["exerciseCode"] == exercise
    assert (
        client.post(
            "/internal/v1/vision/analyses", headers=HEADERS, json=data
        ).status_code
        == 202
    )
    assert len(calls) == 1
    data["targetValue"] = 9
    assert (
        client.post(
            "/internal/v1/vision/analyses", headers=HEADERS, json=data
        ).status_code
        == 409
    )


@pytest.mark.parametrize(
    "path", ["../secret.mp4", "C:/secret.mp4", "\\\\host\\clip.mp4", "/secret.mp4"]
)
def test_path_escape(setup, path):
    client, _ = setup
    response = client.post(
        "/internal/v1/dev/vision/local-video",
        headers=HEADERS,
        json={"exerciseCode": "squat", "videoFile": path},
    )
    assert response.status_code == 400


def test_auth_schema_and_missing_file(setup):
    client, _ = setup
    endpoint = "/internal/v1/dev/vision/local-video"
    assert (
        client.post(
            endpoint, json={"exerciseCode": "squat", "videoFile": "clip.mp4"}
        ).status_code
        == 401
    )
    assert (
        client.post(
            endpoint,
            headers=HEADERS,
            json={"exerciseCode": "running", "videoFile": "clip.mp4"},
        ).status_code
        == 400
    )
    assert (
        client.post(
            endpoint,
            headers=HEADERS,
            json={"exerciseCode": "squat", "videoFile": "missing.mp4"},
        ).status_code
        == 404
    )


def test_disabled_and_production(setup, monkeypatch):
    client, _ = setup
    monkeypatch.setenv("VISION_ENABLE_LOCAL", "false")
    assert (
        client.post(
            "/internal/v1/vision/analyses", headers=HEADERS, json=request_data()
        ).status_code
        == 503
    )
    monkeypatch.setenv("VISION_ENABLE_LOCAL", "true")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("INTERNAL_API_TOKEN", "production-test-token")
    get_settings.cache_clear()
    assert (
        client.post(
            "/internal/v1/vision/analyses",
            headers={"X-Internal-Token": "production-test-token"},
            json=request_data(),
        ).status_code
        == 503
    )


def test_integrity_and_failure_callback(setup, monkeypatch):
    client, calls = setup
    data = request_data()
    data["media"][0]["checksumSha256"] = "0" * 64
    client.post("/internal/v1/vision/analyses", headers=HEADERS, json=data)
    assert calls[-1]["failureReason"] == "AI_MEDIA_INTEGRITY_MISMATCH"

    def fail(*args):
        raise RuntimeError("private path and secret")

    monkeypatch.setattr(vision, "analyze_local", fail)
    client.post("/internal/v1/vision/analyses", headers=HEADERS, json=request_data())
    assert calls[-1]["failureReason"] == "AI_VIDEO_ANALYSIS_FAILED"
    assert "private" not in str(calls[-1])


def test_bad_callback_unit_and_capacity(setup):
    client, _ = setup
    data = request_data()
    data["callbackUrl"] = "http://attacker.invalid/"
    assert (
        client.post(
            "/internal/v1/vision/analyses", headers=HEADERS, json=data
        ).status_code
        == 400
    )
    data = request_data()
    data["targetUnit"] = "seconds"
    assert (
        client.post(
            "/internal/v1/vision/analyses", headers=HEADERS, json=data
        ).status_code
        == 400
    )
    vision._active = 999
    assert (
        client.post(
            "/internal/v1/vision/analyses", headers=HEADERS, json=request_data()
        ).status_code
        == 503
    )
    vision._active = 0


def test_callback_failure_is_retained(setup, monkeypatch):
    client, _ = setup

    def fail(*args):
        raise RuntimeError("backend down")

    monkeypatch.setattr(vision, "send_callback", fail)
    data = request_data()
    assert (
        client.post(
            "/internal/v1/vision/analyses", headers=HEADERS, json=data
        ).status_code
        == 202
    )
    assert vision._jobs[data["ingestKey"]]["state"] == "callback_failed"
    assert vision._active == 0


def test_callback_retries_without_redirects(monkeypatch):
    attempts = []

    def handler(request):
        attempts.append(request)
        return vision.httpx.Response(503 if len(attempts) < 3 else 200)

    real_client = vision.httpx.Client
    monkeypatch.setattr(
        vision.httpx,
        "Client",
        lambda **kwargs: real_client(
            transport=vision.httpx.MockTransport(handler), **kwargs
        ),
    )
    monkeypatch.setattr(vision.time, "sleep", lambda _: None)
    vision.send_callback("http://localhost/callback", {"status": "failed"})
    assert len(attempts) == 3


def test_acceptance_schedules_without_running_analysis(setup):
    from app.schemas.contracts import VisionAnalysisRequest
    from fastapi import BackgroundTasks

    _, calls = setup
    tasks = BackgroundTasks()
    data = VisionAnalysisRequest.model_validate(request_data())
    response = vision.submit(data, tasks)
    assert response.status == "accepted"
    assert calls == []
    assert len(tasks.tasks) == 1
    assert vision._jobs[data.ingest_key]["state"] == "accepted"
    vision._active = 0


def test_adapter_calls_existing_analyzer(monkeypatch):
    import sys
    from pathlib import Path
    from types import SimpleNamespace

    received = []
    monkeypatch.setitem(
        sys.modules,
        "analyze_video",
        SimpleNamespace(
            analyze=lambda exercise, path: (
                received.append((exercise, path)) or {"repCount": 7}
            ),
        ),
    )
    result = vision.analyze_local("push_up", Path("samples/clip.mp4"))
    assert received == [("push_up", str(Path("samples/clip.mp4")))]
    assert result["repCount"] == 7
