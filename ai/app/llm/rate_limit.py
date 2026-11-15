"""Gemini 호출 한도 (LLM_MAX_REQUESTS_PER_MINUTE · LLM_MAX_REQUESTS_PER_DAY).

- 분당 한도: 최근 60초 안의 호출 수. 넘으면 자리가 날 때까지 기다리고(최대 max_wait초),
  그래도 안 되면 LlmQuotaExceeded("minute").
- 하루 한도: 한국 날짜 기준. 넘으면 바로 LlmQuotaExceeded("day"), 자정(KST)에 초기화.
- 실제 API 호출 시도마다(재시도 포함) 1회로 센다. 프로세스 안에서만 세므로 서버를 여러 개 띄우면
  서버마다 따로 센다.
"""

import threading
import time
from collections import deque
from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache

KST = timezone(timedelta(hours=9))
WINDOW_SECONDS = 60.0


class LlmQuotaExceeded(RuntimeError):
    def __init__(self, scope: str):
        self.scope = scope
        super().__init__(
            "Gemini 하루 호출 한도를 넘었습니다."
            if scope == "day"
            else "Gemini 분당 호출 한도를 넘었습니다."
        )


def _kst_today() -> date:
    return datetime.now(KST).date()


class RateLimiter:
    def __init__(
        self,
        per_minute: int,
        per_day: int,
        *,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
        today: Callable[[], date] = _kst_today,
    ):
        self.per_minute = per_minute
        self.per_day = per_day
        self._clock = clock
        self._sleep = sleep
        self._today = today
        self._lock = threading.Lock()
        self._window: deque[float] = deque()
        self._day = today()
        self._day_count = 0

    def _roll(self, now: float) -> None:
        while self._window and now - self._window[0] >= WINDOW_SECONDS:
            self._window.popleft()
        today = self._today()
        if today != self._day:
            self._day = today
            self._day_count = 0

    def acquire(self, max_wait: float) -> None:
        waited = 0.0
        while True:
            with self._lock:
                now = self._clock()
                self._roll(now)
                if self._day_count >= self.per_day:
                    raise LlmQuotaExceeded("day")
                if len(self._window) < self.per_minute:
                    self._window.append(now)
                    self._day_count += 1
                    return
                wait = WINDOW_SECONDS - (now - self._window[0]) + 0.05
            if waited + wait > max_wait:
                raise LlmQuotaExceeded("minute")
            self._sleep(wait)
            waited += wait

    def snapshot(self) -> dict:
        with self._lock:
            self._roll(self._clock())
            return {
                "usedToday": self._day_count,
                "dailyLimit": self.per_day,
                "usedLastMinute": len(self._window),
                "minuteLimit": self.per_minute,
            }


@lru_cache
def get_limiter() -> RateLimiter:
    from app.core.settings import get_settings

    settings = get_settings()
    return RateLimiter(
        settings.LLM_MAX_REQUESTS_PER_MINUTE, settings.LLM_MAX_REQUESTS_PER_DAY
    )
