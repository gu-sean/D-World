
from app.vision.squat import angle


class PushupCounter:
    def __init__(self):
        self.count = 0
        self.stage = "up"
        self.down_frames = 0

    def update(self, landmarks):
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
            return {
                "count": self.count,
                "stage": self.stage,
                "elbowAngle": None,
                "detected": False,
            }

        elbow_angle = sum(angles) / len(angles)

        # 초기 실험값: 실제 영상으로 나중에 조정
        if elbow_angle < 106:
            self.down_frames += 1

            if self.down_frames >= 2:
                self.stage = "down"

        elif elbow_angle > 155:
            if self.stage == "down":
                self.count += 1

            self.stage = "up"
            self.down_frames = 0
        else:
            self.down_frames = 0

        return {
            "count": self.count,
            "stage": self.stage,
            "elbowAngle": round(elbow_angle, 1),
            "detected": True,
        }
