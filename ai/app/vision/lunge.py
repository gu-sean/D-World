
from app.vision.squat import angle


class LungeCounter:
    def __init__(self):
        self.count = 0
        self.stage = "up"
        self.down_frames = 0

    def update(self, landmarks):
        # 엉덩이 - 무릎 - 발목
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

        # 초기 버전은 양쪽 다리가 보여야 함
        if len(angles) != 2:
            self.down_frames = 0
            return {
                "count": self.count,
                "stage": self.stage,
                "kneeAngles": [],
                "detected": False,
            }

        minimum_angle = min(angles)

        # 한쪽 무릎이 충분히 굽혀지면 내려간 상태
        if minimum_angle < 110:
            self.down_frames += 1

            if self.down_frames >= 2:
                self.stage = "down"

        # 양쪽 다리가 펴지면 1회 완료
        elif min(angles) > 155:
            if self.stage == "down":
                self.count += 1

            self.stage = "up"
            self.down_frames = 0

        else:
            self.down_frames = 0

        return {
            "count": self.count,
            "stage": self.stage,
            "kneeAngles": [
                round(value, 1) for value in angles
            ],
            "detected": True,
        }
