# D-World Backend

- 스택: NestJS 11, JavaScript(ESM), PostgreSQL(`pg`), SWC 빌드
- 보조 라이브러리: zod(환경 변수 검증), dayjs(KST 날짜), firebase-admin(`PUSH_DRIVER=fcm`일 때만 로드), jose(소셜 ID 토큰)
- 테스트: jest + ts-jest (ESM이라 `--experimental-vm-modules` 필요, 스크립트에 포함)
- 요구 사항: Node 22.9+
- 데코레이터는 SWC가 변환(`.swcrc`), `tsconfig.json`은 Nest CLI용 최소 파일
- 의존성 주입은 `@Dependencies(...)` + 생성자 인자 (타입 메타데이터 없음)
- 입력 검증은 DTO·ValidationPipe 없이 `common/validation.js` 규칙 함수 (`validateBody`)
- 문서
  - 설계: `docs/backend/`, 스키마: 루트 `db/`
  - 팀 문서와의 차이·모바일 계약 대응 현황: `docs/backend/09-team-contract-gap.md`
  - 로컬 e2e 실행: `docs/backend/10-local-e2e-guide.md`

## 실행

```sh
cp .env.example .env      # DATABASE_URL, JWT 키 2개 수정
npm install
npm run db:migrate        # 마이그레이션 적용
npm run start:dev
```

| 스크립트 | 설명 |
|---|---|
| `db:migrate` | 마이그레이션 적용 |
| `db:reset` | DB를 비우고 처음부터 적용 (개발·테스트 전용, `--db 이름`으로 DB 지정·생성) |
| `db:seed` | 개발 시드, `DEV_ADMIN_PASSWORD`·`DEV_USER_PASSWORD` 필요 (docker compose의 postgres 사용) |
| `db:verify` | 마이그레이션·smoke·시드 검증 (docker) |
| `demo` | 시연 DB 덤프(`db/dumps`) 복원 + `.env` 준비 + 빌드 + 서버 실행을 한 번에. Docker가 있으면 컨테이너, 없으면 설치된 PostgreSQL(psql)을 자동으로 씀. 시험 계정·환경별 방법은 `db/dumps/README.md` |
| `demo:reset` | `demo`와 같되 이미 복원돼 있어도 덤프로 DB를 덮어씀 |
| `demo:dump` | 지금 DB를 시연 덤프 파일로 다시 저장 |
| `demo:fill` | 비어 있는 시연 데이터(검수·제재·정산·진화 등)를 앱 경로로 채움 (선행: `npm run build`) |
| `demo:refresh` | 덤프 갱신 한 번에: 임시 DB 복원 → 마이그레이션 → 빌드 → `demo:fill` → 덤프 저장 |
| `push:check` / `weather:check` | FCM 키 / 날씨 공급자 점검 (아래 각 절) |
| `openapi:export` | `docs/openapi/backend.json` 생성 (먼저 `npm run build`, DB 연결 불필요) |
| `lint` / `format` | prettier 검사 / 적용 (ESLint 없음) |
| `test` / `test:e2e` | 단위 / 통합 |

- Swagger UI: `/docs` (`NODE_ENV`≠production일 때만)
- 관리자 생성: `ADMIN_PASSWORD=... node --env-file-if-exists=.env scripts/create-admin.mjs <login_id> <email>`

## 환경 변수

검증은 `src/config/env.validation.js` (zod). 누락·범위 초과 시 부팅 실패.

| 이름 | 설명 | 기본값 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 접속 문자열 (필수) | |
| `PORT` | 서버 포트 | 3000 |
| `NODE_ENV` | `development`, `production`, `test` | development |
| `ADMIN_WEB_ORIGIN` | 관리자 웹 Origin, 쉼표로 여럿 (비우면 CORS 비활성) | |
| `TRUST_PROXY` | 프록시 뒤에서 `X-Forwarded-For` 신뢰 | false |
| `DATABASE_POOL_MAX` | 풀 최대 연결 수 | 10 |
| `DATABASE_SSL` | TLS 사용 | false |
| `DATABASE_STATEMENT_TIMEOUT_MS` | 쿼리 1건 최대 실행 시간 | 30000 |
| `DATABASE_IDLE_TX_TIMEOUT_MS` | 트랜잭션 방치 허용 시간 | 60000 |
| `JWT_ACCESS_SECRET` | 앱 access token 서명 키, 32자 이상 (필수). 휴대폰 인증 단계 토큰·소셜 가입 토큰 서명에도 사용 | |
| `ADMIN_JWT_SECRET` | 관리자 access token 서명 키, 32자 이상, 위와 달라야 함 (필수) | |
| `PHONE_CODE_PEPPER` | 인증번호 해시용 서버 비밀, 32자 이상 | `JWT_ACCESS_SECRET` |
| `ACCESS_TOKEN_TTL_SEC` | 앱 access token 수명 | 1800 |
| `ADMIN_ACCESS_TOKEN_TTL_SEC` | 관리자 access token 수명 | 900 |
| `REFRESH_TOKEN_TTL_DAYS` | 앱 refresh token 수명 (관리자 세션은 12시간 고정) | 30 |
| `SMS_DRIVER` | 문자 발송, `console`만 구현 (개발 전용, 인증번호를 로그에 출력), 운영 공급자는 팀 결정 대기 | console |
| `PUSH_DRIVER` | 푸시 발송 `console`(개발 전용)/`fcm` | console |
| `FCM_SERVICE_ACCOUNT_JSON` | `PUSH_DRIVER=fcm`: 서비스 계정 JSON 문자열 | |
| `FCM_SERVICE_ACCOUNT_PATH` | `PUSH_DRIVER=fcm`: 서비스 계정 JSON 파일 경로 (위 값이 없을 때) | |
| `SOCIAL_DRIVER` | 소셜 검증 `real`/`mock`, `mock`은 `mock:{subject}:{email}` 토큰을 그대로 신뢰 (개발 전용) | real |
| `APPLE_CLIENT_ID` | Apple 로그인 클라이언트 ID | |
| `GOOGLE_CLIENT_IDS` | Google 클라이언트 ID, 쉼표 구분 | |
| `NAVER_PROFILE_URL` | 네이버 프로필 API | 공식 URL |
| `WEATHER_DRIVER` | 날씨 조회 `mock`(항상 맑음 20도)/`openweather`/`kma`(기상청 API허브) | mock |
| `OPENWEATHER_API_KEY` | `WEATHER_DRIVER=openweather`일 때 필요, 없거나 실패하면 날씨 없이 추천 | |
| `KMA_AUTH_KEY` | `WEATHER_DRIVER=kma`일 때 필수(없으면 부팅 거부), 실패하면 날씨 없이 추천 | |

