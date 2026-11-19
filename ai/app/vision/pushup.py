
from app.vision.attempts import AttemptLog
from app.vision.geometry import is_horizontal
from app.vision.squat import angle

# 팔꿈치 각도 기준 (초기 실험값: 실제 영상으로 조정)
DOWN_BELOW = 106  # 이보다 작으면 내려간 것
# 이보다 크면 팔을 편 것. 실제 폰 영상(2026-11-19, 옆에서 촬영)에서 빠르게 반복하면
# 위 자세 팔꿈치가 120~130°로 측정돼 155°로는 10회 중 1회만 셌다 → 115°
UP_ABOVE = 115
PARTIAL_BELOW = 112  # 여기까지는 굽혔지만 DOWN_BELOW에 못 미치면 '덜 굽힌 시도'

VISIBLE = 0.5

# 몸통 수평 판정 (to_square_coords 좌표 기준, 단위는 영상 너비)
# 푸쉬업 위 자세는 어깨가 발보다 높아 몸이 15~25도 기울어진다. 여유를 두어 약 35도(tan≈0.7)까지 허용
BODY_MAX_SLOPE = 0.7
# 어깨~발목은 화면에서 어느 정도 길어야 함 (멀리서 찍었거나 정면이면 판정 불가)
BODY_MIN_DX = 0.2
# 발목이 안 보이면 어깨~엉덩이로 판단 (몸통만 보이므로 더 짧아도 허용)
TORSO_MIN_DX = 0.1
# 엎드린 자세가 아닌 프레임이 이만큼 연속되면 내려간 상태를 취소 (15fps 기준 0.2초)
INVALID_FRAMES_TO_RESET = 3


def _visible(*points) -> bool:
    return min(getattr(p, "visibility", 1.0) for p in points) >= VISIBLE


def body_is_horizontal(landmarks) -> bool | None:
    """엎드린 자세인지. 판단할 관절이 안 보이면 None.

    서서 팔만 굽혔다 펴는 동작이 푸쉬업으로 집계되지 않도록 막는다.
    """
    seen = False
    for shoulder, hip, ankle in ((11, 23, 27), (12, 24, 28)):
        s, h, a = landmarks[shoulder], landmarks[hip], landmarks[ankle]
        if _visible(s, a):
            seen = True
            if is_horizontal(s, a, min_dx=BODY_MIN_DX, max_slope=BODY_MAX_SLOPE):
                return True
        elif _visible(s, h):
            seen = True
            if is_horizontal(s, h, min_dx=TORSO_MIN_DX, max_slope=BODY_MAX_SLOPE):
                return True
    return False if seen else None


class PushupCounter:
    """입력 좌표는 analyze_video의 to_square_coords를 거친 값이어야 한다."""

    def __init__(self):
        self.count = 0
        self.stage = "up"
        self.down_frames = 0
        self.invalid_frames = 0
        # 팔꿈치가 PARTIAL_BELOW까지는 굽었지만 DOWN_BELOW까지 못 간 동작 = 덜 굽힌 시도
        self.log = AttemptLog("push_up_shallow", PARTIAL_BELOW)

    @property
    def attempts(self) -> int:
        return self.log.attempts

    @property
    def events(self) -> list[dict]:
        return self.log.events

    def update(self, landmarks, timestamp_sec=None):
        # MediaPipe 관절 번호
        # 왼쪽: 어깨 11, 팔꿈치 13, 손목 15
        # 오른쪽: 어깨 12, 팔꿈치 14, 손목 16
        sides = [
            (11, 13, 15),
            (12, 14, 16),
        ]

        angles = []

        for shoulder, elbow, wrist in sides:
            joints = [
                landmarks[shoulder],
                landmarks[elbow],
                landmarks[wrist],
            ]

            if not _visible(*joints):
                continue

            value = angle(*joints)

            if value is not None:
                angles.append(value)

        if not angles:
            self.down_frames = 0
            return {
                "count": self.count,
                "stage": self.stage,
                "elbowAngle": None,
                "bodyHorizontal": None,
                "detected": False,
            }

        elbow_angle = sum(angles) / len(angles)
        horizontal = body_is_horizontal(landmarks)

        # 엎드린 자세가 아니면 집계하지 않는다. 몇 프레임 연속이면 내려간 상태도 취소
        # (엎드려 내려갔다가 일어서서 팔을 펴는 경우를 1회로 세지 않음, 한두 프레임 흔들림은 허용)
        if horizontal is not True:
            self.invalid_frames += 1
            if self.invalid_frames >= INVALID_FRAMES_TO_RESET:
                self.stage = "up"
                self.down_frames = 0
                self.log.reset()  # 쉬는 중(서거나 무릎 꿇기)은 시도로 보지 않는다
            return {
                "count": self.count,
                "stage": "invalid_posture",
                "elbowAngle": round(elbow_angle, 1),
                "bodyHorizontal": horizontal,
                "detected": True,
            }

        self.invalid_frames = 0
        self.log.track(elbow_angle, timestamp_sec, UP_ABOVE)

        # 초기 실험값: 실제 영상으로 나중에 조정
        if elbow_angle < DOWN_BELOW:
            self.down_frames += 1

            if self.down_frames >= 2:
                self.stage = "down"

        elif elbow_angle > UP_ABOVE:
            counted = self.stage == "down"
            if counted:
                self.count += 1
            self.log.complete(counted)

            self.stage = "up"
            self.down_frames = 0
        else:
            self.down_frames = 0

        return {
            "count": self.count,
            "stage": self.stage,
            "elbowAngle": round(elbow_angle, 1),
            "bodyHorizontal": True,
            "detected": True,
        }
