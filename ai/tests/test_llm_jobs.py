"""I05 리포트·I06 계획 재조정: 접수 → 생성 → 콜백 (Gemini는 가짜로 대체)."""

from tests.conftest import new_id

import pytest
from app.api.v1 import llm_jobs
from app.core.settings import get_settings
from app.main import create_app
from fastapi.testclient import TestClient

HEADERS = {"X-Internal-Token": "dev-internal-token"}
BASE = "http://localhost:3000/internal/v1/ai-callbacks"


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("INTERNAL_API_TOKEN", "dev-internal-token")
    monkeypatch.setenv("BACKEND_CALLBACK_URL", BASE)
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    get_settings.cache_clear()
    llm_jobs._jobs.clear()
    calls = []
    monkeypatch.setattr(llm_jobs, "send_callback", lambda url, payload: calls.append((url, payload)))
    with TestClient(create_app()) as client:
        yield client, calls, monkeypatch
    get_settings.cache_clear()


def report_body():
    run = new_id()
    return {
        "ingestKey": f"report:{run}",
        "runId": run,
        "runType": "weekly_report",
        "periodStart": "2026-11-02",
        "periodEnd": "2026-11-08",
        "stats": {
            "plannedMissionCount": 7,
            "completedMissionCount": 5,
            "failedMissionCount": 1,
            "achievementRate": 0.71,
            "previousAchievementRate": None,
            "streakDays": 3,
            "categories": [
                {"categoryCode": "exercise", "completedValue": 5, "targetValue": 7, "unit": "times", "rate": 0.71}
            ],
            "exercises": [],
            "topFailureFlags": [],
            "activeGoals": [{"title": "운동 습관", "categoryCode": "exercise", "progressRate": 0.4}],
        },
        "callbackUrl": f"{BASE}/reports",
    }


GOOD_REPORT = {
    "title": "이번 주 운동 리포트",
    "summary": "7개 중 5개를 완료했어요.",
    "feedback": "꾸준함이 좋아요.",
    "nextGoals": [{"text": "주 5회 유지", "categoryCode": "exercise"}],
    "highlights": ["5개 완료", "연속 3일"],
}


def adjust_body():
    run = new_id()
    goal_id = new_id()
    mission = {
        "scheduledDate": "2026-11-12",
        "title": "스쿼트 10개",
        "description": None,
        "categoryCode": "exercise",
        "difficultyCode": "normal",
        "exerciseCode": "squat",
        "verificationMethod": "camera",
        "targetValue": 20,
        "targetUnit": "reps",
        "estimatedDurationSeconds": 600,
        "isRequired": True,
    }
    return {
        "ingestKey": f"plan-adjust:{run}:{goal_id}",
        "runId": run,
        "today": "2026-11-10",
        "goal": {
            "title": "운동 습관",
            "description": None,
            "categoryCode": "exercise",
            "difficultyCode": "normal",
            "startDate": "2026-11-01",
            "endDate": "2026-11-30",
            "targetFrequency": 3,
            "dailyAvailableMinutes": 30,
        },
        "beforePlan": [{"stepNo": 1, "title": "기초", "description": None, "dueDate": "2026-11-20", "missions": [mission]}],
        "stats": {
            "periodStart": "2026-11-02",
            "periodEnd": "2026-11-08",
            "plannedCount": 7,
            "completedCount": 2,
            "failedCount": 2,
            "achievementRate": 0.29,
            "consecutiveMissedDays": 0,
        },
        "causes": [{"code": "low_completion", "value": 0.29}],
        "exerciseTypes": [
            {"code": "squat", "name": "스쿼트", "verificationMethod": "camera", "targetUnit": "reps", "minTarget": 5, "maxTarget": 50}
        ],
        "callbackUrl": f"{BASE}/plan-adjustments",
    }


def good_plan(date="2026-11-13", target=10):
    return {
        "reason": "달성률이 낮아 횟수를 줄였어요.",
        "proposedPlan": [
            {
                "stepNo": 1,
                "title": "가볍게 다시 시작",
                "description": None,
                "dueDate": "2026-11-20",
                "missions": [
                    {
                        "scheduledDate": date,
                        "title": "스쿼트 10개",
                        "description": None,
                        "categoryCode": "exercise",
                        "difficultyCode": "easy",
                        "exerciseCode": "squat",
                        "verificationMethod": "camera",
                        "targetValue": target,
                        "targetUnit": "reps",
                        "estimatedDurationSeconds": 300,
                        "isRequired": True,
                    }
                ],
            }
        ],
    }


