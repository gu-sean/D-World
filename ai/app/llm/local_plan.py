"""Gemini를 쓸 수 없을 때의 주차별 점진 계획 (LLM_PLAN_LOCAL_FALLBACK).

"한 달 안에 안 쉬고 스쿼트 50번"처럼 연속 수행이 목표면, 처음에는 적은 횟수를 여러 세트로 나눠 하고
주차가 갈수록 한 세트 횟수는 늘리고 세트 수는 줄여 마지막 주에 쉬지 않고 한 번에 최종 수치를 해내게 한다.

- 미션의 targetValue는 **한 세트** 기준이다. 인증 영상(최대 10분)은 한 세트를 찍는다.
- 세트 수·휴식은 미션 제목과 설명에 적는다(계약에 세트 필드가 없음).
- 주당 횟수는 goal.targetFrequency(없으면 3회), 전체 미션은 100개를 넘지 않는다.
"""

import re
from datetime import date, timedelta

from app.schemas.contracts import GoalPlanRequest

ALIASES = {
    "push_up": ("푸쉬업", "푸시업", "팔굽혀펴기", "push-up", "pushup"),
    "squat": ("스쿼트", "squat"),
    "lunge": ("런지", "lunge"),
    "plank": ("플랭크", "plank"),
    "burpee": ("버피", "burpee"),
    "running": ("달리기", "러닝", "running", "run"),
}
LABELS = {
    "push_up": "푸쉬업", "squat": "스쿼트", "lunge": "런지",
    "plank": "플랭크", "burpee": "버피", "running": "달리기",
}
FORM_TIPS = {
    "squat": "무릎이 발끝 방향을 향하게 하고, 허벅지가 바닥과 평행해질 때까지 앉아요.",
    "push_up": "머리부터 발끝까지 일직선을 유지하고, 가슴이 바닥 가까이 내려가게 해요.",
    "lunge": "앞 무릎이 90도가 되게 내려가고, 양쪽 다리를 번갈아 해요.",
    "plank": "팔꿈치를 어깨 바로 아래에 두고, 엉덩이가 처지거나 솟지 않게 버텨요.",
    "burpee": "앉아서 손 짚기 → 다리 뒤로 뻗기 → 돌아와 점프까지가 1회예요.",
    "running": "대화가 가능한 편한 속도로 시작해요.",
}
STEPS = (
    ("기초 적응", "가벼운 횟수를 여러 세트로 나눠 정확한 자세를 몸에 익히는 단계예요. 세트 사이에 충분히 쉬어 주세요."),
    ("반복 수 증가", "한 세트에 하는 횟수를 늘리고 세트 수는 줄여 가요. 마지막 세트까지 자세가 무너지지 않는 게 기준이에요."),
    ("목표 근접", "휴식을 줄이고 목표에 가까운 횟수를 이어서 해 봐요. 힘들면 그 주는 횟수를 유지해도 괜찮아요."),
    ("최종 달성", "쉬지 않고 목표 횟수를 한 번에 해내는 주예요. 충분히 몸을 풀고 시작하세요."),
)
START_SETS = 4
REST_SECONDS = 60
SECONDS_PER_REP = 3
MAX_MISSIONS = 100


def _requested_exercise(data: GoalPlanRequest):
    text = f"{data.goal.title} {data.goal.description or ''}".lower()
    code = next((c for c, names in ALIASES.items() if any(n in text for n in names)), None)
    exercise = next(
        (item for item in data.exercise_types if item.code == code),
        data.exercise_types[0] if data.exercise_types else None,
    )
    return exercise, text


def _final_target(exercise, text: str, difficulty: str) -> int:
    ratio = {"easy": 0.3, "normal": 0.55, "hard": 0.8}.get(difficulty, 0.55)
    default = round(exercise.min_target + (exercise.max_target - exercise.min_target) * ratio)
    unit_pattern = (
        "m|미터" if exercise.target_unit == "meters"
        else "초" if exercise.target_unit == "seconds"
        else "개|회|번"
    )
    found = re.findall(rf"(\d[\d,]*)\s*(?:{unit_pattern})", text)
    wanted = int(found[-1].replace(",", "")) if found else default
    return min(exercise.max_target, max(exercise.min_target, wanted))


def _session_days(week_start: date, end: date, per_week: int) -> list[date]:
    """한 주(7일) 안에 per_week번을 고르게 배치, 종료일을 넘지 않게."""
    offsets = sorted({round(i * 7 / per_week) for i in range(per_week)})
    return [week_start + timedelta(days=o) for o in offsets if week_start + timedelta(days=o) <= end]


def _unit_text(unit: str) -> str:
    return "초" if unit == "seconds" else "m" if unit == "meters" else "회"


