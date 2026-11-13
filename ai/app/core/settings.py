from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_ENV: Literal["development", "production", "test"] = "development"
    INTERNAL_API_TOKEN: str = "dev-internal-token"
    BACKEND_CALLBACK_URL: str = "http://localhost:3000/internal/v1/ai-callbacks"

    R2_ENDPOINT: str = "http://localhost:9000"
    R2_ACCOUNT_ID: str = ""
    R2_BUCKET: str = "dworld-dev"
    R2_ACCESS_KEY_ID: str = "minioadmin"
    R2_SECRET_ACCESS_KEY: str = "minioadmin"

    # 판정할 영상을 어디서 읽는가: local = samples/ 폴더(개발 전용), r2 = 위 R2/MinIO 버킷(objectKey)
    VISION_MEDIA_SOURCE: Literal["local", "r2"] = "local"
    VISION_ENGINE: Literal["fixed", "mediapipe"] = "fixed"
    SENSOR_ENGINE: Literal["fixed", "run"] = "fixed"
    POSE_MODEL_PATH: str = "models/pose_landmarker_lite.task"

    LLM_PROVIDER: Literal["mock", "gemini"] = "mock"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"
    GEMINI_THINKING_LEVEL: Literal["", "minimal", "low", "medium", "high"] = "low"
    LLM_MAX_REQUESTS_PER_MINUTE: int = Field(default=5, gt=0)
    LLM_MAX_REQUESTS_PER_DAY: int = Field(default=100, gt=0)
    MAX_CONCURRENT_ANALYSES: int = Field(default=2, gt=0)

    @model_validator(mode="after")
    def check_config(self):
        if self.APP_ENV == "production":
            if self.LLM_PROVIDER == "gemini" and not self.GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY is required in production")
            if self.INTERNAL_API_TOKEN == "dev-internal-token":
                raise ValueError("INTERNAL_API_TOKEN must be changed in production")
        if self.VISION_ENGINE == "mediapipe" and not Path(self.POSE_MODEL_PATH).is_file():
            raise ValueError("POSE_MODEL_PATH model file does not exist")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
