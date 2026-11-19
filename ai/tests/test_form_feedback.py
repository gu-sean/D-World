"""자세 피드백: 덜 굽힌 동작·무너진 자세를 찾아 몇 번째·몇 초인지 알려 주는지."""

import math
from types import SimpleNamespace

from app.vision.decision import judge
from app.vision.feedback import build_feedback
from app.vision.plank import PlankCounter
from app.vision.pushup import PushupCounter
from app.vision.squat import SquatCounter

FPS = 15


def blank():
    return [SimpleNamespace(x=0.0, y=0.0, visibility=0.0) for _ in range(33)]


def put(lm, index, x, y):
    lm[index] = SimpleNamespace(x=x, y=y, visibility=0.99)


def pushup_frame(elbow_deg):
    """옆에서 본 엎드린 몸 + 팔꿈치 각도 elbow_deg."""
    lm = blank()
    put(lm, 11, 0.30, 0.50)  # 어깨
    put(lm, 23, 0.52, 0.55)  # 엉덩이
    put(lm, 27, 0.78, 0.60)  # 발목
    ex, ey = 0.30, 0.60  # 팔꿈치 (어깨 바로 아래)
    put(lm, 13, ex, ey)
    t = math.radians(elbow_deg)
    put(lm, 15, ex + 0.1 * math.sin(t), ey - 0.1 * math.cos(t))  # 손목
    return lm


def squat_frame(knee_deg):
    lm = blank()
    kx, ky = 0.50, 0.70
    put(lm, 25, kx, ky)
    put(lm, 23, kx, ky - 0.2)  # 엉덩이 (무릎 위)
    t = math.radians(knee_deg)
    put(lm, 27, kx + 0.2 * math.sin(t), ky - 0.2 * math.cos(t))  # 발목
    return lm


def play(counter, angles, frame, start=0.0):
    t = start
    for a in angles:
        counter.update(frame(a), t)
        t += 1 / FPS
    return t


FULL = [170] * 3 + [90] * 4 + [170] * 3  # 끝까지 굽혔다 편 1회
SHALLOW = [170] * 3 + [110] * 4 + [170] * 3  # 110°까지만 굽힘 (기준 106°)
FAST_HALF_TOP = [125] * 3 + [65] * 4 + [125] * 3  # 실제 폰 영상: 위에서 팔이 125° 정도까지만 펴짐


def test_pushup_shallow_rep_is_not_counted_but_reported():
    c = PushupCounter()
    play(c, FULL + SHALLOW + FULL, pushup_frame)
    assert c.count == 2
    assert c.attempts == 3
    assert len(c.events) == 1
    event = c.events[0]
    assert event["attempt"] == 2 and event["code"] == "push_up_shallow"
    assert event["value"] == 110


def test_pushup_counts_reps_when_top_is_125_degrees():
    c = PushupCounter()
    play(c, FAST_HALF_TOP * 10, pushup_frame)
    assert c.count == 10


def test_tiny_twitch_is_not_an_attempt():
    c = PushupCounter()
    play(c, FULL + [170] * 3 + [120] * 3 + [170] * 3, pushup_frame)  # 120°: 거의 안 굽힘
    assert c.count == 1 and c.attempts == 1 and c.events == []


def test_squat_shallow_rep_reported():
    # 실제 영상(초당 15장)처럼 중간 각도를 거쳐 앉았다 일어난다
    smooth_full = [170, 170, 150, 130, 110, 95, 90, 90, 110, 130, 150, 170, 170]
    smooth_shallow = [170, 170, 155, 140, 130, 125, 125, 130, 140, 155, 170, 170]
    c = SquatCounter()
    play(c, smooth_full + smooth_shallow, squat_frame)
    assert c.count == 1
    assert [e["code"] for e in c.events] == ["squat_shallow"]


def test_feedback_sentence_names_attempt_time_and_angle():
    c = PushupCounter()
    play(c, FULL + SHALLOW + FULL + SHALLOW, pushup_frame)
    text, issues = build_feedback(c.events)
    assert "세지 않은 동작이 2번" in text
    assert "2번째(0:01)" in text and "4번째(0:02)" in text
    assert "팔을 덜 굽혔어요" in text and "평균 110°" in text and "106° 이하" in text
    assert [i["code"] for i in issues] == ["push_up_shallow", "push_up_shallow"]


def plank_frame(sag):
    """수평으로 엎드린 몸. sag면 엉덩이가 아래로 처짐(몸 각도 160° 미만)."""
    lm = blank()
    put(lm, 11, 0.20, 0.50)
    put(lm, 27, 0.80, 0.56)
    put(lm, 23, 0.50, 0.62 if sag else 0.53)
    return lm


def test_plank_sag_segment_reported_with_duration():
    c = PlankCounter()
    t = 0.0
    for sag, seconds in ((False, 5), (True, 3), (False, 5)):
        for _ in range(seconds * FPS):
            c.update(plank_frame(sag), t)
            t += 1 / FPS
    c.finish(t)
    assert len(c.events) == 1
    event = c.events[0]
    assert event["code"] == "plank_sag"
    assert 2.5 <= event["end"] - event["time"] <= 3.5
    text, _ = build_feedback(c.events)
    assert "엉덩이가 처졌어요" in text and "0:05~0:08" in text


def test_judge_reason_includes_feedback():
    c = PushupCounter()
    play(c, FULL * 3 + SHALLOW, pushup_frame)
    result = {"repCount": c.count, "detectionRatio": 0.9, "analyzedFrames": 300, "events": c.events}
    verdict = judge("push_up", 5, "reps", result)
    assert verdict.decision == "rejected"
    assert verdict.reason.startswith("목표 5회 중 3회만 확인됐어요.")
    assert "4번째" in verdict.reason and "팔을 덜 굽혔어요" in verdict.reason
    assert "form_feedback" in verdict.flags


def test_no_events_means_no_feedback():
    verdict = judge("push_up", 5, "reps", {"repCount": 5, "detectionRatio": 0.9, "analyzedFrames": 300})
    assert verdict.reason == "목표 5회 중 5회를 확인했어요."