| `STORAGE_DRIVER` | 인증 원본 저장소 `r2`/`memory`, `memory`는 개발 전용 | memory |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | `STORAGE_DRIVER=r2`일 때 필수 | |
| `R2_ENDPOINT` | S3 호환 주소(로컬 MinIO 등), 비우면 `R2_ACCOUNT_ID`로 R2 주소 | |
| `R2_KEY_PREFIX` | 객체 키 접두어 (환경 구분) | dev |
| `R2_CREATE_BUCKET` | 시작 때 버킷이 없으면 생성 (로컬 MinIO 전용) | false |
| `R2_UPLOAD_URL_TTL_SEC` | 업로드 URL 유효 시간(초) | 900 |
| `INTERNAL_API_TOKEN` | 내부 호출 공유 토큰, 32자 이상, 헤더 `X-Internal-Token` (비우면 AI 결과 수신·개발용 작업 실행 비활성) | |
| `AI_SERVICE_URL` | AI 서버 주소(호스트까지, 끝의 `/internal/v1`은 있어도 됨), `INTERNAL_API_TOKEN`과 함께 있어야 판정 요청 작업 활성 | |
| `BACKEND_PUBLIC_URL` | AI가 콜백을 보낼 이 서버의 공개 주소. AI의 `BACKEND_CALLBACK_URL`이 `{값}/internal/v1/ai-callbacks`와 **정확히 같아야** 함 | `http://localhost:{PORT}` |
| `AI_REQUEST_TIMEOUT_MS` | AI 서버 호출 기본 타임아웃(판정 접수 기준) | 10000 |
| `AI_MEDIA_ACCESS` | 판정 요청에 파일을 알리는 방식 `object_key`(키만)/`signed_url`(키+`downloadUrl`). `signed_url`은 AI 스키마가 `downloadUrl`을 받게 된 뒤에만 사용 | object_key |
| `AI_SIGNED_URL_TTL_SEC` | `signed_url` 방식일 때 AI 판정 요청에 실리는 서명 URL의 유효 시간(초), 요청·재시도마다 새로 발급 | 600 |
| `AI_SENSOR_ENABLED` | 러닝 센서 인증(I02)을 AI에 동기 호출로 보낼지. AI의 `POST /sensor/evaluations`가 준비되면 켠다. `false`면 센서 인증은 AI 없이 바로 관리자 검수 | false |
| `AI_SENSOR_TIMEOUT_MS` | 센서 판정(I02) 동기 호출 타임아웃 | 30000 |
| `AI_PHOTO_ENABLED` | 사진 증거를 AI에 보낼지. 현재 AI는 영상만 판정(`AI_UNSUPPORTED_MEDIA`)하므로 `false`면 사진은 AI를 거치지 않고 바로 관리자 검수(`review_required`)로 넘어감. 업로드는 사진·영상 모두 허용 | false |
| `AI_PLAN_TIMEOUT_MS` | 계획 생성(I03) 타임아웃, 앱은 70초까지 기다림 | 60000 |
| `AI_RECOMMEND_TIMEOUT_MS` | 상황 추천(I04) 타임아웃, 넘으면 규칙 기반으로 대체 | 15000 |
| `JOBS_DISABLED` | true면 이 프로세스의 정기 작업을 끔 (다중 인스턴스면 한 곳만 켜 둠) | false |
| `IDEMPOTENCY_RETENTION_HOURS` | 멱등 키 보관 시간, 지나면 정기 작업이 삭제 | 24 |

- 시간별 날씨(`WEATHER_DRIVER=kma`)
  - 추천 요청의 5km 격자만 `weather_grid_cells`에 기록, 좌표·사용자와 연결하지 않음 (저장: 격자 번호·날씨·기온)
  - `weather-collect`(10분): 최근 24시간 내 요청된 격자의 정시 관측을 `weather_observations`에 격자·시간당 1건 저장 (수집 완료 격자 건너뜀, 실패는 다음 주기 재시도, 1회 최대 200곳)
  - 추천은 DB의 최근 2시간 내 관측을 우선 사용, 처음 요청된 격자만 1회 직접 조회·저장
  - `weather-purge`(1시간): 7일 지난 관측, 7일 넘게 요청 없는 격자 삭제
- 운영(`production`) 거부: `SMS_DRIVER=console`, `PUSH_DRIVER=console`, `STORAGE_DRIVER=memory`, `SOCIAL_DRIVER=mock`
- `PUSH_DRIVER=fcm`은 `FCM_SERVICE_ACCOUNT_JSON` 또는 `_PATH` 필수
- **현재 운영 부팅 불가**: 문자 공급자가 `console`뿐 → 공급자 선정 후 구현 필요 (`auth/sms/sms-sender.js`)
- 문서(12 §8)에 없는 변수: `SOCIAL_DRIVER`, `WEATHER_DRIVER`, `OPENWEATHER_API_KEY`, `KMA_AUTH_KEY`, `FCM_SERVICE_ACCOUNT_*` → 이름 확정 필요
- 운영 권장: `PHONE_CODE_PEPPER` 별도 지정, 프록시 뒤면 `TRUST_PROXY=true` (아니면 IP 제한이 전원 공유)

