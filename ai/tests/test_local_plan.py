"""예비 목표 계획(local_goal_plan): 세트 구성·주당 횟수·단계 설명."""

from app.llm.local_plan import local_goal_plan
from app.llm.plan_validation import check_plan
from app.schemas.contracts import GoalPlanRequest, PlanProposalOutput

EXERCISES = [
    {"code": "squat", "name": "스쿼트", "verificationMethod": "camera", "targetUnit": "reps", "minTarget": 1, "maxTarget": 200},
    {"code": "push_up", "name": "푸시업", "verificationMethod": "camera", "targetUnit": "reps", "minTarget": 1, "maxTarget": 200},
    {"code": "plank", "name": "플랭크", "verificationMethod": "camera", "targetUnit": "seconds", "minTarget": 10, "maxTarget": 600},
    {"code": "lunge", "name": "런지", "verificationMethod": "camera", "targetUnit": "reps", "minTarget": 2, "maxTarget": 100},
    {"code": "burpee", "name": "버피", "verificationMethod": "camera", "targetUnit": "reps", "minTarget": 1, "maxTarget": 50},
    {"code": "running", "name": "러닝", "verificationMethod": "sensor", "targetUnit": "meters", "minTarget": 300, "maxTarget": 20000},
]


def request(title, start="2026-11-14", end="2026-12-14", frequency=3, minutes=30):
    return GoalPlanRequest.model_validate({
        "ingestKey": "goal-plan:x", "today": start, "generationNo": 1, "previousSummary": None,
        "goal": {"title": title, "description": None, "categoryCode": "exercise", "difficultyCode": "normal",
                 "startDate": start, "endDate": end, "targetFrequency": frequency, "dailyAvailableMinutes": minutes},
        "exerciseTypes": EXERCISES,
    })


def missions(plan):
    return [m for step in plan["steps"] for m in step["missions"]]


def valid(req, plan):
    proposal = PlanProposalOutput.model_validate(plan)
    check_plan(proposal.steps, category_code="exercise", period=(req.goal.start_date, req.goal.end_date),
               exercise_types=req.exercise_types, max_missions=100,
               daily_available_minutes=req.goal.daily_available_minutes)


def test_squat_50_continuous_uses_sets_and_ends_with_one_set_of_50():
    req = request("한달안에 안쉬고 스쿼트 50번 하기")
    plan = local_goal_plan(req)
    valid(req, plan)
    ms = missions(plan)
    first, last = ms[0], ms[-1]
    # 제목은 한 세트 횟수, 목표값은 모든 세트를 합한 전체 횟수 (한 영상에 모두 찍어 인증)
    assert "5회 × 4세트" in first["title"]
    assert first["targetValue"] == 20
    assert "총 20회" in first["description"]
    assert "세트 사이 1분 휴식" in first["description"]
    assert "한 영상에 모두" in first["description"]
    assert last["targetValue"] == 50 and "쉬지 않고 한 번에" in last["title"]
    # 한 미션 영상은 9분을 넘지 않는다
    assert all(m["estimatedDurationSeconds"] <= 540 for m in ms)


def test_set_total_never_exceeds_exercise_max():
    # 플랭크 최대 90초: 45초 × 3세트(135초)는 안 되므로 세트 수를 줄인다
    exercises = [dict(e) for e in EXERCISES]
    for e in exercises:
        if e["code"] == "plank":
            e["maxTarget"] = 90
    req = GoalPlanRequest.model_validate({
        "ingestKey": "goal-plan:x", "today": "2026-11-14", "generationNo": 1, "previousSummary": None,
        "goal": {"title": "플랭크 90초", "description": None, "categoryCode": "exercise", "difficultyCode": "normal",
                 "startDate": "2026-11-14", "endDate": "2026-12-14", "targetFrequency": 3, "dailyAvailableMinutes": 30},
        "exerciseTypes": exercises,
    })
    plan = local_goal_plan(req)
    valid(req, plan)
    assert all(m["targetValue"] <= 90 for m in missions(plan))


def test_three_sessions_per_week():
    req = request("스쿼트 50회", frequency=3)
    ms = missions(local_goal_plan(req))
    first_week = [m for m in ms if m["scheduledDate"] < "2026-11-21"]
    assert len(first_week) == 3


def test_step_descriptions_are_all_different():
    plan = local_goal_plan(request("스쿼트 50회"))
    descriptions = [s["description"] for s in plan["steps"]]
    assert len(descriptions) == len(set(descriptions)) > 1
    assert plan["steps"][-1]["title"] == "최종 달성"


def test_plank_uses_seconds_per_set():
    req = request("플랭크 60초 버티기")
    plan = local_goal_plan(req)
    valid(req, plan)
    ms = missions(plan)
    assert "초 × " in ms[0]["title"]
    assert ms[-1]["targetValue"] == 60


def test_short_daily_time_reduces_sets():
    req = request("스쿼트 50회", minutes=5)
    plan = local_goal_plan(req)
    valid(req, plan)  # 하루 5분을 넘지 않는다


def test_running_has_no_sets():
    req = request("러닝 5000m 달리기")
    plan = local_goal_plan(req)
    valid(req, plan)
    assert all("세트" not in m["title"] for m in missions(plan))


def test_running_10_kiro_shows_km_and_round_distances():
    req = request("러닝 10키로 뛰기")
    plan = local_goal_plan(req)
    valid(req, plan)
    ms = missions(plan)
    assert ms[-1]["targetValue"] == 10000
    assert ms[-1]["title"].endswith("10km")
    assert all(m["targetValue"] % 100 == 0 for m in ms)
    assert all(m["title"].endswith("km") for m in ms if m["targetValue"] >= 1000)
    assert "세트" not in plan["steps"][0]["description"]
    assert "km" in plan["summary"]


def test_goal_without_exercise_becomes_four_exercise_routine():
    req = request("한 달 운동 습관 만들기", minutes=30)
    plan = local_goal_plan(req)
    valid(req, plan)
    ms = missions(plan)
    first_day = [m for m in ms if m["scheduledDate"] == ms[0]["scheduledDate"]]
    assert len(first_day) == 4
    assert len({m["exerciseCode"] for m in first_day}) == 4
    assert sum(m["isRequired"] for m in first_day) == 2
    assert all(m["title"].endswith("(선택)") for m in first_day if not m["isRequired"])
    # 날마다 필수 운동이 바뀐다
    days = sorted({m["scheduledDate"] for m in ms})
    req1 = {m["exerciseCode"] for m in ms if m["scheduledDate"] == days[0] and m["isRequired"]}
    req2 = {m["exerciseCode"] for m in ms if m["scheduledDate"] == days[1] and m["isRequired"]}
    assert req1 != req2
    assert "필수" in plan["summary"]
    assert len(ms) <= 100


def test_routine_scales_with_difficulty():
    def first_squat(difficulty):
        req = request("기초 체력 기르기")
        req.goal.difficulty_code = difficulty
        return next(m["targetValue"] for m in missions(local_goal_plan(req)) if m["exerciseCode"] == "squat")
    assert first_squat("easy") < first_squat("normal") < first_squat("hard")


def test_long_goal_stays_within_100_missions():
    req = request("푸쉬업 100개", end="2027-11-13", frequency=7)
    plan = local_goal_plan(req)
    valid(req, plan)
    assert len(missions(plan)) <= 100
