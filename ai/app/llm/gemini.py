import json
import logging
import os
import time

from dotenv import load_dotenv
from google import genai
from google.genai import errors, types

from app.llm.rate_limit import LlmQuotaExceeded, get_limiter

load_dotenv()

logger = logging.getLogger(__name__)
TRANSIENT_STATUS_CODES = {429, 500, 502, 503, 504}
# 주 3회 × 3개월 같은 긴 계획(미션 수십 개)도 잘리지 않을 만큼. GEMINI_MAX_OUTPUT_TOKENS로 조절
DEFAULT_MAX_OUTPUT_TOKENS = 16384
# 분당 한도에 걸렸을 때 기다리는 최대 시간(초). 앱이 기다리는 동기 API 기준
DEFAULT_MAX_WAIT_SECONDS = 20.0

__all__ = ["LlmQuotaExceeded", "LlmTruncatedError", "generate_json"]


class LlmTruncatedError(RuntimeError):
    """응답이 출력 길이 한도에서 잘림 (같은 요청을 다시 보내도 같은 결과)."""


def _models_to_try() -> list[str]:
    primary = os.getenv("GEMINI_MODEL", "").strip()
    fallback = os.getenv("GEMINI_FALLBACK_MODEL", "").strip()
    return list(dict.fromkeys(model for model in (primary, fallback) if model))


def _is_transient(exc: Exception) -> bool:
    return isinstance(exc, errors.APIError) and exc.code in TRANSIENT_STATUS_CODES


def _max_output_tokens() -> int:
    try:
        return max(1024, int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", DEFAULT_MAX_OUTPUT_TOKENS)))
    except ValueError:
        return DEFAULT_MAX_OUTPUT_TOKENS


def _was_truncated(response) -> bool:
    candidates = getattr(response, "candidates", None) or []
    reason = getattr(candidates[0], "finish_reason", None) if candidates else None
    return reason == types.FinishReason.MAX_TOKENS or str(reason).endswith("MAX_TOKENS")


def generate_json(
    instructions: str, payload: dict, *, max_wait: float = DEFAULT_MAX_WAIT_SECONDS
) -> dict:
    """Gemini에 JSON을 요청한다.

    max_wait: 분당 호출 한도에 걸렸을 때 기다릴 최대 초. 백그라운드 작업은 길게 준다.
    한도를 넘으면 LlmQuotaExceeded, 응답이 잘리면 LlmTruncatedError.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    models = _models_to_try()

    if not api_key or api_key.startswith("여기에"):
        raise RuntimeError("GEMINI_API_KEY가 설정되지 않았습니다.")
    if not models:
        raise RuntimeError("GEMINI_MODEL이 설정되지 않았습니다.")

    contents = instructions + "\n\n입력 데이터(JSON):\n" + json.dumps(payload, ensure_ascii=False)
    last_error: Exception | None = None
    attempts = [models[0], models[0], *models[1:]]
    limiter = get_limiter()

    for attempt_no, model in enumerate(attempts, start=1):
        limiter.acquire(max_wait)
        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                api_version="v1beta",
                timeout=int(os.getenv("GEMINI_TIMEOUT_MS", "35000")),
            ),
        )
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3,
                    max_output_tokens=_max_output_tokens(),
                ),
            )
            if _was_truncated(response):
                raise LlmTruncatedError(
                    "Gemini 응답이 출력 길이 한도에서 잘렸습니다(GEMINI_MAX_OUTPUT_TOKENS)."
                )
            if not response.text:
                raise RuntimeError("Gemini 응답이 비어 있습니다.")
            result = json.loads(response.text)
            if not isinstance(result, dict):
                raise RuntimeError("Gemini가 JSON 객체를 반환하지 않았습니다.")
            return result
        except Exception as exc:
            last_error = exc
            if not _is_transient(exc) or attempt_no == len(attempts):
                raise
            logger.warning(
                "Gemini transient error (model=%s, status=%s); retrying",
                model,
                getattr(exc, "code", None),
            )
            time.sleep(min(attempt_no, 2))
        finally:
            client.close()

    raise last_error or RuntimeError("Gemini 호출에 실패했습니다.")
