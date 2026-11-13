# D-World AI

FastAPI 개발 서버와 운동 5종 영상 분석, 러닝 센서 기록 분석기를 포함합니다.

## Windows 실행

프로젝트의 ai 폴더에서 Python 3.11로 실행합니다.

~~~powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
$env:VISION_ENABLE_LOCAL = 'true'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
~~~

위 명령의 경로는 PowerShell에서 단일 역슬래시로 사용합니다.
MediaPipe 모델은 models/pose_landmarker_lite.task에 별도 준비하고 영상은 samples 폴더에 둡니다.
모델과 개인 촬영 영상은 저장소에서 제외했습니다.

## 현재 상태

- I01 POST /internal/v1/vision/analyses 개발용 비동기 접수와 결과 콜백
- POST /internal/v1/dev/vision/local-video 로컬 영상 테스트
- 운동 5종 코드 포함. 실제 샘플에서 푸쉬업과 런지 누락, 버피 0회 사례가 있어 추가 검증 필요
- 플랭크는 analyze_video.py에서 화면 비율 보정 적용
- 러닝 analyze_run.py는 임시 센서 JSON/gzip 형식을 사용하는 로컬 분석기. --demo로 실행 가능
- 목표 계획(I03)·상황 추천(I04) Gemini API 포함
- 주간·월간 리포트 I05 `POST /internal/v1/llm/reports`, 계획 재조정 I06 `POST /internal/v1/llm/plan-adjustments`: 202 접수 후 Gemini로 생성해 `callbackUrl`로 콜백
  - 같은 `ingestKey`는 멱등(내용이 다르면 409), 콜백 주소는 `BACKEND_CALLBACK_URL` 하위 `/reports`·`/plan-adjustments`만 허용
  - 실패는 `status=failed` + `failureReason`(`AI_LLM_UNAVAILABLE`, `AI_INVALID_OUTPUT`), 재조정 결과는 I03과 같은 검증(날짜·허용 운동·개수·가용 시간)

## 통합 시 확인할 사항

현재 저장소 백엔드는 /verification-requests로 요청하고 /internal/ai/verification-results로 콜백을 받는 구현입니다.
AI의 현재 I01 경로와 JSON 계약, 콜백 URL 및 인증 값을 팀과 조율해야 합니다.
영구 작업 큐는 구현 전입니다. 로컬 영상 API(`/dev/vision/local-video`, `VISION_MEDIA_SOURCE=local`)는 development 환경 전용입니다.
현재 영상 및 러닝 결과는 review_required로 반환합니다.
러닝의 활동 종류는 앱에서 받은 값을 사용하며 독립적인 이동 수단 분류 모델은 구현 전입니다.
현재 샘플 결과는 정확도 검증 완료를 의미하지 않습니다.

## 영상 저장소 (R2 / 로컬 MinIO)

- `VISION_MEDIA_SOURCE=local`(기본): `samples/` 폴더의 파일을 읽음, `APP_ENV=development` + `VISION_ENABLE_LOCAL=true`일 때만
- `VISION_MEDIA_SOURCE=r2`: 요청의 `media.objectKey`로 R2 버킷에서 임시 파일로 내려받아 분석 후 삭제
  - 설정: `R2_ENDPOINT`(비우면 `R2_ACCOUNT_ID`로 R2 주소), `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
  - 내려받기 상한 100MB, 확장자 mp4·mov·avi·webm, 크기·sha256은 요청 값과 대조
  - 실패는 실패 콜백의 `failureReason`: `AI_MEDIA_NOT_FOUND`, `AI_MEDIA_TOO_LARGE`, `AI_MEDIA_INTEGRITY_MISMATCH`, `AI_VIDEO_ANALYSIS_FAILED`
  - 로컬 MinIO: `docker compose --profile minio up -d minio` (루트), 버킷 `dworld-dev`, 계정 minioadmin/minioadmin
- 백엔드와 맞출 것: 백엔드는 `AI_MEDIA_ACCESS=object_key`(기본)로 키·체크섬을 전달, 백엔드의 `R2_*`와 같은 버킷·접두어 키를 AI가 읽을 수 있어야 함

## 테스트

~~~powershell
.\.venv\Scripts\python.exe -m pytest tests -q -o asyncio_default_fixture_loop_scope=function
~~~
