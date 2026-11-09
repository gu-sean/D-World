
import argparse
import json
from pathlib import Path
from types import SimpleNamespace

import cv2
import mediapipe as mp

from app.vision.squat import SquatCounter
from app.vision.pushup import PushupCounter
from app.vision.lunge import LungeCounter
from app.vision.plank import PlankCounter
from app.vision.burpee import BurpeeCounter


EXERCISES = {
    "squat": SquatCounter,
    "push_up": PushupCounter,
    "lunge": LungeCounter,
    "plank": PlankCounter,
    "burpee": BurpeeCounter,
}

MODEL_PATH = Path("models/pose_landmarker_lite.task")


def analyze(exercise_code, video_path):
    if exercise_code not in EXERCISES:
        raise ValueError("지원하지 않는 운동입니다.")

    if not MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"MediaPipe 모델 파일이 없습니다: {MODEL_PATH}"
        )

    if not Path(video_path).is_file():
        raise FileNotFoundError(
            f"영상 파일이 없습니다: {video_path}"
        )

    capture = cv2.VideoCapture(str(video_path))

    if not capture.isOpened():
        raise RuntimeError("영상 파일을 열 수 없습니다.")

    fps = capture.get(cv2.CAP_PROP_FPS)

    if fps <= 0:
        capture.release()
        raise RuntimeError("영상 FPS 정보를 읽을 수 없습니다.")

    counter = EXERCISES[exercise_code]()
    analyzed_frames = 0
    detected_frames = 0
    frame_index = 0
    last_state = {}

    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(
            model_asset_path=str(MODEL_PATH)
        ),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_poses=1,
    )

    # 최대 15fps 수준으로 분석
    sample_step = max(1, round(fps / 15))
    last_timestamp_ms = -1

    try:
        with mp.tasks.vision.PoseLandmarker.create_from_options(
            options
        ) as landmarker:
            while True:
                success, frame = capture.read()

                if not success:
                    break

                frame_index += 1

                if (frame_index - 1) % sample_step != 0:
                    continue

                timestamp_ms = round(
                    (frame_index - 1) / fps * 1000
                )

                # VIDEO 모드 타임스탬프는 증가해야 함
                if timestamp_ms <= last_timestamp_ms:
                    timestamp_ms = last_timestamp_ms + 1

                last_timestamp_ms = timestamp_ms

                rgb = cv2.cvtColor(
                    frame, cv2.COLOR_BGR2RGB
                )

                image = mp.Image(
                    image_format=mp.ImageFormat.SRGB,
                    data=rgb,
                )

                pose_result = landmarker.detect_for_video(
                    image, timestamp_ms
                )

                analyzed_frames += 1

                if not pose_result.pose_landmarks:
                    # 사람이 사라졌다면 플랭크 시간 누적도 중단
                    if exercise_code == "plank":
                        counter.stage = "not_detected"
                        counter.previous_time = timestamp_ms / 1000
                    continue

                landmarks = pose_result.pose_landmarks[0]
                current_time = timestamp_ms / 1000

                if exercise_code == "plank":
                    height, width = frame.shape[:2]
                    # MediaPipe normalizes each axis independently.
                    # Use the same scale on both axes for posture geometry.
                    aspect_scale = height / width
                    scaled_landmarks = [
                        SimpleNamespace(
                            x=point.x,
                            y=point.y * aspect_scale,
                            visibility=point.visibility,
                        )
                        for point in landmarks
                    ]
                    last_state = counter.update(
                        scaled_landmarks, current_time
                    )
                else:
                    last_state = counter.update(landmarks)

                if last_state.get("detected"):
                    detected_frames += 1

    finally:
        capture.release()

    detection_ratio = (
        detected_frames / analyzed_frames
        if analyzed_frames else 0
    )

    result = {
        "exerciseCode": exercise_code,
        "engineVersion": "vision-rule@0.1.0",
        "analyzedFrames": analyzed_frames,
        "detectedFrames": detected_frames,
        "detectionRatio": round(detection_ratio, 3),
        "lastState": last_state,
        "validationStatus": "unverified",
    }

    if exercise_code == "plank":
        result["holdSeconds"] = round(
            counter.hold_seconds, 2
        )
    else:
        result["repCount"] = counter.count

    # 사람을 안정적으로 감지하지 못했다면 검토 필요
    result["decision"] = "review_required"

    return result


def main():
    parser = argparse.ArgumentParser(
        description="D-World 운동 5종 영상 분석"
    )
    parser.add_argument(
        "exercise",
        choices=EXERCISES.keys(),
        help="운동 종류",
    )
    parser.add_argument(
        "video",
        help="분석할 mp4 영상 경로",
    )

    args = parser.parse_args()

    result = analyze(args.exercise, args.video)

    print(json.dumps(
        result,
        ensure_ascii=False,
        indent=2,
    ))


if __name__ == "__main__":
    main()
