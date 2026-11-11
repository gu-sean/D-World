
import sys

import cv2
import mediapipe as mp

from app.vision.pushup import PushupCounter


MODEL_PATH = "models/pose_landmarker_lite.task"

if len(sys.argv) < 2:
    print("사용법: python test_pushup_video.py samples/pushup.mp4")
    sys.exit(1)

video_path = sys.argv[1]
capture = cv2.VideoCapture(video_path)

if not capture.isOpened():
    raise RuntimeError("영상 파일을 열 수 없습니다.")

fps = capture.get(cv2.CAP_PROP_FPS)

if fps <= 0:
    fps = 30

BaseOptions = mp.tasks.BaseOptions
PoseLandmarker = mp.tasks.vision.PoseLandmarker
PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
RunningMode = mp.tasks.vision.RunningMode

options = PoseLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=MODEL_PATH),
    running_mode=RunningMode.VIDEO,
    num_poses=1,
)

counter = PushupCounter()
frame_index = 0
detected_frames = 0

try:
    with PoseLandmarker.create_from_options(options) as landmarker:
        while True:
            success, frame = capture.read()

            if not success:
                break

            frame_index += 1

            # 약 15fps로 샘플링
            step = max(1, round(fps / 15))
            if frame_index % step != 0:
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image = mp.Image(
                image_format=mp.ImageFormat.SRGB,
                data=rgb,
            )

            timestamp_ms = round(
                (frame_index - 1) / fps * 1000
            )

            result = landmarker.detect_for_video(
                image,
                timestamp_ms,
            )

            if not result.pose_landmarks:
                continue

            state = counter.update(result.pose_landmarks[0])

            if state["detected"]:
                detected_frames += 1

            print(
                f"시간: {timestamp_ms / 1000:.1f}초 | "
                f"횟수: {state['count']} | "
                f"상태: {state['stage']} | "
                f"팔꿈치 각도: {state['elbowAngle']}"
            )
finally:
    capture.release()

print("\n===== 분석 결과 =====")
print("운동: push_up")
print("감지된 프레임:", detected_frames)
print("분석된 푸쉬업 횟수:", counter.count)
print("판정 정확도: 아직 검증하지 않음")
