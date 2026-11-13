
from tests.conftest import new_id







HEADERS = {
    "X-Internal-Token": "dev-internal-token"
}


def make_goal_request():
    return {
        "ingestKey": f"goal-plan:{new_id()}:1",
        "today": "2026-11-06",
        "goal": {
            "title": "스쿼트 꾸준히 하기",
            "description": None,
            "categoryCode": "exercise",
            "difficultyCode": "easy",
            "startDate": "2026-11-06",
            "endDate": "2026-11-20",
            "targetFrequency": 3,
            "dailyAvailableMinutes": 20
        },
        "exerciseTypes": [
            {
                "code": "squat",
                "name": "스쿼트",
                "verificationMethod": "camera",
                "targetUnit": "reps",
                "minTarget": 5,
                "maxTarget": 100
            }
        ],
        "generationNo": 1,
        "previousSummary": None
    }


def test_goal_plan_schema_success(client):
    response = client.post(
        "/internal/v1/dev/schema-check/goal-plan",
        headers=HEADERS,
        json=make_goal_request(),
    )

    assert response.status_code == 200
    assert response.json()["valid"] is True


def test_goal_plan_invalid(client):
    data = make_goal_request()
    data["goal"]["endDate"] = "2026-11-01"

    response = client.post(
        "/internal/v1/dev/schema-check/goal-plan",
        headers=HEADERS,
        json=data,
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "AI_INVALID_REQUEST"


def test_internal_token_required(client):
    response = client.post(
        "/internal/v1/dev/schema-check/goal-plan",
        json=make_goal_request(),
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "COMMON_UNAUTHORIZED"
