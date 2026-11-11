import os

import pytest
from fastapi.testclient import TestClient

# Apply before test modules import app.main during collection.
os.environ.update({
    "APP_ENV": "test",
    "LLM_PROVIDER": "mock",
    "VISION_ENGINE": "fixed",
    "SENSOR_ENGINE": "fixed",
    "INTERNAL_API_TOKEN": "dev-internal-token",
})

from app.core.settings import get_settings

get_settings.cache_clear()


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    monkeypatch.setenv("VISION_ENGINE", "fixed")
    monkeypatch.setenv("SENSOR_ENGINE", "fixed")
    monkeypatch.setenv("INTERNAL_API_TOKEN", "dev-internal-token")
    get_settings.cache_clear()
    from app.main import create_app

    try:
        with TestClient(create_app()) as test_client:
            yield test_client
    finally:
        get_settings.cache_clear()
