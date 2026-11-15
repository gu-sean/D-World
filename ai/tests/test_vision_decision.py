"""영상 인증 판정 규칙 테스트."""

import pytest

from app.vision.decision import judge


def reps(count, ratio=0.9, frames=300):
    return {"repCount": count, "detectionRatio": ratio, "analyzedFrames": frames}


def hold(seconds, ratio=0.9):
    return {"holdSeconds": seconds, "detectionRatio": ratio, "analyzedFrames": 300}


def test_target_met_is_approved():
    j = judge("push_up", 10, "reps", reps(10))
    assert j.decision == "approved"
    assert j.reason == "목표 10회 중 10회를 확인했어요."
    assert j.confidence == 0.9


def test_more_than_target_is_approved():
    assert judge("squat", 20, "reps", reps(23)).decision == "approved"


def test_plank_uses_hold_seconds():
    j = judge("plank", 30, "seconds", hold(31.4))
    assert j.decision == "approved"
    assert "30초" in j.reason


def test_near_target_goes_to_review():
    j = judge("lunge", 10, "reps", reps(8))
    assert j.decision == "review_required"
    assert "near_target" in j.flags


def test_far_below_target_is_rejected():
    j = judge("burpee", 10, "reps", reps(3))
    assert j.decision == "rejected"
    assert j.reason == "목표 10회 중 3회만 확인됐어요."


def test_person_not_visible_is_rejected_even_if_counted():
    j = judge("push_up", 5, "reps", reps(5, ratio=0.1))
    assert j.decision == "rejected"
    assert "person_not_detected" in j.flags


def test_low_detection_with_target_met_goes_to_review():
    j = judge("push_up", 5, "reps", reps(5, ratio=0.45))
    assert j.decision == "review_required"
    assert "low_detection" in j.flags


def test_unreadable_video_is_rejected():
    j = judge("squat", 5, "reps", reps(0, ratio=0, frames=0))
    assert j.decision == "rejected"
    assert "no_frames" in j.flags


def test_criteria_rules_override_defaults():
    # 관리자 기준에서 borderlineRatio를 낮추면 6/10도 반려 대신 검토로 간다
    rules = {"borderlineRatio": 0.5}
    assert judge("lunge", 10, "reps", reps(6), rules).decision == "review_required"
    assert judge("lunge", 10, "reps", reps(6)).decision == "rejected"


@pytest.mark.parametrize("bad", ["0.5", True, -1, 2, None])
def test_invalid_rule_values_fall_back_to_default(bad):
    assert judge("lunge", 10, "reps", reps(6), {"borderlineRatio": bad}).decision == "rejected"
