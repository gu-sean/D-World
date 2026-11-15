"""운동 카운터 단위 테스트 (영상·MediaPipe 없이 관절 좌표만으로 검증)."""

from types import SimpleNamespace

import pytest

from app.vision.geometry import to_square_coords
from app.vision.pushup import PushupCounter
from app.vision.squat import angle

# MediaPipe 관절 번호
L_SHOULDER, L_ELBOW, L_WRIST, L_HIP, L_ANKLE = 11, 13, 15, 23, 27


def pose(points: dict[int, tuple[float, float]], *, hidden: tuple[int, ...] = ()):
    """33개 관절. 지정하지 않은 관절은 보이지 않음(visibility 0)."""
    landmarks = [SimpleNamespace(x=0.0, y=0.0, visibility=0.0) for _ in range(33)]
    for index, (x, y) in points.items():
        landmarks[index] = SimpleNamespace(
            x=x, y=y, visibility=0.0 if index in hidden else 0.99
        )
    return landmarks


# 옆에서 찍은 엎드린 몸 (어깨가 발보다 조금 높음)
PRONE_BODY = {L_SHOULDER: (0.30, 0.50), L_HIP: (0.52, 0.55), L_ANKLE: (0.78, 0.60)}
# 서 있는 몸
STANDING_BODY = {L_SHOULDER: (0.50, 0.30), L_HIP: (0.50, 0.55), L_ANKLE: (0.50, 0.90)}


def arms(shoulder, *, bent: bool):
    sx, sy = shoulder
    wrist = (sx, sy + 0.2)
    elbow = (sx - 0.1, sy + 0.1) if bent else (sx, sy + 0.1)  # 90도 / 180도
    return {L_ELBOW: elbow, L_WRIST: wrist}


def prone(bent: bool, **kwargs):
    return pose({**PRONE_BODY, **arms(PRONE_BODY[L_SHOULDER], bent=bent)}, **kwargs)


def standing(bent: bool):
    return pose({**STANDING_BODY, **arms(STANDING_BODY[L_SHOULDER], bent=bent)})


def run(counter, frames):
    state = None
    for frame in frames:
        state = counter.update(frame)
    return state


def reps(frame_fn, n, hold=3):
    """n회 반복: 내려가기 hold프레임, 올라오기 hold프레임."""
    frames = []
    for _ in range(n):
        frames += [frame_fn(True)] * hold + [frame_fn(False)] * hold
    return frames


# ── 화면 비율 보정 ─────────────────────────────────────────


def normalized(px, py, width, height):
    return SimpleNamespace(x=px / width, y=py / height, visibility=1.0)


@pytest.mark.parametrize("width,height", [(1080, 1920), (1920, 1080), (720, 720)])
def test_square_coords_keep_pixel_angles(width, height):
    # 픽셀 기준 45도: (100,100) - (100,400) - (400,100)
    raw = [normalized(100, 100, width, height),
           normalized(100, 400, width, height),
           normalized(400, 100, width, height)]
    fixed = to_square_coords(raw, width, height)
    assert angle(*fixed) == pytest.approx(45.0, abs=0.01)


def test_raw_coords_distort_angle_on_portrait_video():
    # 보정 전에는 세로 영상에서 45도가 크게 틀어짐 (보정이 필요한 이유)
    raw = [normalized(100, 100, 1080, 1920),
           normalized(100, 400, 1080, 1920),
           normalized(400, 100, 1080, 1920)]
    assert abs(angle(*raw) - 45.0) > 10


def test_square_coords_rejects_bad_size():
    with pytest.raises(ValueError):
        to_square_coords([], 0, 1080)


# ── 푸쉬업 ────────────────────────────────────────────────


def test_pushup_counts_prone_reps():
    state = run(PushupCounter(), reps(prone, 5))
    assert state["count"] == 5
    assert state["bodyHorizontal"] is True


def test_pushup_ignores_standing_arm_bends():
    state = run(PushupCounter(), reps(standing, 5))
    assert state["count"] == 0
    assert state["stage"] == "invalid_posture"
    assert state["bodyHorizontal"] is False


def test_pushup_down_then_stand_up_is_not_a_rep():
    counter = PushupCounter()
    run(counter, [prone(True)] * 3)          # 엎드려 내려감
    run(counter, [standing(True)] * 3)       # 일어섬 (3프레임 → 내려간 상태 취소)
    state = run(counter, [standing(False)] * 3 + [prone(False)] * 3)
    assert state["count"] == 0


def test_pushup_tolerates_brief_posture_glitch():
    counter = PushupCounter()
    run(counter, [prone(True)] * 3)
    run(counter, [standing(True)] * 2)       # 2프레임 흔들림은 무시
    state = run(counter, [prone(False)] * 2)
    assert state["count"] == 1


def test_pushup_uses_torso_when_ankles_hidden():
    state = run(PushupCounter(), reps(lambda b: prone(b, hidden=(L_ANKLE,)), 3))
    assert state["count"] == 3


def test_pushup_not_counted_when_body_not_visible():
    # 팔만 보이고 몸통·다리가 안 보이면 자세를 판단할 수 없어 집계하지 않음
    frame = lambda b: prone(b, hidden=(L_HIP, L_ANKLE))
    state = run(PushupCounter(), reps(frame, 3))
    assert state["count"] == 0
    assert state["bodyHorizontal"] is None