def local_goal_plan(data: GoalPlanRequest) -> dict:
    start = max(data.today, data.goal.start_date)
    end = data.goal.end_date
    day_count = (end - start).days + 1
    week_count = min(52, max(1, (day_count + 6) // 7))
    available_seconds = (data.goal.daily_available_minutes or 30) * 60
    per_week = min(7, max(1, data.goal.target_frequency or 3))
    while week_count * per_week > MAX_MISSIONS and per_week > 1:
        per_week -= 1

    exercise, text = _requested_exercise(data)
    if exercise is None:
        return _generic_plan(data, start, end, week_count)

    final = _final_target(exercise, text, data.goal.difficulty_code)
    unit = exercise.target_unit
    label = LABELS.get(exercise.code, exercise.name)
    tip = FORM_TIPS.get(exercise.code, "정확한 자세를 우선해요.")
    use_sets = unit in ("reps", "seconds")
    first_per_set = max(exercise.min_target, round(final * 0.1))

    weeks = []
    for index in range(week_count):
        progress = 1.0 if week_count == 1 else index / (week_count - 1)
        per_set = min(final, max(first_per_set, round(first_per_set + (final - first_per_set) * progress)))
        sets = 1 if (not use_sets or index == week_count - 1) else max(2, round(START_SETS - (START_SETS - 2) * progress))
        weeks.append((per_set, sets))

    missions_by_week = []
    for index, (per_set, sets) in enumerate(weeks):
        # 한 세트에 걸리는 시간(초): 반복은 1회당 3초, 플랭크는 그 초 그대로, 달리기는 1km 6분 기준
        work = (
            per_set * SECONDS_PER_REP if unit == "reps"
            else per_set if unit == "seconds"
            else round(per_set * 0.36)
        )
        # 하루 가용 시간을 넘으면 세트 수를 줄인다
        while sets > 1 and sets * work + (sets - 1) * REST_SECONDS > available_seconds:
            sets -= 1
        duration = max(60, min(available_seconds, sets * work + (sets - 1) * REST_SECONDS))
        u = _unit_text(unit)
        last_week = index == week_count - 1
        if not use_sets:
            title = f"{index + 1}주차 {label} {per_set}{u}"
            description = f"{tip}"
        elif last_week or sets == 1:
            title = f"{index + 1}주차 {label} {per_set}{u} 쉬지 않고 한 번에"
            description = f"쉬지 않고 {per_set}{u}를 한 번에 해요. 인증 영상은 이 한 세트를 처음부터 끝까지 찍어 주세요. {tip}"
        else:
            title = f"{index + 1}주차 {label} {per_set}{u} × {sets}세트"
            description = (
                f"{per_set}{u}씩 {sets}세트, 세트 사이 {REST_SECONDS // 60}분 휴식. "
                f"인증 영상은 한 세트를 찍어 주세요. {tip}"
            )
        week_start = start + timedelta(days=7 * index)
        missions_by_week.append([
            {
                "scheduledDate": day.isoformat(),
                "title": title[:200],
                "description": description,
                "categoryCode": data.goal.category_code,
                "difficultyCode": data.goal.difficulty_code,
                "exerciseCode": exercise.code,
                "verificationMethod": exercise.verification_method,
                "targetValue": per_set,
                "targetUnit": unit,
                "estimatedDurationSeconds": int(duration),
                "isRequired": True,
            }
            for day in _session_days(week_start, end, per_week)
        ])

    steps = _group_steps(missions_by_week)
    first_per_set, first_sets = weeks[0]
    u = _unit_text(unit)
    if use_sets and week_count > 1:
        summary = (
            f"{week_count}주 동안 주 {per_week}회, {label} {first_per_set}{u} × {first_sets}세트로 시작해 "
            f"한 세트 횟수를 늘리고 세트 수를 줄여 마지막 주에 쉬지 않고 {final}{u}를 해내는 계획입니다."
        )
    else:
        summary = f"{week_count}주 동안 주 {per_week}회, {label} 수행량을 {first_per_set}{u}에서 {final}{u}까지 높이는 계획입니다."
    return {"summary": summary[:300], "steps": steps}


def _group_steps(missions_by_week: list[list[dict]]) -> list[dict]:
    week_count = len(missions_by_week)
    step_count = min(4, week_count)
    # 단계가 4개보다 적으면 앞 단계부터 쓰되 마지막 단계는 항상 '최종 달성'
    names = list(STEPS[:step_count - 1]) + [STEPS[-1]] if step_count > 1 else [STEPS[-1]]
    steps = []
    for step_index in range(step_count):
        left = round(step_index * week_count / step_count)
        right = round((step_index + 1) * week_count / step_count)
        missions = [m for week in missions_by_week[left:right] for m in week]
        if not missions:
            continue
        title, description = names[step_index]
        steps.append({
            "stepNo": len(steps) + 1,
            "title": title,
            "description": description,
            "dueDate": missions[-1]["scheduledDate"],
            "missions": missions,
        })
    return steps


def _generic_plan(data: GoalPlanRequest, start: date, end: date, week_count: int) -> dict:
    """허용 운동이 없을 때: 주 1회 체크 미션."""
    missions_by_week = []
    for index in range(week_count):
        day = min(end, start + timedelta(days=7 * index))
        missions_by_week.append([{
            "scheduledDate": day.isoformat(),
            "title": f"{index + 1}주차 {data.goal.title}"[:200],
            "description": "이번 주 목표를 실천하고 사진으로 인증해 주세요.",
            "categoryCode": data.goal.category_code,
            "difficultyCode": data.goal.difficulty_code,
            "exerciseCode": None,
            "verificationMethod": "camera",
            "targetValue": 1,
            "targetUnit": "times",
            "estimatedDurationSeconds": 600,
            "isRequired": True,
        }])
    return {
        "summary": f"{week_count}주 동안 매주 한 번씩 목표를 실천하는 계획입니다.",
        "steps": _group_steps(missions_by_week),
    }