def post(client, path, body):
    return client.post(f"/internal/v1/llm/{path}", headers=HEADERS, json=body)


def test_report_completed(setup):
    client, calls, mp = setup
    mp.setattr(llm_jobs, "generate_json", lambda instructions, payload: GOOD_REPORT)
    data = report_body()
    assert post(client, "reports", data).status_code == 202
    url, payload = calls[0]
    assert url == f"{BASE}/reports"
    assert payload["status"] == "completed"
    assert payload["title"] == "이번 주 운동 리포트"
    assert payload["nextGoals"] == [{"text": "주 5회 유지", "categoryCode": "exercise"}]
    assert payload["content"] == {"highlights": ["5개 완료", "연속 3일"]}


def test_report_llm_failure_and_invalid_output(setup):
    client, calls, mp = setup

    def boom(instructions, payload):
        raise RuntimeError("quota")

    mp.setattr(llm_jobs, "generate_json", boom)
    assert post(client, "reports", report_body()).status_code == 202
    assert calls[-1][1]["status"] == "failed"
    assert calls[-1][1]["failureReason"] == "AI_LLM_UNAVAILABLE"

    bad = {**GOOD_REPORT, "nextGoals": [{"text": "x", "categoryCode": "unknown"}]}
    mp.setattr(llm_jobs, "generate_json", lambda i, p: bad)
    assert post(client, "reports", report_body()).status_code == 202
    assert calls[-1][1]["failureReason"] == "AI_INVALID_OUTPUT"

    mp.setattr(llm_jobs, "generate_json", lambda i, p: {"summary": "제목 없음"})
    assert post(client, "reports", report_body()).status_code == 202
    assert calls[-1][1]["failureReason"] == "AI_INVALID_OUTPUT"


def test_idempotent_and_conflict_and_callback_url(setup):
    client, calls, mp = setup
    mp.setattr(llm_jobs, "generate_json", lambda i, p: GOOD_REPORT)
    data = report_body()
    assert post(client, "reports", data).status_code == 202
    assert post(client, "reports", data).status_code == 202
    assert len(calls) == 1  # 같은 요청은 다시 만들지 않음
    changed = {**data, "periodEnd": "2026-11-09"}
    assert post(client, "reports", changed).status_code == 409

    other = report_body()
    other["callbackUrl"] = "http://evil.example/reports"
    response = post(client, "reports", other)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "AI_INVALID_CALLBACK"

    wrong_path = report_body()
    wrong_path["callbackUrl"] = f"{BASE}/plan-adjustments"  # 리포트에 재조정 콜백 주소는 안 됨
    assert post(client, "reports", wrong_path).status_code == 400


def test_requires_internal_token(setup):
    client, _, _ = setup
    response = client.post("/internal/v1/llm/reports", json=report_body())
    assert response.status_code == 401


def test_adjustment_completed(setup):
    client, calls, mp = setup
    mp.setattr(llm_jobs, "generate_json", lambda i, p: good_plan())
    assert post(client, "plan-adjustments", adjust_body()).status_code == 202
    url, payload = calls[0]
    assert url == f"{BASE}/plan-adjustments"
    assert payload["status"] == "completed"
    assert payload["proposedPlan"][0]["missions"][0]["targetValue"] == 10
    assert payload["reason"].startswith("달성률")


@pytest.mark.parametrize(
    "plan",
    [
        good_plan(date="2026-11-09"),  # today(11-10) 이전
        good_plan(date="2026-12-05"),  # 목표 종료일 이후
        good_plan(target=999),  # 허용 횟수 초과
        {"reason": "x", "proposedPlan": []},
    ],
)
def test_adjustment_rejects_invalid_plan(setup, plan):
    client, calls, mp = setup
    mp.setattr(llm_jobs, "generate_json", lambda i, p: plan)
    assert post(client, "plan-adjustments", adjust_body()).status_code == 202
    assert calls[0][1]["status"] == "failed"
    assert calls[0][1]["failureReason"] == "AI_INVALID_OUTPUT"
    assert calls[0][1]["proposedPlan"] is None
