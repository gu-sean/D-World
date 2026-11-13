"""AI가 만든 계획(단계·미션)이 요청 조건을 지키는지 검사한다 (I03 목표 계획, I06 계획 재조정 공용)."""

from collections import defaultdict
from collections.abc import Sequence
from datetime import date

from app.schemas.contracts import ExerciseType, PlanStep


class PlanInvalidError(ValueError):
    """검사에 실패한 이유를 사람이 읽을 수 있는 문구로 담는다."""


def check_plan(
    steps: Sequence[PlanStep],
    *,
    category_code: str,
    period: tuple[date, date],
    exercise_types: Sequence[ExerciseType],
    max_missions: int,
    daily_available_minutes: int | None,
) -> int:
    """단계 수는 호출한 쪽이 따로 본다. 통과하면 미션 수를 돌려준다."""
    start, end = period
    allowed = {item.code: item for item in exercise_types}
    seconds_per_day: dict[date, int] = defaultdict(int)
    mission_count = 0

    for step in steps:
        if not start <= step.due_date <= end:
            raise PlanInvalidError("계획 단계의 날짜가 기간을 벗어났습니다.")
        for mission in step.missions:
            mission_count += 1
            if not start <= mission.scheduled_date <= end:
                raise PlanInvalidError("미션 날짜가 기간을 벗어났습니다.")
            if mission.category_code != category_code:
                raise PlanInvalidError("미션 카테고리가 목표와 다릅니다.")
            if mission.exercise_code is not None:
                exercise = allowed.get(mission.exercise_code)
                if exercise is None:
                    raise PlanInvalidError("허용되지 않은 운동이 생성되었습니다.")
                if (
                    mission.verification_method != exercise.verification_method
                    or mission.target_unit != exercise.target_unit
                    or not exercise.min_target <= mission.target_value <= exercise.max_target
                ):
                    raise PlanInvalidError("운동별 수행 조건이 올바르지 않습니다.")
            seconds_per_day[mission.scheduled_date] += mission.estimated_duration_seconds

    if mission_count == 0 or mission_count > max_missions:
        raise PlanInvalidError("생성된 미션 수가 올바르지 않습니다.")
    if daily_available_minutes is not None:
        limit = daily_available_minutes * 60
        if any(seconds > limit for seconds in seconds_per_day.values()):
            raise PlanInvalidError("하루 가용 시간을 초과하는 계획입니다.")
    return mission_count
