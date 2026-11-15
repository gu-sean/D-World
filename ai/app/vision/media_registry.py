"""제출된 인증 영상의 지문(sha256) 기록 — 같은 영상을 다른 인증에 다시 내는 것을 막는다.

서버를 재시작해도 남도록 SQLite 파일(MEDIA_REGISTRY_PATH)에 저장한다.
같은 회차(record)의 재제출·재시도는 중복으로 보지 않는다.
파일을 다시 인코딩하면 지문이 달라지므로 완벽한 차단은 아니다(가장 흔한 재사용만 막음).
"""

import sqlite3
import threading
import time
from functools import lru_cache
from pathlib import Path


class MediaRegistry:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self._lock = threading.Lock()
        if str(self.path) != ":memory:":
            self.path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.path), check_same_thread=False, timeout=10)
        with self._lock, self._conn:
            self._conn.execute(
                """CREATE TABLE IF NOT EXISTS media_fingerprints (
                       sha256 TEXT PRIMARY KEY,
                       record_id TEXT NOT NULL,
                       first_seen REAL NOT NULL)"""
            )

    def claim(self, sha256: str, record_id: str) -> str | None:
        """처음 보는 영상이면 이 회차 것으로 기록하고 None.
        다른 회차가 이미 낸 영상이면 그 회차 ID를 돌려준다."""
        sha256 = sha256.lower()
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT OR IGNORE INTO media_fingerprints VALUES (?, ?, ?)",
                (sha256, record_id, time.time()),
            )
            (owner,) = self._conn.execute(
                "SELECT record_id FROM media_fingerprints WHERE sha256 = ?", (sha256,)
            ).fetchone()
        return None if owner == record_id else owner


@lru_cache
def get_registry() -> MediaRegistry:
    from app.core.settings import get_settings

    return MediaRegistry(get_settings().MEDIA_REGISTRY_PATH)
