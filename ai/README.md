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
- 목표 계획 및 상황 추천 Gemini API 포함

## 통합 시 확인할 사항

현재 저장소 백엔드는 /verification-requests로 요청하고 /internal/ai/verification-results로 콜백을 받는 구현입니다.
AI의 현재 I01 경로와 JSON 계약, 콜백 URL 및 인증 값을 팀과 조율해야 합니다.
R2 다운로드와 영구 작업 큐는 구현 전입니다. 로컬 영상 API는 development 환경 전용입니다.
현재 영상 및 러닝 결과는 review_required로 반환합니다.
러닝의 활동 종류는 앱에서 받은 값을 사용하며 독립적인 이동 수단 분류 모델은 구현 전입니다.
현재 샘플 결과는 정확도 검증 완료를 의미하지 않습니다.

## 테스트

~~~powershell
.\.venv\Scripts\python.exe -m pytest tests -q -o asyncio_default_fixture_loop_scope=function
~~~
