"""비동기 작업(영상 분석 I01, 리포트 I05, 재조정 I06)의 접수 기록.

같은 ingestKey로 다시 오면 중복 실행하지 않으려고 둔다(멱등). 예전에는 지우지 않아서
1000건이 쌓이면 서버를 재시작할 때까지 모든 접수가 BUSY로 거절됐다.

- 끝난 작업(delivered·callback_failed)은 finished_ttl초가 지나면 지운다.
- 그래도 가득 차면 끝난 작업을 오래된 순서로 지운다.
- 진행 중인 작업은 지우지 않는다. 진행 중만으로 가득 차면 has_room()이 False.

끝난 기록을 지운 뒤 백엔드가 같은 ingestKey로 다시 보내면 한 번 더 분석한다.
백엔드는 이미 판정된 회차의 콜백을 무시하므로 결과가 두 번 반영되지는 않는다.
"""

import threading
import time
from collections.abc import Callable

FINISHED_STATES = frozenset({"delivered", "callback_failed"})


class JobLedger:
    def __init__(
        self,
        max_jobs: int = 1000,
        finished_ttl: float = 6 * 3600,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.max_jobs = max_jobs
        self.finished_ttl = finished_ttl
        self._clock = clock
        self._lock = threading.Lock()
        self._jobs: dict[str, dict] = {}

    def __len__(self) -> int:
        with self._lock:
            return len(self._jobs)

    def get(self, key: str) -> dict | None:
        with self._lock:
            job = self._jobs.get(key)
            return dict(job) if job else None

    def _prune(self) -> None:
        now = self._clock()
        expired = [
            key
            for key, job in self._jobs.items()
            if job["state"] in FINISHED_STATES
            and now - job.get("finished_at", now) >= self.finished_ttl
        ]
        for key in expired:
            del self._jobs[key]
        if len(self._jobs) < self.max_jobs:
            return
        finished = sorted(
            (job.get("finished_at", 0.0), key)
            for key, job in self._jobs.items()
            if job["state"] in FINISHED_STATES
        )
        for _, key in finished[: len(self._jobs) - self.max_jobs + 1]:
            del self._jobs[key]

    def has_room(self) -> bool:
        with self._lock:
            self._prune()
            return len(self._jobs) < self.max_jobs

    def add(self, key: str, fingerprint: str) -> None:
        with self._lock:
            self._jobs[key] = {"fingerprint": fingerprint, "state": "accepted"}

    def update(self, key: str, **fields) -> None:
        with self._lock:
            job = self._jobs.get(key)
            if job is None:
                return
            job.update(fields)
            if job["state"] in FINISHED_STATES:
                job.setdefault("finished_at", self._clock())
