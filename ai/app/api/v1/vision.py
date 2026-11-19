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
from app.core.job_ledger import JobLedger
from app.core.settings import get_settings
from app.schemas.contracts import (
    AcceptedResponse,
    ApiModel,
    CameraExercise,
    PoseIssue,
    VerificationMetrics,
    VisionAnalysisCallback,
    VisionAnalysisRequest,
)
from app.storage import r2
from app.vision.coaching import coaching_tips
from app.vision.decision import Judgement, judge
from app.vision.feedback import build_feedback
from app.vision.media_registry import get_registry

router = APIRouter(tags=["vision"], dependencies=[Depends(require_internal_token)])
ENGINE = "vision-rule@0.1.0"
log = logging.getLogger(__name__)
_lock = threading.Lock()  # _active 보호
# 접수 기록(멱등). 끝난 작업은 시간이 지나거나 가득 차면 지운다 (app/core/job_ledger.py)
_jobs = JobLedger()
_active = 0
# 백엔드 업로드 상한(150MB)보다 약간 크게: 최대 10분 영상
MAX_MEDIA_BYTES = 160 * 1024 * 1024


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
    if path.stat().st_size > MAX_MEDIA_BYTES:
        raise AiError("AI_MEDIA_TOO_LARGE", 413, "개발 영상은 160MB 이하여야 합니다.")
    return path


def analyze_local(exercise: str, path: Path) -> dict:
    # Lazy import keeps health/schema APIs available without loading MediaPipe.
    from analyze_video import analyze

    return analyze(exercise, str(path))


def metrics_for(
    exercise: str,
    result: dict,
    sha: str | None = None,
    flags: list[str] | None = None,
    coaching: tuple[list[str], str] | None = None,
):
    _, issues = build_feedback(result.get("events"))
    rep_count = result.get("repCount")
    invalid = [i for i in issues if not i["code"].startswith("plank_")]
    return VerificationMetrics(
        exercise_code=exercise,
        rep_count=rep_count,
        # 기준을 채워 센 동작 / 시도했지만 기준에 못 미친 동작
        valid_rep_count=rep_count,
        invalid_rep_count=len(invalid) if rep_count is not None else None,
        hold_seconds=result.get("holdSeconds"),
        duration_seconds=result.get("durationSeconds"),
        person_detected=result.get("detectedFrames", 0) > 0,
        media_sha256=sha,
        flags=["algorithm_unverified", *(flags or [])],
        issues=[
            PoseIssue(code=i["code"], start_sec=i["startSec"], end_sec=i["endSec"])
            for i in issues[:50]
        ],
        coaching_tips=coaching[0] if coaching else [],
        coaching_source=coaching[1] if coaching and coaching[0] else None,
    )


def judgement_for(
    request: VisionAnalysisRequest, result: dict, duplicate_of: str | None = None
) -> Judgement:
    elapsed = (request.submitted_at - request.record_started_at).total_seconds()
    if not get_settings().VISION_AUTO_DECISION:
        # 자동 판정을 꺼도 명백한 부정(중복·미리 찍은 영상)은 표시해서 검수자에게 넘긴다
        flags = judge(
            request.exercise_code, request.target_value, request.target_unit, result,
            elapsed_seconds=elapsed, duplicate_of=duplicate_of,
        ).flags
        return Judgement(
            "review_required",
            "운동 알고리즘 정확도 검증 전이므로 수동 검토가 필요합니다.",
            0.0,
            [f for f in flags if f in {"duplicate_media", "recorded_before_start"}],
        )
    return judge(
        request.exercise_code,
        request.target_value,
        request.target_unit,
        result,
        request.criteria.rules,
        elapsed_seconds=elapsed,
        duplicate_of=duplicate_of,
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


def run_job(request: VisionAnalysisRequest, path: Path | None):
    """path가 None이면 R2에서 내려받아 쓰고 끝나면 임시 파일을 지운다."""
    global _active
    callback = VisionAnalysisCallback(
        ingest_key=request.ingest_key,
        record_id=request.record_id,
        status="failed",
        engine_version=ENGINE,
    )
    temp: Path | None = None
    try:
        if path is None:
            temp = path = r2.download(
                request.media[0].object_key, MAX_MEDIA_BYTES
            )
        digest = hashlib.sha256()
        size = 0
        with path.open("rb") as stream:
            while chunk := stream.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_MEDIA_BYTES:
                    raise ValueError("size")
                digest.update(chunk)
        media = request.media[0]
        if (
            size != media.size_bytes
            or digest.hexdigest() != media.checksum_sha256.lower()
        ):
            callback.failure_reason = "AI_MEDIA_INTEGRITY_MISMATCH"
        else:
            duplicate_of = get_registry().claim(digest.hexdigest(), request.record_id)
            # 이미 낸 영상이면 분석할 필요 없이 반려
            result = {} if duplicate_of else analyze_local(request.exercise_code, path)
            verdict = judgement_for(request, result, duplicate_of)
            callback.status = "completed"
            callback.decision = verdict.decision
            callback.reason = verdict.reason
            callback.confidence = verdict.confidence
            # 인증이 안 됐으면 다시 할 때 고칠 점 (Gemini, 실패 시 규칙 문장)
            coaching = coaching_tips(
                request.exercise_code,
                request.target_value,
                request.target_unit,
                result,
                verdict.decision,
                verdict.reason,
                verdict.flags,
            )
            callback.metrics = metrics_for(
                request.exercise_code, result, digest.hexdigest(), verdict.flags, coaching
            )
            log.info(
                "Vision judged record=%s exercise=%s decision=%s reps=%s hold=%s detection=%s",
                request.record_id,
                request.exercise_code,
                verdict.decision,
                result.get("repCount"),
                result.get("holdSeconds"),
                result.get("detectionRatio"),
            )
    except FileNotFoundError:
        callback.failure_reason = "AI_MODEL_OR_MEDIA_NOT_FOUND"
    except AiError as error:  # R2 내려받기 오류(없음·너무 큼·허용 안 되는 키)
        callback.failure_reason = error.code
    except Exception:
        log.exception("Vision analysis failed")
        callback.failure_reason = "AI_VIDEO_ANALYSIS_FAILED"
    finally:
        if temp is not None:
            temp.unlink(missing_ok=True)
    payload = callback.model_dump(mode="json", by_alias=True)
    try:
        _jobs.update(request.ingest_key, callback=payload)
        send_callback(get_settings().BACKEND_CALLBACK_URL, payload)
        _jobs.update(request.ingest_key, state="delivered")
    except Exception:  # noqa: BLE001 - isolate third-party analysis and delivery failures
        _jobs.update(request.ingest_key, state="callback_failed")
        log.error("Vision callback delivery failed; development ledger retains result")
    finally:
        with _lock:
            _active -= 1


@router.post("/vision/analyses", status_code=202, response_model=AcceptedResponse)
def submit(request: VisionAnalysisRequest, background: BackgroundTasks):
    global _active
    use_r2 = get_settings().VISION_MEDIA_SOURCE == "r2"
    if not use_r2:
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
        if _active >= get_settings().MAX_CONCURRENT_ANALYSES or not _jobs.has_room():
            raise AiError("AI_VISION_BUSY", 503, "개발 분석 용량이 가득 찼습니다.")
        # r2면 키만 검사하고, 내려받기는 백그라운드(run_job)에서 한다
        if use_r2:
            r2.check_object_key(media.object_key)
            path = None
        else:
            path = local_file(media.object_key)
        _jobs.add(request.ingest_key, fingerprint)
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