## 마이그레이션

- `npm run db:migrate [디렉터리]`: 기본 `MIGRATIONS_DIR` 또는 `../db/migrations`
- 적용 순서: `order.txt`가 있으면 그 순서, 없으면 파일명 순 (현재 `001~014`)
- 적용 기록: `schema_migrations`(파일명, 체크섬), 적용분은 건너뜀
- 적용된 파일 수정 시 체크섬 불일치로 중단, 변경은 새 번호 파일로 추가
- 파일은 자체 BEGIN/COMMIT 전제, psql 메타 명령(`\if`)은 미지원

## 테스트

```sh
npm test                                                  # 단위 (test/unit)
export DATABASE_URL=postgres://...@localhost:5432/d_world_test
npm run db:reset -- --db d_world_test                     # 없으면 생성 후 처음부터 적용
npm run test:e2e                                          # 통합 (test/e2e), DATABASE_URL 없으면 건너뜀
```

- 현황(2026-11-13): 단위 237개, e2e 566개(50개 파일) 통과, **마이그레이션만 한 빈 DB**에서도 통과 (시드가 필요한 테스트는 필요한 정책·기준 데이터를 스스로 생성)
- **`.env` 없이 돌려도, 불러와서 돌려도 같은 결과**: `test/config/e2e-env.cjs`가 JWT 키·내부 토큰·`JOBS_DISABLED`·날씨 설정을 테스트용 값으로 채운다.
  `.env.example`에서 복사한 빈 값(`INTERNAL_API_TOKEN=`)이나 운영용 값(`JOBS_DISABLED=false`)이 들어와도 덮어쓴다 (셸에서 명시한 값은 존중)
