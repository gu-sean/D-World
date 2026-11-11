
import math


def angle(a, b, c):
    """세 관절 좌표 사이의 각도 계산"""
    ab = (a.x - b.x, a.y - b.y)
    cb = (c.x - b.x, c.y - b.y)

    dot = ab[0] * cb[0] + ab[1] * cb[1]
    ab_len = math.hypot(*ab)
    cb_len = math.hypot(*cb)

    if ab_len == 0 or cb_len == 0:
        return None

    cosine = dot / (ab_len * cb_len)
    cosine = max(-1.0, min(1.0, cosine))

    return math.degrees(math.acos(cosine))


class SquatCounter:
    def __init__(self):
        self.count = 0
        self.stage = "up"
        self.down_frames = 0

    def update(self, landmarks):
        # MediaPipe 관절 번호
        # 23 왼쪽 엉덩이 / 25 왼쪽 무릎 / 27 왼쪽 발목
        # 24 오른쪽 엉덩이 / 26 오른쪽 무릎 / 28 오른쪽 발목
        sides = [
            (23, 25, 27),
            (24, 26, 28),
        ]

        angles = []

        for hip, knee, ankle in sides:
            joints = [
                landmarks[hip],
                landmarks[knee],
                landmarks[ankle],
            ]

            if min(
                getattr(p, "visibility", 1.0)
                for p in joints
            ) < 0.5:
                continue

            value = angle(*joints)

            if value is not None:
                angles.append(value)

        if not angles:
            return {
                "count": self.count,
                "stage": self.stage,
                "kneeAngle": None,
                "detected": False,
            }

        knee_angle = sum(angles) / len(angles)

        # 초기 실험값: 추후 실제 영상으로 조정
        if knee_angle < 105:
            self.down_frames += 1

            if self.down_frames >= 2:
                self.stage = "down"

        elif knee_angle > 155:
            if self.stage == "down":
                self.count += 1

            self.stage = "up"
            self.down_frames = 0

        return {
            "count": self.count,
            "stage": self.stage,
            "kneeAngle": round(knee_angle, 1),
            "detected": True,
        }
