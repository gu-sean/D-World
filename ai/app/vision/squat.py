import math


def angle(a, b, c):
    """세 관절 좌표 사이의 각도 계산"""
    ab = (a.x - b.x, a.y - b.y)
    cb = (c.x - b.x, c.y - b.y)

    ab_len = math.hypot(*ab)
    cb_len = math.hypot(*cb)

    if ab_len == 0 or cb_len == 0:
        return None

    dot = ab[0] * cb[0] + ab[1] * cb[1]
    cosine = dot / (ab_len * cb_len)
    cosine = max(-1.0, min(1.0, cosine))

    return math.degrees(math.acos(cosine))


class SquatCounter:
    def __init__(self):
        self.count = 0
        self.stage = "up"
        self.down_frames = 0
        self.required_down_frames = 2
        self.rising_confirmed = False

    def update(self, landmarks):
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
            self.down_frames = 0
            self.rising_confirmed = False

            return {
                "count": self.count,
                "stage": self.stage,
                "kneeAngle": None,
                "detected": False,
            }

        knee_angle = sum(angles) / len(angles)

        if knee_angle < 105:
            self.down_frames += 1
            self.rising_confirmed = False

            if (
                self.stage == "up"
                and self.down_frames >= self.required_down_frames
            ):
                self.stage = "down"

        elif knee_angle > 155:
            self.down_frames = 0

            # 중간 각도를 거쳐 올라온 경우에만 집계
            if self.stage == "down" and self.rising_confirmed:
                self.count += 1
                self.stage = "up"
                self.rising_confirmed = False

        else:
            self.down_frames = 0

            if self.stage == "down":
                self.rising_confirmed = True

        return {
            "count": self.count,
            "stage": self.stage,
            "kneeAngle": round(knee_angle, 1),
            "detected": True,
        }