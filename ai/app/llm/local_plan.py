"""Gemini를 쓸 수 없을 때의 주차별 점진 계획 (LLM_PLAN_LOCAL_FALLBACK).

"한 달 안에 안 쉬고 스쿼트 50번"처럼 연속 수행이 목표면, 처음에는 적은 횟수를 여러 세트로 나눠 하고
주차가 갈수록 한 세트 횟수는 늘리고 세트 수는 줄여 마지막 주에 쉬지 않고 한 번에 최종 수치를 해내게 한다.

- 미션의 targetValue는 **모든 세트를 합한 전체 횟수**다(5회 × 3세트 → 15). 인증 영상 하나에 세트와
  쉬는 시간을 모두 찍고, AI는 영상 전체에서 센 횟수로 판정한다. 영상은 9분, 전체 횟수는 운동 최대치를 넘지 않게 맞춘다.
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
RUN_STEPS = (
    ("기초 적응", "편한 속도로 짧게 달리며 달리기 습관을 들이는 단계예요. 숨이 차면 잠깐 걸어도 괜찮아요."),
    ("거리 늘리기", "한 번에 달리는 거리를 조금씩 늘려 가요. 속도보다 끝까지 달리는 게 기준이에요."),
    ("목표 근접", "목표에 가까운 거리를 달려 봐요. 힘들면 그 주는 거리를 유지해도 괜찮아요."),
    ("최종 달성", "목표 거리를 한 번에 완주하는 주예요. 충분히 몸을 풀고 시작하세요."),
)
START_SETS = 4
REST_SECONDS = 60
SHORT_REST_SECONDS = 30
SECONDS_PER_REP = 3
MAX_MISSIONS = 100
# 세트를 모두 한 영상에 찍는다. 앱 촬영 한도(10분)보다 여유 있게 9분
MAX_VIDEO_SECONDS = 540


def _set_duration(sets: int, work: int, rest: int) -> int:
    return max(60, sets * work + (sets - 1) * rest)


def _fit_sets(per_set: int, sets: int, work: int, exercise, available_seconds: int) -> tuple[int, int]:
    """세트 수·휴식을 맞춘다: 전체 횟수 ≤ 운동 최대치, 영상 ≤ 9분, 하루 가용 시간 이하.
    먼저 휴식을 1분 → 30초로 줄이고, 그래도 넘치면 세트 수를 줄인다."""
    limit = min(MAX_VIDEO_SECONDS, available_seconds)
    while sets > 1 and per_set * sets > exercise.max_target:
        sets -= 1
    for rest in (REST_SECONDS, SHORT_REST_SECONDS):
        if _set_duration(sets, work, rest) <= limit:
            return sets, rest
    while sets > 1 and _set_duration(sets, work, SHORT_REST_SECONDS) > limit:
        sets -= 1
    return sets, SHORT_REST_SECONDS


def _rest_text(rest: int) -> str:
    return f"{rest // 60}분" if rest % 60 == 0 else f"{rest}초"


def _set_texts(index: int, label: str, per_set: int, u: str, sets: int, rest: int, tip: str,
               suffix: str = "", prefix: str = "") -> tuple[str, str]:
    """세트 미션 제목·설명. 인증은 모든 세트를 한 영상에 찍은 전체 횟수로 한다."""
    if sets == 1:
        title = f"{index + 1}주차 {label} {per_set}{u} 쉬지 않고 한 번에{suffix}"
        description = f"{prefix}쉬지 않고 {per_set}{u}를 한 번에 해요. 인증 영상은 처음부터 끝까지 찍어 주세요. {tip}"
        return title, description
    total = per_set * sets
    title = f"{index + 1}주차 {label} {per_set}{u} × {sets}세트{suffix}"
    description = (
        f"{prefix}{per_set}{u}씩 {sets}세트(총 {total}{u}), 세트 사이 {_rest_text(rest)} 휴식. "
        f"인증 영상은 {sets}세트를 쉬는 시간까지 한 영상에 모두 찍어 주세요. {tip}"
    )
    return title, description


def _requested_exercise(data: GoalPlanRequest):
    """목표 글에 운동 이름이 있으면 그 운동, 없으면 None (여러 운동 루틴으로 짠다)."""
    text = f"{data.goal.title} {data.goal.description or ''}".lower()
    code = next((c for c, names in ALIASES.items() if any(n in text for n in names)), None)
    exercise = next((item for item in data.exercise_types if item.code == code), None)
    return exercise, text


# ── 여러 운동 루틴 (운동이 정해지지 않은 목표: "운동 습관 만들기", AI 추천 목표 등) ──
# 하루에 ROUTINE_SIZE가지 운동을 하고, 앞 ROUTINE_REQUIRED개는 필수, 나머지는 선택이다.
# 보상은 미션마다 따로 받는다(필수만 해도 되고, 선택까지 하면 그만큼 더 받는다).
ROUTINE_SIZE = 4
ROUTINE_REQUIRED = 2
ROUTINE_ORDER = ("squat", "push_up", "lunge", "plank", "burpee")
# 난이도별 (첫 주 한 세트, 마지막 주 한 세트). 플랭크는 초
ROUTINE_RANGES = {
    "easy": {"squat": (5, 20), "push_up": (3, 12), "lunge": (4, 16), "plank": (15, 45), "burpee": (3, 10)},
    "normal": {"squat": (10, 30), "push_up": (5, 20), "lunge": (8, 24), "plank": (20, 60), "burpee": (5, 15)},
    "hard": {"squat": (15, 40), "push_up": (10, 30), "lunge": (12, 32), "plank": (30, 90), "burpee": (8, 20)},
}
ROUTINE_SETS = {"easy": (4, 3), "normal": (4, 3), "hard": (5, 4)}  # (첫 주, 마지막 주) 세트 수
ROUTINE_STEPS = (
    ("기초 적응", "여러 운동을 가볍게 돌아가며 자세를 익히는 단계예요. 필수 2개만 해도 충분해요."),
    ("반복 수 늘리기", "운동마다 한 세트 횟수를 조금씩 늘려 가요. 여유가 있으면 선택 운동도 해 보세요."),
    ("체력 다지기", "늘어난 횟수에 몸이 익숙해지는 단계예요. 힘든 날은 필수만 하고 쉬어도 괜찮아요."),
    ("습관 완성", "목표 횟수로 루틴을 완성하는 주예요. 꾸준히 해 온 만큼 자신 있게 해 보세요."),
)


def _routine_plan(data: GoalPlanRequest, start: date, end: date, week_count: int, per_week: int) -> dict:
    allowed = {item.code: item for item in data.exercise_types}
    pool = [code for code in ROUTINE_ORDER if code in allowed]
    if len(pool) < ROUTINE_REQUIRED:
        return _generic_plan(data, start, end, week_count)
    size = min(ROUTINE_SIZE, len(pool))
    difficulty = data.goal.difficulty_code if data.goal.difficulty_code in ROUTINE_RANGES else "easy"
    ranges = ROUTINE_RANGES[difficulty]
    first_sets, last_sets = ROUTINE_SETS[difficulty]
    available_seconds = (data.goal.daily_available_minutes or 30) * 60
    while week_count * per_week * size > MAX_MISSIONS and per_week > 1:
        per_week -= 1

    missions_by_week = []
    session_no = 0
    for index in range(week_count):
        progress = 1.0 if week_count == 1 else index / (week_count - 1)
        sets = round(first_sets - (first_sets - last_sets) * progress)
        week_missions = []
        for day in _session_days(start + timedelta(days=7 * index), end, per_week):
            # 날마다 운동 순서를 돌려서 필수 운동이 골고루 바뀌게 한다
            today = [pool[(session_no + k) % len(pool)] for k in range(size)]
            session_no += 1
            planned = []
            for k, code in enumerate(today):
                exercise = allowed[code]
                low, high = ranges.get(code, (exercise.min_target, exercise.min_target * 3))
                per_set = round(low + (high - low) * progress)
                per_set = min(exercise.max_target, max(exercise.min_target, per_set))
                work = per_set if exercise.target_unit == "seconds" else per_set * SECONDS_PER_REP
                s, rest = _fit_sets(per_set, sets, work, exercise, available_seconds)
                planned.append([exercise, per_set, s, work, rest, k < ROUTINE_REQUIRED])
            # 하루 가용 시간을 넘으면 모든 운동의 세트 수를 하나씩 줄인다
            def total(items):
                return sum(_set_duration(s, w, r) for _, _, s, w, r, _ in items)
            while total(planned) > available_seconds and any(p[2] > 1 for p in planned):
                for p in planned:
                    p[2] = max(1, p[2] - 1)
            for exercise, per_set, s, work, rest, required in planned:
                label = LABELS.get(exercise.code, exercise.name)
                tip = FORM_TIPS.get(exercise.code, "정확한 자세를 우선해요.")
                kind = "필수 운동이에요. " if required else "선택 운동이에요. 여유가 있을 때 해 보세요. "
                title, description = _set_texts(
                    index, label, per_set, _unit_text(exercise.target_unit), s, rest, tip,
                    suffix="" if required else " (선택)", prefix=kind,
                )
                week_missions.append({
                    "scheduledDate": day.isoformat(),
                    "title": title[:200],
                    "description": description,
                    "categoryCode": data.goal.category_code,
                    "difficultyCode": data.goal.difficulty_code,
                    "exerciseCode": exercise.code,
                    "verificationMethod": exercise.verification_method,
                    "targetValue": per_set * s,
                    "targetUnit": exercise.target_unit,
                    "estimatedDurationSeconds": int(_set_duration(s, work, rest)),
                    "isRequired": required,
                })
        missions_by_week.append(week_missions)

    level = {"easy": "쉬움", "normal": "보통", "hard": "어려움"}[difficulty]
    summary = (
        f"{week_count}주 동안 주 {per_week}회, 하루 {size}가지 운동(필수 {ROUTINE_REQUIRED}개 + 선택 "
        f"{size - ROUTINE_REQUIRED}개)을 돌아가며 해요. 난이도 '{level}'에 맞춰 시작해 주마다 횟수를 늘려요. "
        "필수만 해도 그날 목표 달성이고, 선택까지 하면 포인트를 더 받아요."
    )
    return {"summary": summary[:300], "steps": _group_steps(missions_by_week, ROUTINE_STEPS)}


def _final_target(exercise, text: str, difficulty: str) -> int:
    ratio = {"easy": 0.3, "normal": 0.55, "hard": 0.8}.get(difficulty, 0.55)
    default = round(exercise.min_target + (exercise.max_target - exercise.min_target) * ratio)
    if exercise.target_unit == "meters":
        # "10키로", "10km", "5.5킬로", "3000m", "800미터"
        km = re.findall(r"(\d+(?:\.\d+)?)\s*(?:km|키로|킬로)", text)
        if km:
            wanted = round(float(km[-1]) * 1000)
            return min(exercise.max_target, max(exercise.min_target, wanted))
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


def _amount(value: int, unit: str) -> str:
    """화면에 보일 수량. 거리는 1km 이상이면 km(소수 한 자리까지)."""
    if unit == "meters" and value >= 1000:
        return f"{round(value / 1000, 1):g}km"
    return f"{value}{_unit_text(unit)}"


def _round_distance(value: float, exercise) -> int:
    """거리는 100m 단위로 맞춘다(1178m 대신 1.2km)."""
    rounded = round(value / 100.0) * 100
    return min(exercise.max_target, max(exercise.min_target, rounded))


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
        # 운동이 정해지지 않은 운동 목표 → 여러 운동 루틴, 운동이 아닌 목표 → 주간 체크 미션
        if data.goal.category_code == "exercise" and data.exercise_types:
            return _routine_plan(data, start, end, week_count, per_week)
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
        if unit == "meters":
            per_set = min(final, _round_distance(per_set, exercise))
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
        u = _unit_text(unit)
        last_week = index == week_count - 1
        if not use_sets:
            duration = max(60, min(available_seconds, work))
            target = per_set
            amount = _amount(per_set, unit)
            title = f"{index + 1}주차 {label} {amount}"
            description = (
                f"{amount}를 쉬지 않고 달려요. 러닝 화면에서 기록을 시작하면 GPS로 인증돼요. {tip}"
                if exercise.code == "running"
                else tip
            )
        else:
            if last_week:
                sets = 1
            sets, rest = _fit_sets(per_set, sets, work, exercise, available_seconds)
            duration = _set_duration(sets, work, rest)
            target = per_set * sets
            title, description = _set_texts(index, label, per_set, u, sets, rest, tip)
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
                "targetValue": target,
                "targetUnit": unit,
                "estimatedDurationSeconds": int(duration),
                "isRequired": True,
            }
            for day in _session_days(week_start, end, per_week)
        ])

    steps = _group_steps(missions_by_week, RUN_STEPS if exercise.code == "running" else STEPS)
    first_per_set, first_sets = weeks[0]
    u = _unit_text(unit)
    if use_sets and week_count > 1:
        summary = (
            f"{week_count}주 동안 주 {per_week}회, {label} {first_per_set}{u} × {first_sets}세트로 시작해 "
            f"한 세트 횟수를 늘리고 세트 수를 줄여 마지막 주에 쉬지 않고 {final}{u}를 해내는 계획입니다."
        )
    elif exercise.code == "running":
        summary = (
            f"{week_count}주 동안 주 {per_week}회, {_amount(first_per_set, unit)}부터 시작해 "
            f"달리는 거리를 조금씩 늘려 마지막 주에 {_amount(final, unit)}를 완주하는 계획입니다."
        )
    else:
        summary = (
            f"{week_count}주 동안 주 {per_week}회, {label} 수행량을 "
            f"{_amount(first_per_set, unit)}에서 {_amount(final, unit)}까지 높이는 계획입니다."
        )
    return {"summary": summary[:300], "steps": steps}


def _group_steps(missions_by_week: list[list[dict]], phases=STEPS) -> list[dict]:
    week_count = len(missions_by_week)
    step_count = min(4, week_count)
    # 단계가 4개보다 적으면 앞 단계부터 쓰되 마지막 단계는 항상 '최종 달성'
    names = list(phases[:step_count - 1]) + [phases[-1]] if step_count > 1 else [phases[-1]]
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
