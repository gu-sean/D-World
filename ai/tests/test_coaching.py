"""AI 코칭: 실패한 인증에 '다시 할 때 고칠 점'을 만드는지 (Gemini 없이 규칙 문장 경로)."""

from app.vision import coaching
from app.vision.coaching import coaching_tips, rule_tips


def test_approved_has_no_tips():
    assert coaching_tips("push_up", 10, "reps", {}, "approved", "", []) == ([], "none")


def test_rule_tips_name_the_missed_rep_and_target(monkeypatch):
    monkeypatch.setenv("VISION_AI_COACHING", "false")
    result = {
        "repCount": 3,
        "cycles": [
            {"attempt": 1, "counted": True, "minAngle": 80, "time": 1.0, "seconds": 1.2},
            {"attempt": 2, "counted": False, "minAngle": 110, "time": 3.0, "seconds": 1.0},
        ],
    }
    tips, source = coaching_tips("push_up", 10, "reps", result, "rejected", "목표 10회 중 3회", ["below_target"])
    assert source == "rule"
    assert any("2번째" in t and "110°" in t for t in tips)
    assert any("10회 중 3회" in t for t in tips)
    assert 1 <= len(tips) <= coaching.MAX_TIPS


def test_duplicate_video_only_says_record_again():
    tips = rule_tips("squat", 10, "reps", {}, ["duplicate_media"])
    assert tips == [coaching.FLAG_TIPS["duplicate_media"]]


def test_gemini_failure_falls_back_to_rules(monkeypatch):
    monkeypatch.setenv("VISION_AI_COACHING", "true")

    def boom(*args, **kwargs):
        raise RuntimeError("503")

    import app.llm.gemini as gemini

    monkeypatch.setattr(gemini, "generate_json", boom)
    tips, source = coaching_tips("plank", 30, "seconds", {"holdSeconds": 10}, "rejected", "", ["below_target"])
    assert source == "rule" and tips


def test_gemini_tips_are_cleaned(monkeypatch):
    monkeypatch.setenv("VISION_AI_COACHING", "true")
    import app.llm.gemini as gemini

    monkeypatch.setattr(gemini, "generate_json", lambda *a, **k: {"tips": ["  천천히 해 주세요. ", "", 3, "x" * 500]})
    tips, source = coaching_tips("squat", 10, "reps", {}, "rejected", "", ["below_target"])
    assert source == "gemini"
    assert tips[0] == "천천히 해 주세요."
    assert len(tips) == 2 and len(tips[1]) == coaching.MAX_TIP_LENGTH
