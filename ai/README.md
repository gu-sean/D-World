# D-World AI

FastAPI 내부 서버. 운동 5종 영상 인증(MediaPipe), Gemini 목표 계획·추천·난이도·리포트·재조정을 맡는다.
백엔드만 이 서버를 부른다(`X-Internal-Token`).

## Windows 실행

ai 폴더에서 Python 3.11로 실행한다.

~~~powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env   # GEMINI_API_KEY, INTERNAL_API_TOKEN(백엔드와 같은 값, 32자 이상) 채우기
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
~~~

상태 확인: `GET http://127.0.0.1:8001/internal/v1/health` (Gemini 사용량 `llmQuota` 포함)

### 영상 인증을 로컬에서 끝까지 돌리기

1. MediaPipe 모델 (저장소에서 제외됨)
   ~~~powershell
   Invoke-WebRequest https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task -OutFile models\pose_landmarker_lite.task
   ~~~
2. 로컬 저장소 MinIO (저장소 루트, Docker Desktop 필요): `docker compose --profile minio up -d minio`
3. `ai/.env`
   ~~~dotenv
   VISION_MEDIA_SOURCE=r2
   VISION_ENGINE=mediapipe
   R2_ENDPOINT=http://localhost:9000
   R2_ACCESS_KEY_ID=minioadmin
   R2_SECRET_ACCESS_KEY=minioadmin
   R2_BUCKET=dworld-dev
   ~~~
4. 백엔드는 `backend/.env.minio`(STORAGE_DRIVER=r2 + 위 MinIO 값)를 마지막에 읽게 실행한다.
   `.env.supabase`에 팀 R2 계정이 있어 순서가 중요하다.
   ~~~powershell
   node --env-file=.env --env-file=.env.supabase --env-file=.env.minio dist/main.js
   ~~~
   백엔드 `.env`에는 `AI_SERVICE_URL=http://127.0.0.1:8001`, `BACKEND_PUBLIC_URL=http://localhost:3000`이 있어야 한다.
5. 에뮬레이터: `adb reverse tcp:3000 tcp:3000`, `adb reverse tcp:9000 tcp:9000`(업로드). 실제 사람을 찍으려면
   AVD `config.ini`에서 `hw.camera.back=webcam0`(노트북 웹캠).

## 기능

| 경로 | 내용 |
|---|---|
| `POST /internal/v1/vision/analyses` (I01) | 영상 분석 접수(202) → MinIO/R2에서 받아 MediaPipe 분석 → 판정 콜백 |
| `POST /internal/v1/llm/goal-plans` (I03) | 주차별 점진 목표 계획. 실패·형식 오류면 `local_goal_plan()` 대체(`LLM_PLAN_LOCAL_FALLBACK`) |
| `POST /internal/v1/llm/situational-recommendations` (I04) | 후보 미션 중 추천 + 이유 |
| `POST /internal/v1/llm/difficulty-recommendations` | 프로필 → 수행 기록 → 안전 검토 에이전트 |
| `POST /internal/v1/llm/reports` (I05) | 주간·월간 리포트(202 → 콜백) |
| `POST /internal/v1/llm/plan-adjustments` (I06) | 분석 → 계획 조정 → 안전 검토 → 필요 시 수정(202 → 콜백) |
| `POST /internal/v1/dev/vision/local-video` | `samples/` 영상 즉시 분석(개발 전용, `VISION_ENABLE_LOCAL=true`) |

### 영상 인증 판정 (`app/vision/decision.py`)

| 상황 | 판정 |
|---|---|
| 다른 인증에 이미 낸 영상(sha256 지문, `data/media_registry.sqlite3`) | 반려 `duplicate_media` |
| 영상 길이 > 회차 시작~제출 시간 + 15초 (미리 찍은 영상) | 반려 `recorded_before_start` |
| 사람 감지 프레임 < 30% | 반려 `person_not_detected` |
| 목표 달성 + 감지 ≥ 60% | **승인** → 백엔드가 포인트 지급 |
| 목표 달성이지만 감지 < 60% / 목표의 80% 이상 | 관리자 검토 |
| 그 밖 | 반려 `below_target` |

관리자 판정 기준 `rules_json`의 `minDetectionRatio`·`rejectDetectionRatio`·`borderlineRatio`로 값을 바꿀 수 있다.
`VISION_AUTO_DECISION=false`면 모두 관리자 검토(부정 플래그는 그대로 표시).
각 운동 카운터의 각도 기준값은 실제 영상으로 아직 보정 전이다(`algorithm_unverified` 플래그).

### 재조정 검증 (I06)

형식·기간·허용 운동·가용 시간(`plan_validation.py`)에 더해, 기존 계획보다 7일 넘게 일찍 끝나거나
운동별 최종 수치(기존 계획 마지막 미션)에 도달하지 않거나 운동이 빠지면 이유를 붙여 수정 에이전트에 한 번 더 맡긴다.
그래도 안 되면 `AI_INVALID_OUTPUT`으로 실패 콜백.

## 주요 설정 (`.env`)

| 키 | 기본값 | 뜻 |
|---|---|---|
| `LLM_MAX_REQUESTS_PER_MINUTE` / `_PER_DAY` | 5 / 100 | Gemini 호출 한도(재시도 포함, KST 자정 초기화). 넘으면 동기 API 429 `AI_LLM_QUOTA_EXCEEDED`, 백그라운드 작업은 최대 3분 대기 |
| `GEMINI_MAX_OUTPUT_TOKENS` | 16384 | 응답 길이 한도. 잘리면 `LlmTruncatedError` |
| `LLM_DIFFICULTY_MODE` | chain | `single`이면 난이도 추천을 Gemini 1회로(측정: chain 약 6초, single 약 3.4초) |
| `VISION_AUTO_DECISION` | true | 영상 자동 승인·반려 |
| `MEDIA_REGISTRY_PATH` | data/media_registry.sqlite3 | 제출 영상 지문 기록 |

비동기 작업 접수 기록(`app/core/job_ledger.py`)은 끝난 작업을 6시간 뒤 또는 1000건이 차면 지운다(진행 중 작업은 유지).
기록·호출 한도는 프로세스 메모리에 있어 서버를 여러 개 띄우면 서버마다 따로 센다.

## 테스트

~~~powershell
.\.venv\Scripts\python.exe -m pytest tests -q -o asyncio_default_fixture_loop_scope=function
~~~

`tests/`: 화면 비율 보정·푸쉬업 자세, 판정 규칙, 호출 한도, 작업 기록, 영상 지문, 재조정 검증.
