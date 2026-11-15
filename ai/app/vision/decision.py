"""영상 분석 결과 → 인증 판정 (approved / rejected / review_required).

판정 규칙 (기본값은 관리자 판정 기준 `criteria.rules`에 같은 이름의 값이 있으면 그 값을 쓴다)
- 다른 인증에 이미 낸 영상                            → rejected (duplicate_media)
- 영상 길이 > 회차 시작~제출 시간 + 15초              → rejected (recorded_before_start)
- 영상을 한 프레임도 읽지 못함                       → rejected
- 사람이 감지된 프레임 비율 < rejectDetectionRatio(0.3) → rejected  (몸이 화면에 안 보임)
- 수행량 ≥ 목표
    - 감지 비율 ≥ minDetectionRatio(0.6)             → approved
    - 아니면                                         → review_required (사람이 자주 가려짐)
- 수행량 ≥ 목표 × borderlineRatio(0.8)               → review_required (카운터가 몇 회 놓쳤을 수 있음)
- 그 밖                                              → rejected
"""

from dataclasses import dataclass, field

# 서버·폰 시계 차이와 촬영 앱 전환 시간 여유 (초)
RECORDING_GRACE_SECONDS = 15.0

DEFAULT_RULES = {
    "minDetectionRatio": 0.6,
    "rejectDetectionRatio": 0.3,
    "borderlineRatio": 0.8,
}


@dataclass
class Judgement:
    decision: str
    reason: str
    confidence: float
    flags: list[str] = field(default_factory=list)


def _rule(rules: dict | None, name: str) -> float:
    value = (rules or {}).get(name)
    if isinstance(value, (int, float)) and not isinstance(value, bool) and 0 <= value <= 1:
        return float(value)
    return DEFAULT_RULES[name]


def _amount(value: float, unit: str) -> str:
    number = f"{value:g}" if unit != "seconds" else f"{value:.0f}"
    return f"{number}초" if unit == "seconds" else f"{number}회"


def judge(
    exercise_code: str,
    target_value: float,
    target_unit: str,
    result: dict,
    rules: dict | None = None,
    *,
    elapsed_seconds: float | None = None,
    duplicate_of: str | None = None,
) -> Judgement:
    """elapsed_seconds: 회차 시작부터 제출까지 걸린 시간(초). 앱은 회차를 연 뒤 촬영하므로
    영상이 이보다 길면 미리 찍어 둔 영상이다.
    duplicate_of: 같은 영상을 이미 낸 다른 회차 ID (media_registry)."""
    if duplicate_of:
        return Judgement(
            "rejected",
            "이미 다른 인증에 제출된 영상이에요. 새로 찍어 주세요.",
            1.0,
            ["duplicate_media"],
        )

    duration = result.get("durationSeconds")
    if (
        elapsed_seconds is not None
        and isinstance(duration, (int, float))
        and duration > elapsed_seconds + RECORDING_GRACE_SECONDS
    ):
        return Judgement(
            "rejected",
            "인증을 시작하기 전에 찍은 영상이에요. 인증 시작 후 새로 찍어 주세요.",
            1.0,
            ["recorded_before_start"],
        )

    analyzed = int(result.get("analyzedFrames") or 0)
    ratio = float(result.get("detectionRatio") or 0.0)
    if exercise_code == "plank":
        achieved = float(result.get("holdSeconds") or 0.0)
    else:
        achieved = float(result.get("repCount") or 0)

    min_ratio = _rule(rules, "minDetectionRatio")
    reject_ratio = _rule(rules, "rejectDetectionRatio")
    borderline = _rule(rules, "borderlineRatio")
    confidence = round(max(0.0, min(1.0, ratio)), 3)
    done = _amount(achieved, target_unit)
    goal = _amount(target_value, target_unit)

    if analyzed == 0:
        return Judgement(
            "rejected",
            "영상을 읽을 수 없어요. 다시 찍어 주세요.",
            0.0,
            ["no_frames"],
        )
    if ratio < reject_ratio:
        return Judgement(
            "rejected",
            "몸이 화면에 잘 보이지 않았어요. 전신이 보이도록 옆에서 다시 찍어 주세요.",
            confidence,
            ["person_not_detected"],
        )
    if achieved >= target_value:
        if ratio >= min_ratio:
            return Judgement(
                "approved",
                f"목표 {goal} 중 {done}를 확인했어요.",
                confidence,
            )
        return Judgement(
            "review_required",
            f"{done}를 확인했지만 몸이 자주 가려져서 검토 후 알려 드릴게요.",
            confidence,
            ["low_detection"],
        )
    if achieved >= target_value * borderline:
        return Judgement(
            "review_required",
            f"목표 {goal} 중 {done}를 확인했어요. 거의 다 와서 검토 후 알려 드릴게요.",
            confidence,
            ["near_target"],
        )
    return Judgement(
        "rejected",
        f"목표 {goal} 중 {done}만 확인됐어요.",
        confidence,
        ["below_target"],
    )
