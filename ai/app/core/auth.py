from fastapi import Header

from app.core.errors import AiError
from app.core.settings import get_settings


def require_internal_token(x_internal_token: str | None = Header(default=None)) -> None:
    if x_internal_token != get_settings().INTERNAL_API_TOKEN:
        raise AiError("COMMON_UNAUTHORIZED", 401, "인증되지 않은 내부 요청입니다.")
