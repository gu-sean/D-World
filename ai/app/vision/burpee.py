
from app.vision.squat import angle


class BurpeeCounter:
    def __init__(self):
        self.count = 0
        self.stage = "waiting"
        self.last_pose = None
        self.stable_frames = 0

    def classify_pose(self, landmarks):
        # 왼쪽과 오른쪽 신체 중 잘 보이는 쪽 선택
        sides = [
            (11, 23, 25, 27),
            (12, 24, 26, 28),
        ]

        candidates = []

        for shoulder, hip, knee, ankle in sides:
            joints = [
                landmarks[shoulder],
                landmarks[hip],
                landmarks[knee],
                landmarks[ankle],
            ]

            visibility = min(
                getattr(p, "visibility", 1.0)
                for p in joints
            )

            if visibility < 0.5:
                continue

            knee_angle = angle(
                landmarks[hip],
                landmarks[knee],
                landmarks[ankle],
            )

            hip_angle = angle(
                landmarks[shoulder],
                landmarks[hip],
                landmarks[knee],
            )

            if knee_angle is None or hip_angle is None:
                continue

            s = landmarks[shoulder]
            a = landmarks[ankle]

            dx = abs(s.x - a.x)
            dy = abs(s.y - a.y)

            horizontal = (
                dx > 0.2 and dy / dx < 0.45
            )

            candidates.append(
                (
                    visibility,
                    knee_angle,
                    hip_angle,
                    horizontal,
                )
            )

        if not candidates:
            return "unknown"

        _, knee, hip, horizontal = max(
            candidates,
            key=lambda item: item[0],
        )

        # 초기 실험용 기준
        if horizontal and knee > 145 and hip > 145:
            return "plank"

        if knee < 120:
            return "crouch"

        if knee > 155 and hip > 150 and not horizontal:
            return "standing"

        return "transition"

    def update(self, landmarks):
        pose = self.classify_pose(landmarks)

        if pose == "unknown":
            self.last_pose = None
            self.stable_frames = 0
            return self.result(pose, False)

        if pose == self.last_pose:
            self.stable_frames += 1
        else:
            self.last_pose = pose
            self.stable_frames = 1

        # 같은 자세가 두 프레임 이상 유지됐을 때 처리
        if self.stable_frames < 2:
            return self.result(pose, True)

        if self.stage == "waiting":
            if pose == "standing":
                self.stage = "standing"

        elif self.stage == "standing":
            if pose == "crouch":
                self.stage = "crouching"

        elif self.stage == "crouching":
            if pose == "plank":
                self.stage = "planking"

        elif self.stage == "planking":
            if pose == "crouch":
                self.stage = "returning"

        elif self.stage == "returning":
            if pose == "standing":
                self.count += 1
                self.stage = "standing"

        return self.result(pose, True)

    def result(self, pose, detected):
        return {
            "count": self.count,
            "stage": self.stage,
            "pose": pose,
            "detected": detected,
        }
