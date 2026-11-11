from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AiError(Exception):
    def __init__(self, code: str, status: int, message: str, details: Any = None):
        self.code = code
        self.status = status
        self.message = message
        self.details = details


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AiError)
    async def handle_ai_error(_request: Request, exc: AiError):
        return JSONResponse(status_code=exc.status, content={"error": {
            "code": exc.code, "message": exc.message, "details": exc.details,
        }})

    @app.exception_handler(RequestValidationError)
    async def handle_validation(_request: Request, exc: RequestValidationError):
        fields = [".".join(map(str, e.get("loc", []))) for e in exc.errors()]
        return JSONResponse(status_code=400, content={"error": {
            "code": "AI_INVALID_REQUEST", "message": "요청 형식이 올바르지 않습니다.",
            "details": {"fields": fields},
        }})

    @app.exception_handler(Exception)
    async def handle_unexpected(_request: Request, _exc: Exception):
        return JSONResponse(status_code=500, content={"error": {
            "code": "COMMON_INTERNAL", "message": "서버 내부 오류가 발생했습니다.",
            "details": None,
        }})
