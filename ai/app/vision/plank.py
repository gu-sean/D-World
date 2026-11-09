
from app.vision.squat import angle


class PlankCounter:
    def __init__(self):
        self.hold_seconds = 0.0
        self.stage = "not_detected"
        self.previous_time = None

    def update(self, landmarks, timestamp_sec):
        # 어깨 - 엉덩이 - 발목
        sides = [
            (11, 23, 27),
            (12, 24, 28),
        ]

        angles = []

        for shoulder, hip, ankle in sides:
            joints = [
                landmarks[shoulder],
                landmarks[hip],
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

        current_time = float(timestamp_sec)

        if self.previous_time is None:
            delta_time = 0.0
        else:
            delta_time = max(
                0.0,
                min(current_time - self.previous_time, 0.25),
            )

        self.previous_time = current_time

        if not angles:
            self.stage = "not_detected"
            return {
                "holdSeconds": round(self.hold_seconds, 2),
                "stage": self.stage,
                "bodyAngle": None,
                "detected": False,
            }

        body_angle = sum(angles) / len(angles)

        # 각도가 160~180도면 몸통이 펴졌다고 가정
        # 단, 서 있는 자세도 이 조건을 만족할 수 있으므로
        # 몸통이 화면상 수평에 가까운지도 확인
        visible_sides = [
            (11, 23, 27),
            (12, 24, 28),
        ]

        horizontal = False

        for shoulder, hip, ankle in visible_sides:
            s = landmarks[shoulder]
            h = landmarks[hip]
            a = landmarks[ankle]

            if min(
                getattr(p, "visibility", 1.0)
                for p in (s, h, a)
            ) < 0.5:
                continue

            dx = abs(s.x - a.x)
            dy = abs(s.y - a.y)

            if dx > 0.2 and dy / dx < 0.45:
                horizontal = True
                break

        if body_angle >= 160 and horizontal:
            self.stage = "holding"
            self.hold_seconds += delta_time
        else:
            self.stage = "invalid_posture"

        return {
            "holdSeconds": round(self.hold_seconds, 2),
            "stage": self.stage,
            "bodyAngle": round(body_angle, 1),
            "detected": True,
        }
