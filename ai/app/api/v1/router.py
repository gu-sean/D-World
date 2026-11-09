
from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.api.v1.schema_check import router as schema_router
from app.core.settings import get_settings
from app.api.v1.llm import router as llm_router
from app.api.v1.vision import router as vision_router

router = APIRouter(prefix="/internal/v1")

router.include_router(health_router)
router.include_router(llm_router)
router.include_router(vision_router)

# 운영 서버에서는 개발용 검사 API 노출 금지
if get_settings().APP_ENV != "production":
    router.include_router(schema_router)
