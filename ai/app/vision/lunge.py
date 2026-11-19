
from app.vision.attempts import AttemptLog
from app.vision.squat import angle


class LungeCounter:
    def __init__(self):
        self.count = 0
        self.stage = "up"
        self.down_frames = 0
        # 앞 무릎이 140°까지는 굽었지만 110°에 못 미친 동작 = 덜 굽힌 시도
        self.log = AttemptLog("lunge_shallow", 140)

    @property
    def attempts(self) -> int:
        return self.log.attempts

    @property
    def events(self) -> list[dict]:
        return self.log.events

    def update(self, landmarks, timestamp_sec=None):
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
        self.log.track(minimum_angle, timestamp_sec, 155)

        # 한쪽 무릎이 충분히 굽혀지면 내려간 상태
        if minimum_angle < 110:
            self.down_frames += 1

            if self.down_frames >= 2:
                self.stage = "down"

        # 양쪽 다리가 펴지면 1회 완료
        elif min(angles) > 155:
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
            "kneeAngles": [
                round(value, 1) for value in angles
            ],
            "detected": True,
        }
