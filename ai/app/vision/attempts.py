"""동작 시도 기록 — 기준까지 못 내려간 동작을 찾아 피드백에 쓴다.

한 사이클 = 펴진 자세 → 굽힘 → 다시 펴진 자세. 다시 펴졌을 때
- 기준 각도까지 내려가서 횟수로 셌으면 "성공 시도",
- 기준까지는 못 갔지만 partial_below 이하까지는 내려갔으면 "덜 내려간 시도"로 남긴다
  (조금 움찔한 정도는 시도로 보지 않는다).

cycles: 시도마다 (몇 번째, 셌는지, 가장 깊은 각도, 시작·끝 시각) — AI 코칭(coaching.py) 입력
"""

MAX_CYCLES = 80


class AttemptLog:
    def __init__(self, code: str, partial_below: float):
        self.code = code
        self.partial_below = partial_below
        self.attempts = 0
        self.events: list[dict] = []
        self.cycles: list[dict] = []
        self._min: float | None = None
        self._start: float | None = None
        self._last: float | None = None

    def track(self, angle: float, t: float | None, up_above: float) -> None:
        """펴진 자세(up_above) 아래로 내려가 있는 동안 가장 깊은 각도와 시작 시각을 기억한다."""
        if angle > up_above:
            return
        if self._min is None:
            self._min, self._start = angle, t
        else:
            self._min = min(self._min, angle)
        self._last = t

    def complete(self, counted: bool) -> None:
        """다시 펴진 자세로 돌아왔을 때 호출한다."""
        shallow = not counted and self._min is not None and self._min <= self.partial_below
        if counted or shallow:
            self.attempts += 1
            if len(self.cycles) < MAX_CYCLES and self._min is not None:
                start = round(self._start or 0.0, 1)
                end = round(self._last if self._last is not None else start, 1)
                self.cycles.append({
                    "attempt": self.attempts,
                    "counted": counted,
                    "minAngle": round(self._min),
                    "time": start,
                    "seconds": round(max(0.0, end - start), 1),
                })
        if shallow:
            self.events.append({
                "attempt": self.attempts,
                "code": self.code,
                "time": round(self._start or 0.0, 1),
                "value": round(self._min),
            })
        self.reset()

    def reset(self) -> None:
        self._min = None
        self._start = None
        self._last = None
