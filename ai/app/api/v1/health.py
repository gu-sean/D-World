from fastapi import APIRouter

from app.core.settings import get_settings

router = APIRouter(tags=["health"])
EXERCISES = ["push_up", "burpee", "squat", "lunge", "plank"]


@router.get("/health")
def health():
    cfg = get_settings()
    effective_provider = cfg.LLM_PROVIDER
    if effective_provider == "gemini" and not cfg.GEMINI_API_KEY:
        effective_provider = "mock"
    return {
        "status": "ok",
        "engines": {
            "vision": "vision-fixed@0.1.0" if cfg.VISION_ENGINE == "fixed"
                      else "vision-rule@0.1.0",
            "visionExercises": EXERCISES if cfg.VISION_ENGINE == "fixed" else [],
            "photo": "photo-fixed@0.1.0" if cfg.VISION_ENGINE == "fixed"
                     else "photo-basic@0.1.0",
            "sensor": "sensor-fixed@0.1.0" if cfg.SENSOR_ENGINE == "fixed"
                      else "sensor-run@0.1.0",
            "llm": "mock" if effective_provider == "mock" else f"gemini:{cfg.GEMINI_MODEL}",
        },
        "llmQuota": None if effective_provider == "mock" else {
            "usedToday": 0, "dailyLimit": cfg.LLM_MAX_REQUESTS_PER_DAY,
        },
        "queue": {"running": 0, "waiting": 0},
    }