- 새 e2e를 쓸 때: 시드된 DB에만 있는 데이터(레벨 정책, 분야 등)에 기대지 않는다. 필요하면 파일 안에서 만들고, 이미 있으면 건드리지 않는다
- 시연 데이터: `DEMO_USER_PASSWORD=... npm run db:seed:demo` (개발 시드 001·002 선행, 상세는 [db/README.md](../db/README.md#시연-데이터))
- `test/` 구성
  - `unit/`: DB 없는 계산·검증 함수
  - `e2e/`: 실제 PostgreSQL, 파일 단위 순차 실행
  - `support/`: 앱·사용자·관리자 호출 헬퍼, `jest-compat.js`(vitest식 `describe.skipIf`·`expect(값, 메시지)` 호환)
  - `config/`: jest·ts-jest 설정
  - `e2e/mobile-*`: 모바일 클라이언트 계약(A01~A130) 검증
- **e2e는 개발 DB에 돌리지 않음**
  - 별도 테스트 DB 안전장치가 없어 `DATABASE_URL`을 그대로 씀 → 테스트 데이터가 남음
  - 전체 사용자 대상 작업(스트릭·챌린지 확정)이 기존 데이터에 걸려 실패·타임아웃 가능
  - 셸에서 `DATABASE_URL`을 테스트 DB로 덮어씀
- 전체 실행 시간: e2e 전체 약 8~10분 (2026-11-13 이 PC에서 빈 DB 기준 약 8.5분)
- 주의: supertest는 `http.post()`를 만드는 즉시 서버를 열므로 `.send(await 다른요청())` 금지 (본문을 먼저 만듦)

## 구조

```
src/
  config/              환경 변수 검증 (zod)
  integrations/ai/     AI 서버 호출기(AiClient: 헤더·타임아웃·오류 분류), 전역 모듈
  database/            Pool, withTransaction, Queryable
  common/              errors(오류 형식·코드 표), idempotency, auth(토큰·세션·guard), pagination(AdminPage·limit),
                       catalog-code(분야·난이도 code↔UUID), http(X-Request-Id, 모바일 경로 별칭, 문자 발송 제한 판별), crypto(해시·서명 토큰),
                       time(KST, dayjs), masking, validation
  auth/                휴대폰·소셜 로그인, 인증번호, 세션 + mobile-auth.*(모바일 A01~A10)
  accounts/            프로필(`GET /me` 확장), 약관 동의, 이용 제한 검사
  home/                홈 요약 A29
  goals/               목표·단계·진행률, 분야·난이도·운동 종류(A19) 조회
  missions/            미션 생성(보상 확정)·조회·수정·취소·삭제, 상세(MissionDetail)
  mission-definitions/ 미션 틀, 공개 검수 신청, 다음 미션 추천(A36), 관리자 틀 관리·검수(M40~M44)
  verification/        판정 반영 + records/(수행 회차 A40~A46), ai/(I01 판정 요청·콜백 수신), review/(관리자 검수·이의 제기)
  media/               인증 원본(R2) 업로드·확인·삭제, 객체 키(storage/keys.js)
  ai-analysis/         AI 리포트 I05·계획 재조정 I06: 정기 작업(대상 선정·요청·만료), 결과 콜백 수신, 통계 집계(report-stats.js)
  ai-proposals/        계획 제안 수락·거절·만료, mobile-proposals.*(생성 A25~A28), plan-adjustments.*(재조정 A50~A53), rule-planner.js
  recommendations/     상황 추천 A90~A93, 날씨: weather.client.js(공급자 선택·DB 우선 조회), kma-weather.js(기상청 호출), weather-store.service.js(시간별 관측 저장), weather-collector.service.js(정기 수집)
  reports/             기간 요약 A60, AI 리포트 A61~A63, 달력 A64
  points/              포인트 지갑·원장, 관리자 거래 조회·수동 조정(M70·M71)
  experience-pets/     XP 원장·레벨·진화, 펫 선택·이름·대표, mobile-pets.*(펫 종류·진화 기록)
  achievements/        업적 평가·배지 지급·회수
  streak/              일별 스트릭 판정, 7·30·100일 마일스톤(포인트·XP)
  shop/                포인트 상점: 상품·주문·환불·보유·사용
  mobile-rewards/      인벤토리 A72, 포인트 내역 A74, 업적 목록 A76 (읽기 전용)
  challenges/          챌린지: 정의·공개, 참가, 일별 판정·순위, 정산·보상 지급, 사용자 개설·검수, mobile-challenges.*(A102~A107)
  notices/             공지 게시·알림 생성(NoticeDeliveryService), 푸시 발송(PushDeliveryService, push/push-sender.js)
  user-notifications/  앱 알림함·푸시 기기 등록/해제·공지 조회
  user-support/        앱 문의·신고 접수와 내 접수 내역
  user-withdrawal/     앱 회원 탈퇴 요청·철회 (처리는 관리자 M16, 완료는 정기 작업 withdrawal-complete)
  user-billing/        구독 A130 (501 껍데기)
  jobs/                정기 작업 실행기, JobLock, 개발용 수동 실행
  admin-auth/          관리자 로그인(쿠키), 감사 로그 기록·조회(M101), AdminMutationService(멱등 + 감사 공통 처리)
  admin-members/       관리자 회원·이용 조치·탈퇴 요청(M10~M16), 문의·신고 처리(M20~M24)
  admin-policies/      분야·난이도, 보상표, 판정 기준, 스트릭 금액, 월 한도, 레벨 정책
  admin-assets/        관리자 업적(M76~M78)·펫 종류(M79~M81)·이미지 업로드 티켓(M84·M85)
  admin-content/       관리자 공지(M90~M94)·약관 문서(M95~M97)·추천 문구(M98~M100)
  admin-dashboard/     관리자 대시보드(M05), 결제·구독 껍데기(M110, 501)
  health/              GET /health, /health/live
scripts/               migrate.mjs, seed.mjs(개발 시드), seed-demo.mjs(시연 데이터), create-admin.mjs, export-openapi.mjs
test/                  unit/(모듈별 단위), e2e/(실제 PostgreSQL, 파일명 *.e2e-spec.js), support/(앱·사용자·관리자 헬퍼), config/(jest 설정)
```

## 경로·응답 규칙

- 접두어: 앱 `/api/v1`(전역), 관리자 `/admin/v1`, 내부 `/internal/v1`, 헬스 `/health`(접두어 없음)
  - `src/app.setup.js`가 접두어·`X-Request-Id`·쿠키 파서·모바일 경로 별칭·없는 경로 404를 설정, `main.js`와 테스트가 공용
- 오류: `{ "error": { "code", "message", "details" } }`
  - 코드 표 `common/errors/error-codes.js`(팀 문서 05 §7), 서비스 내부 코드는 `LEGACY_CODE_MAP`으로 변환
  - 입력 오류는 `COMMON_VALIDATION_FAILED` + `details.fields`, 관리자 `reason` 오류는 `ADMIN_REASON_REQUIRED`
  - 표에 없는 도메인 코드는 대문자로 그대로 노출 (예: `STEP_HAS_HISTORY`)
- 분야·난이도: API는 `categoryCode`·`difficultyCode`, 전역 인터셉터가 UUID와 변환 (요청의 `categoryId`도 허용)
- 관리자 목록: `{ items, page, size, totalCount }`, `?page&size&sort`
- 관리자 변경 요청: `Idempotency-Key`와 `reason`(1~500자) 필수, 감사 로그에 성공·실패 기록
- 앱 멱등: `@Idempotent()` 요청은 키 필수, `@Idempotent({ optional: true })`(미션 생성·수정·취소, 목표 수정·삭제, 펫 선택)는 헤더가 있을 때만 처리
- 인증번호 발송 남용 방어: 번호당 30초 재발송 대기·시간당 5회(DB), IP당 분당 10회(`STRICT`)와 시간당 30건(`sms` 제한, 발송 경로만)
  - 대상: 회차 시작·제출, 업로드 URL(모바일 A43), 목표 생성, 계획 생성·수락, 재조정 수락, 추천 요청·수락, 챌린지 개설·참여·포기, 이의 제기, 문의 접수, 탈퇴 요청, 상점 주문
  - 모바일이 키를 보내는 미션 생성·수정·취소, 목표 수정·삭제 등은 서버가 키를 요구하지 않음 (헤더는 무시)
  - 같은 키·다른 본문 409 `COMMON_IDEMPOTENCY_KEY_REUSED`, 처리 중 409 `COMMON_REQUEST_IN_PROGRESS`, 실패한 요청은 키를 지워 재시도 가능
- DB 제약 위반은 SQLSTATE별로 409·422·503 변환, 원문은 서버 로그에만 기록

## 모바일 클라이언트 계약 (`mobile/src/client/api`)

- 정본은 팀 문서 08·07 (저장소에는 없음) → 모바일 목(mock) 서버 응답 모양을 기준으로 맞춤
- 대응 현황: 87개 경로 전부 구현, 목록은 `docs/backend/09-team-contract-gap.md` §4
- 맞추는 방식
  - 기존 응답에 모바일 키를 **더함** (기존 키 유지, 예: `stepId`와 `goalStepId` 공존)
  - 배열이 필요한 경로만 응답을 배열로 변경: `GET /shop/items`, `GET /me/challenges`
  - 경로·메서드만 다른 항목은 `common/http/mobile-compat.middleware.js`가 기존 API로 연결 (본문 그대로)
  - 새 경로는 `mobile-*` 파일로 분리
- AI 서버(10 문서) 규격 확정 전 **대체 구현**

| 기능 | 현재 구현 | 교체 지점 |
|---|---|---|
| 계획 생성 A25 (I03) | **AI 연동 완료**. AI 설정이 없을 때만 규칙 기반 (`ai-proposals/rule-planner.js`, `rule-plan@0.1.0`) | |
| 상황 추천 A90 (I04) | **AI 연동 완료**. AI 설정이 없거나 실패하면 규칙 기반 (`rule-rec@0.1.0`) | |
| 판정 요청 I01 | AI 계약대로 연동 (`vision-contract.js`), 영상만 AI 판정, 사진·센서는 관리자 검수 | AI 판정 정확도 검증 후 |
| 리포트 I05 · 재조정 I06 | **백엔드·AI 구현 완료** (경로 `/llm/reports`, `/llm/plan-adjustments` 확정, 백엔드 요청·AI 콜백이 서로의 검증을 통과함을 확인). 실제 생성은 AI의 `GEMINI_API_KEY` 필요 | |
| 러닝 판정 I02 | **백엔드 구현 완료** (`verification/ai/sensor-contract.js`, `AI_SENSOR_ENABLED=true`). AI의 `POST /internal/v1/sensor/evaluations` 라우터와 앱 러닝 파일 형식 어댑터는 AI 파트 작업 → 그 전에는 꺼 두고 센서 인증은 관리자 검수 | AI 라우터 |

- 목표 수정(A22): `startDate`·분야(`categoryCode`/`categoryId`)는 만든 뒤 바꿀 수 없다. 보내면 400 `COMMON_VALIDATION_FAILED`와
  `details.fields`(`startDate`·`categoryCode`: "수정할 수 없음"). 제목·설명·종료일·난이도·주당 횟수·하루 시간은 수정할 수 있다
- 승인 기록 `rewards`는 승인 때 `mission_records.metrics.rewards`에 저장해 그대로 돌려준다.
  저장분이 없는 이전 기록은 지급 기록·원장에서 복원한다: 포인트·XP는 지급 기록, 레벨업은 경험치 거래(`balance_after`)와
  계정에 고정된 레벨 정책 기준표, 펫 진화는 지급 직후 누적 경험치(`total_xp_after`)가 일치하는 `pet_evolution_events`, 새 배지는 같은 시각의 `user_achievements.awarded_at`.
  `streakDays`만 그 시점 값을 알 수 없어 현재 값을 쓴다 (`records.service.js`의 `grantedRewards`, e2e로 저장값과 일치함을 검증)
- 미해결
  - 모바일 멱등 요청은 헤더가 있으면 모두 재생 처리(`optional`), 서버가 키를 강제하지는 않음(기존 클라이언트 호환)

## 관리자 웹 계약 (`admin-web`)

- 기준: 관리자 웹이 화면에서 읽는 필드 (목 데이터 `admin-web/src/features/*/mocks.js`)
- 방식: 웹이 기대하는 필드를 **추가**로 내려줌 (기존 필드는 유지)
- 검증: `test/e2e/admin-web-contract.e2e-spec.js` (필드 존재만 확인)
- 호출 경로: 웹이 부르는 74개 경로는 모두 백엔드에 있음
- 맞춘 응답
  - 로그인·갱신: `{ admin, accessToken, expiresAt }` (+ 기존 `tokenType`, `expiresIn`), 리프레시는 쿠키로만
  - 대시보드: `queues`는 `[{type, count, oldestAt}]` 배열(verification·report·inquiry·withdrawal·appeal) + `activeUserCount`·`missionCount`·`pendingVerificationCount`·`openReportCount`·`aggregatedAt`, 전체 대기열은 `queueStats` 객체
  - 회원: 목록·상세에 `createdAt`·`maskedPhoneNumber`·`maskedEmail`·`restriction`, 상세에 `providers`·`availablePoints`·`levelNo`·`streakDays`·`goalCount`·`completedMissionCount`·`lastActivityAt`
  - 활동 `targetId`·`result`, 탈퇴 요청 `dataScope`(삭제·익명화·보존 예상 건수)
  - 문의·신고: `reporterNickname`·`assignedAdminLoginId`·`sameTargetOpenCount`·`targetId`·`targetSummary`, 이벤트 `adminLoginId`, 처리 `accountActionId`
  - 공지 `pushStats`(pending·sent·failed·skipped)
  - 월 한도·스트릭 마일스톤 목록은 `{ items }` (보상표·인증 기준은 배열 그대로)
  - 관리자 응답의 분야·난이도는 `categoryCode`와 `categoryId`(UUID)를 함께 (앱 API는 code만)
- 미확인: 변경(POST·PATCH) 응답 모양, 데이터가 있어야 보이는 중첩 필드(인증 결과 상세·챌린지 순위 등)

## AI 서버 연동 (I01)

- 요청: `AiDispatchService`(정기 작업 `ai-dispatch`)가 제출됐고 판정이 없는 회차를 `POST {AI_SERVICE_URL}/internal/v1/vision/analyses`로 보냄
  - 본문은 AI 계약 `VisionAnalysisRequest` (`ai/app/schemas/contracts.py`), 변환은 `verification/ai/vision-contract.js`
  - `ingestKey=vision:{recordId}:{submissionNo}`, 미디어는 1개(영상 우선, 없으면 사진), 저장소 키·체크섬·판정 기준·`callbackUrl` 포함
  - 접수는 202, 헤더 `X-Internal-Token`·`X-Request-Id`
- 재시도·포기
  - 일시 실패(연결·타임아웃·5xx·429·`AI_VISION_BUSY`)와 접수 후 무응답: 30초부터 2배씩(최대 1시간) 최대 8회
  - 영구 실패(4xx)·보낼 수 없는 회차(사진 증거, 센서 인증, 체크섬·운동 종류·판정 기준 없음): 즉시 `review_required` (판정 행 없음) → 관리자 검수 목록(M30)
  - 대기 중 건수·가장 오래된 제출 시각은 대시보드 `queues.aiPending`, 목록은 `GET /admin/v1/verifications?status=submitted`
  - 재시도 횟수는 프로세스 메모리 보관 → 재시작하면 처음부터 다시 셈
- 콜백: `POST /internal/v1/ai-callbacks` (기존 `.../verification-results`도 같은 처리), 헤더 `X-Internal-Token`
  - `status=completed`: `decision` 필수, 판정 반영 (같은 `ingestKey`는 첫 결과 반환)
  - `status=failed`: 판정 없이 회차를 `review_required`로, 이미 판정·종료된 회차는 `ignored`
  - `rawResult`는 선택 (없으면 받은 본문 전체 저장), 판정 기준 버전은 요청 시점 기준으로 서버가 결정
- 리포트 I05 (`ai-analysis/ai-reports.service.js`, 작업 `ai-report-dispatch` 10분)
  - 대상: 지난주(월~일)·지난달에 미션 계획이 있었는데 같은 기간 리포트 실행이 없는 활성 회원, 회원·기간당 1회
  - 요청 `POST /internal/v1/llm/reports` (`ReportRequest`: 통계, `callbackUrl=…/ai-callbacks/reports`), 일시 실패는 다음 주기에 다시(최대 5회), 영구 실패는 실행 실패
  - 콜백 `POST /internal/v1/ai-callbacks/reports`: 완료면 `ai_reports` 저장 → 실행 완료 → 알림(`reports/ai/{runId}`), 실패면 실행 실패, 이미 닫힌 실행은 `ignored`, 60분 안에 안 오면 `AI_NO_RESULT`로 실패
- 재조정 I06 (`ai-analysis/plan-adjustment-runs.service.js`, 작업 `plan-adjust-dispatch` 10분)
  - 대상: 지난주 계획 3건 이상인 활성 목표 중 원인이 있는 것, 회원당 달성률이 가장 낮은 목표 1개
  - 원인: 달성률 50% 미만(`low_completion`), 실패 3건 이상이면서 달성률 70% 미만(`overload`), 3일 이상 연속 결석(`missed_days`)
  - 이미 열린 제안이 있거나 남은 예정 미션이 없는 목표는 제외, `ingestKey=plan-adjust:{runId}:{goalId}`
  - 콜백 `POST /internal/v1/ai-callbacks/plan-adjustments`: 완료면 제안(`proposed`, 7일 유효) 저장 → 실행 완료 → 알림(`plan-adjustments/{id}`), 30분 안에 안 오면 실패, 기한이 지난 제안은 `expired`
  - 제안 `proposal_json`은 `{ steps: proposedPlan }`, `before_plan`은 `{ steps }`(콜백 시점의 남은 계획)
- 러닝 센서 I02: **동기 호출** `POST {AI_SERVICE_URL}/internal/v1/sensor/evaluations` (`SensorEvaluationRequest`, `ingestKey=sensor:{recordId}:{submissionNo}`, 파일은 저장소 키로 AI가 내려받음)
  - 응답 `SensorEvaluationResponse`를 콜백과 같은 `DecisionService` 경로로 저장, 계약과 다른 응답·AI 오류는 영구 실패 → 관리자 검수
  - `clientMetrics`는 앱 기록 지표(`distanceMeters`·`activeSeconds`·`steps`…) 중 계약에 있는 키만, `criteria.rules`(최소 시간·거리 등)를 그대로 전달
  - 켜는 조건: `AI_SENSOR_ENABLED=true` (AI 라우터 준비 후)
- 미디어: 카메라 증거는 사진·영상 합쳐 회차당 1개 (AI는 `media` 1개만 받음). **사진은 `AI_PHOTO_ENABLED=false`(기본)일 때 AI로 보내지 않고 바로 관리자 검수** — AI가 사진 판정을 구현하면 켠다
- 맞춰야 할 설정: `INTERNAL_API_TOKEN`(양쪽 동일), AI의 `BACKEND_CALLBACK_URL` = `{BACKEND_PUBLIC_URL}/internal/v1/ai-callbacks`
- 계획 생성 I03: `POST /internal/v1/llm/goal-plans` (동기, 60초)
  - 요청 `GoalPlanRequest`: 목표, 운동 종류 6종(A19), `generationNo`, `previousSummary`(이전 제안 요약), `ingestKey=goal-plan:{goalId}:{generationNo}`
  - 응답 `proposal`(`summary`, `steps`)을 그대로 `proposal_json`에 저장, 수락 때 기존 규칙으로 검증
  - **AI 실패는 규칙 기반으로 바꾸지 않고 앱에 전달**: AI가 준 `AI_LLM_UNAVAILABLE`·`AI_INVALID_OUTPUT`은 그대로, 코드 없는 502는 `AI_INVALID_OUTPUT`, 시간 초과 `AI_TIMEOUT`(504), 연결 실패·그 밖은 `AI_LLM_UNAVAILABLE`(503)
- 상황 추천 I04: `POST /internal/v1/llm/situational-recommendations` (동기, 15초)
  - 규칙 점수로 후보를 20개까지 추려 `context`·`profile`(최근 14일 완료율, 연속 일수 등)과 함께 보냄, 좌표는 보내지 않음
  - AI 응답은 후보 안의 id, 중복 없음, 순위 연속, 3개 이내일 때만 사용, 아니면 **규칙 기반으로 대체**(A90)
  - 호출은 트랜잭션 밖(읽기 → AI → 저장), 10분 제한은 호출 전에 확인
- 인증 기준 `criteria.rules` (`verification_criteria_versions.rules_json`, 판정 요청에 그대로 실림)
  - 빈 객체 `{}` = AI 서버 기본값 사용. 값을 준 키만 기본값 대신 쓴다
  - 허용 키: `minSteps`(정수 0~10,000,000), `minDurationSeconds`(정수 1~86,400), `minDistanceMeters`(0~1,000,000), `minConfidence`(0~1), `window`(`{start,end}` HH:MM, 이 시간대의 수행만 인정)
  - 관리자 등록 API(`POST /admin/v1/verification-criteria`)는 모르는 키·범위 밖 값을 400(`details.fields`)으로 거부 (`admin-policies/verification-rules.js`)
  - 시드: 운동 분야 센서 인증만 `{minDurationSeconds: 300, minDistanceMeters: 300}`, 나머지는 `{}`
  - **AI 서버(`analyze_run.py`)는 아직 rules를 읽지 않고 임계값(정확도 25m·공백 10초·8m/s)을 코드에 둔다** → 읽기 전까지 판정 동작은 바뀌지 않음(AI 파트 작업)
- **AI의 파일 접근(I01)**: 기본은 `AI_MEDIA_ACCESS=object_key`(AI가 저장소 키로 R2를 직접 읽음 → AI에 R2 읽기 키 필요). 운영에서는 `signed_url`로 바꾸는 것을 목표로 한다.
  - 현재 AI는 `VISION_MEDIA_SOURCE=r2`로 `objectKey`를 R2/MinIO에서 직접 내려받음 (AI README "영상 저장소"), 이때 AI에 R2 읽기 키 필요
  - 백엔드 준비 완료: `signed_url`이면 `media.downloadUrl`에 읽기 전용 서명 URL을 싣는다. 유효 시간은 `AI_SIGNED_URL_TTL_SEC`(기본 600초, 관리자 조회용 1시간과 별개), 요청·재시도마다 새로 발급
  - **AI 파트에 필요한 변경**: `VisionAnalysisRequest.media`에 선택 필드 `downloadUrl`(문자열) 추가(현재 `extra=forbid`라 켜면 400), 값이 있으면 R2 키 없이 그 URL로 내려받고 체크섬을 확인
  - 적용 뒤 백엔드 `AI_MEDIA_ACCESS=signed_url`로 전환. 운영(`NODE_ENV=production`)에서 AI를 켠 채 `object_key`면 시작 로그에 경고(시작을 막지는 않음)
- 미해결: 체크섬 없는 업로드 처리(현재 관리자 검수), 위 AI 파트 변경(`downloadUrl`) 반영

## 날씨 설정

- 상황 추천(A90)이 날씨를 사용, 못 가져오면 "날씨 없이" 추천 (서비스는 계속 동작)
- **기본값 `mock`은 항상 "맑음 20°C"** → 실제 날씨 아님

| `WEATHER_DRIVER` | 데이터 | 필요한 것 |
|---|---|---|
| `mock` (기본) | 항상 맑음 20°C | 없음 (개발·테스트용) |
| `kma` (실제 날씨 권장) | 기상청 API허브 초단기실황(기온·강수형태) + 초단기예보(하늘상태) | `KMA_AUTH_KEY` (없으면 서버가 뜨지 않음) |
| `openweather` | OpenWeather | `OPENWEATHER_API_KEY` |

### 기상청(`kma`) 켜기

1. https://apihub.kma.go.kr 에서 가입하고 인증키를 발급받는다.
2. **동네예보 중 "초단기실황조회"와 "초단기예보조회" 두 API를 모두 활용 신청**한다 (하나라도 빠지면 날씨를 못 읽는다).
3. `backend/.env`에 `WEATHER_DRIVER=kma`, `KMA_AUTH_KEY=<발급받은 키>`를 넣는다. (`npm run demo`로 만든 `.env`는 `mock`이라 이 두 줄만 바꾸면 된다)
4. **`npm run weather:check`로 점검**한 뒤 서버를 다시 띄운다.

### 점검 `npm run weather:check`

```sh
npm run weather:check                                   # 서울시청 좌표로 .env의 드라이버를 점검
npm run weather:check -- --lat 35.1796 --lon 129.0756   # 다른 좌표 (부산)
npm run weather:check -- --driver kma                   # .env와 다른 드라이버를 지정
```

`kma`는 API별 HTTP 상태와 결과 코드를 보여 주고, 실패하면 원인을 가려 알려 준다. 종료 코드는 정상 0, 문제 1.
(인증키는 출력하지 않는다. `openweather` 점검은 `npm run build`가 먼저 필요하다.)

| 결과 | 뜻·조치 |
|---|---|
| ✔ 기상청 날씨: clouds, 11°C | 정상 |
| HTTP 401/403 | 인증키가 틀렸거나 권한이 없다. 키를 다시 확인 |
| 결과 `[30]` 등록되지 않은 인증키 | `KMA_AUTH_KEY` 오타·미발급 |
| 결과 `[12]` 신청하지 않은 API | 초단기실황·초단기예보 **둘 다** 신청했는지 확인 |
| 결과 `[22]` 호출 한도 초과 / `[32]` 허용되지 않은 IP | 한도 확인 / API허브에서 서버 IP 등록 |
| 시간 초과·연결 실패 | 네트워크·방화벽·프록시 |
| 격자 밖 좌표 | 위도·경도 확인 (한반도 주변만 지원) |

### 앱에서 실제 날씨가 쓰이는 흐름 (`kma`)

- 좌표를 5km 격자로 변환해 기록 (좌표·사용자 미저장), DB의 **최근 2시간 내 관측**이 있으면 사용, 없으면(첫 요청 격자) 1회 직접 조회·저장
- 이후 `weather-collect`(10분)가 요청된 격자를 시간별로 수집 (환경 변수 표 아래 설명)
- 추천은 사용자당 10분 1회(`RECOMMENDATION_RATE_LIMITED`) → 점검은 `npm run weather:check` 권장
- 시연 데이터에 서울 격자(60,127)의 가짜 관측 1건 포함 → 그 시간대에는 기상청 미호출

## 푸시(FCM) 설정

- 발송 코드 구현 완료: `notices/push/push-sender.js`의 `FcmPushSender` (`PUSH_DRIVER=fcm`, `firebase-admin`)
- 쓸 수 없는 토큰(앱 삭제·만료)은 기기를 비활성화
- **키만 넣으면 서버는 동작**, 실제 도착은 앱이 기기 토큰을 등록해야 가능

| 단계 | 누가 | 내용 |
|---|---|---|
| 1 | Firebase 콘솔 | 프로젝트를 만들고(이미 있으면 재사용) Cloud Messaging을 켠다 |
| 2 | Firebase 콘솔 | 프로젝트 설정 → 서비스 계정 → **"새 비공개 키 생성"**으로 JSON을 받는다. 이 파일이 **서버용 키**다(앱용 `google-services.json`과 다름) |
| 3 | 서버 `.env` | `FCM_SERVICE_ACCOUNT_PATH=<JSON 파일 경로>` (또는 `FCM_SERVICE_ACCOUNT_JSON=<JSON 문자열>`). 키 파일은 저장소에 올리지 않는다. 파일 이름을 `service-account*.json` 또는 받은 그대로(`*-firebase-adminsdk-*.json`)로 두면 `.gitignore`가 막아 준다 |
| 4 | 서버 | **`npm run push:check`**로 키가 맞는지 점검 (아래) |
| 5 | 서버 `.env` | 점검이 통과하면 `PUSH_DRIVER=fcm`으로 바꾸고 서버를 다시 띄운다 |
| 6 | 앱 파트 | `@react-native-firebase/app`·`messaging` 설치, `android/app/google-services.json` 추가(커밋하지 않음), `App.jsx`에서 로그인 직후 `registerPushDevice()`·로그아웃 직전 `unregisterPushDevice()` 호출, 알림 탭 처리. 자세한 순서는 `mobile/src/setup/pushRegistration.js` 머리말 |

### 키 점검 `npm run push:check`

- 실제 알림 없이 FCM에 **dryRun(전송 검증 전용)** 요청을 1회 전송

```sh
npm run push:check                       # 키만 점검 (가짜 토큰으로 요청)
npm run push:check -- --token <기기 토큰>  # 그 기기 토큰까지 검증
```

| 결과 | 뜻 |
|---|---|
| ✔ 서비스 계정(키)이 정상 | 키가 맞다. 가짜 토큰이라 토큰 오류가 나는 것이 정상이다 |
| ✔ 서비스 계정과 기기 토큰이 모두 정상 | `--token`까지 통과 |
| ✖ 구글이 서비스 계정을 받아 주지 않아요 | 키가 폐기됐거나 다른 프로젝트의 것, 또는 Cloud Messaging 권한이 없다 |
| ✖ 키는 정상인데 기기 토큰이 틀림 | `--token`으로 준 토큰이 만료·삭제됐거나 다른 프로젝트의 앱 토큰이다 |
| ✖ FCM에 연결하지 못했어요 | 네트워크·방화벽·프록시 |
| ✖ 서비스 계정 JSON이 아닌 것 같아요 | 앱용 `google-services.json`을 넣었다 등. 서비스 계정 JSON(`type: service_account`)이어야 한다 |

- 종료 코드는 정상이면 0, 문제가 있으면 1이다. 출력에는 서비스 계정 이메일과 프로젝트 ID만 나오고 비밀키는 나오지 않는다.
- 점검 대상은 **서버 키**뿐, 앱의 토큰 등록·기기 도착은 6단계 이후 기기에서 확인
- 운영(`NODE_ENV=production`)에서는 `PUSH_DRIVER=console`을 환경 검증이 거부한다.

## 인증

- 기본 인증 필요, 공개 경로만 `@Public()`, 관리자 경로는 `@AdminOnly()`
- 새 활동(작성·제출·개설·참여) API에는 `@RequireActive()` (이용 제한·재동의 검사)
- 관리자 리프레시 토큰은 쿠키 `dw_admin_refresh`로만 전달
- 모바일 가입 흐름: A01 `verificationId` → A02 `verificationToken` → A05 가입
  - 두 토큰은 서명 토큰(`common/crypto/signed-token.js`, 용도 구분·만료 포함), 별도 표 없음
  - 인증번호 저장·제한은 `phone_verification_challenges` 그대로, 확인 후 유효기간 10분으로 연장
  - 소셜 신규 계정은 `signupRequired` + `socialSignupToken`(10분)으로 가입
- 로그아웃 `POST /auth/logout`: 본문 `refreshToken`이 있으면 그 세션 폐기(항상 204), 없으면 Bearer 세션 폐기
- 상세: `docs/backend/02-auth-design.md`

## 코딩 규칙

- 트랜잭션: `DatabaseService.withTransaction(fn)`
  - BEGIN → fn → COMMIT, 오류 시 ROLLBACK 후 재던짐
  - 40001·40P01만 최대 2회 재시도, fn은 재실행에 안전해야 함
  - 서비스 메서드는 `Queryable`로 받아 트랜잭션 안팎 공용
  - 트랜잭션 안에서 외부 호출(AI·저장소·문자·날씨) 금지, 커밋 뒤에 호출
- 타입: `date`는 문자열(`YYYY-MM-DD`), `bigint`·`numeric`은 pg 기본값인 문자열
- 날짜: 비즈니스 날짜 계산은 `common/time/kst.js`(dayjs)만 사용
- 이름: 팀 문서 03 §2 (줄임말 금지, CRUD 동사 `list`·`get`·`create`·`update`·`remove`)
- 보안: helmet, CORS는 `ADMIN_WEB_ORIGIN` 지정 시에만 활성
- 로그: 토큰·인증번호·좌표·전화번호 원문 금지 (`SMS_DRIVER=console`은 예외, 개발 전용)
- 헬스: `/health/live`는 프로세스, `/health`는 DB 연결 포함
- DB 결과 테이블 주의
  - `ai_reports`·`plan_adjustment_proposals`·`ai_mission_recommendations`는 **열린(`requested`) 실행에만** 삽입 가능 → 결과 삽입 후 실행을 `completed`로 변경
  - 결정 뒤 `ai_mission_recommendations`는 `status`·`decided_at`만 변경 가능
- 정기 작업(`jobs/jobs.service.js`, 목록은 [docs/backend/05](../docs/backend/05-verification-media-design.md#정기-작업-jobsmodule))
  - 배치는 건별 트랜잭션 + 건별 `try/catch`: 한 건 실패가 나머지를 막지 않게, 결과에 `failed` 건수
  - 재시도 간격 계산은 상한을 먼저 적용 (정수 거듭제곱 오버플로 주의)
  - 정상 종료한 작업은 결과 객체 반환, 예외는 `runJob`이 로그 후 `{ error }`로 삼킴
