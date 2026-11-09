from fastapi import FastAPI

from app.api.v1.router import router
from app.core.errors import install_error_handlers
from app.core.settings import get_settings


def create_app() -> FastAPI:
    get_settings()  # 시작 시 환경변수·모델 경로 검사
    app = FastAPI(title="D-World AI Internal API", version="0.1.0")
    install_error_handlers(app)
    app.include_router(router)
    return app


app = create_app()
