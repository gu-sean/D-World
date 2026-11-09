def test_health_shape(client):
    response = client.get("/internal/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["engines"]["vision"] == "vision-fixed@0.1.0"
    assert data["engines"]["visionExercises"] == [
        "push_up", "burpee", "squat", "lunge", "plank",
    ]
    assert data["engines"]["llm"] == "mock"
    assert data["llmQuota"] is None
    assert data["queue"] == {"running": 0, "waiting": 0}
