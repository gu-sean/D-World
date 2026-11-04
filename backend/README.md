# D-World Backend

NestJS 12 + JavaScript(ESM) + PostgreSQL(`pg`), 빌드 SWC, 테스트 vitest(로컬 전용, 저장소 미포함)
- 데코레이터는 SWC가 변환(`.swcrc`, 테스트는 `swc.vitest.js`), `tsconfig.json`은 Nest CLI 실행용 최소 파일
- 의존성 주입은 `@Dependencies(...)` + 생성자 인자 (타입 메타데이터 없음)
- `@Module()` 등 데코레이터는 `export` 앞에 작성
설계: `docs/backend/`(00~08), 스키마: 저장소 루트 `db/`
요구 사항: Node 22.9+

## 실행

```sh
cp .env.example .env      # DATABASE_URL 수정
npm install
npm run db:migrate        # 마이그레이션 적용
npm run start:dev
```

## 환경 변수

| 이름 | 설명 | 기본값 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 접속 문자열 (필수) | |
| `PORT` | 서버 포트 | 3000 |
| `CORS_ORIGINS` | 허용 Origin, 쉼표 구분 (비우면 CORS 비활성) | |
| `DATABASE_POOL_MAX` | 풀 최대 연결 수 | 10 |
| `DATABASE_SSL` | TLS 사용 | false |
| `DATABASE_STATEMENT_TIMEOUT_MS` | 쿼리 1건 최대 실행 시간 | 30000 |
| `DATABASE_IDLE_TX_TIMEOUT_MS` | 트랜잭션 방치 허용 시간 (초과 시 연결 종료) | 60000 |
| `NODE_ENV` | `development`, `production`, `test` | development |
| `JWT_ACCESS_SECRET` | 사용자 access token 서명 키(32자 이상), 인증번호 해시 키 겸용 (필수) | |
| `ADMIN_JWT_SECRET` | 관리자 access token 서명 키(32자 이상, 위와 달라야 함) (필수) | |
| `ACCESS_TOKEN_TTL_SEC` | 앱 access token 수명 | 1800 |
| `ADMIN_ACCESS_TOKEN_TTL_SEC` | 관리자 access token 수명 | 900 |
| `REFRESH_TOKEN_TTL_DAYS` | refresh token 수명 | 30 |
| `SMS_PROVIDER` | 문자 공급자, `console`은 개발 전용(운영 금지) | console |
| `APPLE_CLIENT_ID` | Apple 로그인 클라이언트 ID | |
| `GOOGLE_CLIENT_IDS` | Google 클라이언트 ID, 쉼표 구분 | |
| `NAVER_PROFILE_URL` | 네이버 프로필 API | 공식 URL |
| `TRUST_PROXY` | 프록시 뒤에서 X-Forwarded-For 신뢰 | false |
| `STORAGE_PROVIDER` | 인증 원본 저장소 `r2`/`memory`, `memory`는 개발 전용(운영 금지) | memory |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | `STORAGE_PROVIDER=r2`일 때 필수 | |
| `R2_UPLOAD_URL_TTL_SEC` | 업로드 URL 유효 시간(초) | 300 |
| `AI_INGEST_SECRET` | AI → 백엔드 판정 결과 수신용 공유 비밀(32자 이상), 비우면 수신 엔드포인트 비활성 | |
| `AI_SERVICE_URL`, `AI_SERVICE_SECRET` | 백엔드 → AI 판정 요청(규격 확정 전 임시), 둘 다 있어야 요청 작업 활성 | |
| `JOBS_ENABLED` | 이 프로세스에서 주기 작업 실행(다중 인스턴스면 한 곳만 권장) | false |

누락·범위 초과 시 부팅 실패

## 마이그레이션

- `npm run db:migrate [디렉터리]`: 기본 경로 `MIGRATIONS_DIR` 또는 `../db/migrations`
- 적용 순서: `order.txt`가 있으면 그 순서, 없으면 파일명 순(현재 `001~013`)
- 적용 기록: `schema_migrations`(파일명, 체크섬), 재실행 시 적용분은 건너뜀
- 적용된 파일 수정 시 체크섬 불일치로 중단, 변경은 새 번호 파일로 추가
- 파일은 자체 BEGIN/COMMIT 전제, psql 메타 명령(시드의 `\if`) 미지원

## 테스트

```sh
npm test                                        # 단위(test/unit)
DATABASE_URL=postgres://... npm run test:e2e    # 통합(test/e2e/*.e2e-spec.js), 마이그레이션 적용된 DB 필요, 없으면 건너뜀
npm run format:check
```

- 테스트는 `backend/test/` 아래에 모음(`unit/`, `e2e/`(통합), `support/`(앱·사용자 공용 헬퍼), `config/`), 로컬 전용이라 루트 `.gitignore`가 제외

## 구조

```
src/
  config/       환경 변수 검증
  database/     Pool, withTransaction, Queryable
  common/       errors(표준 오류 형식·`conflict`/`unprocessable`), time(KST·`TODAY_SQL`), auth(토큰·세션·guard), crypto, idempotency, validation(`idOf` 포함)
  auth/         휴대폰·소셜 로그인, 인증번호, 세션
  admin-auth/   관리자 로그인, 감사 로그, `AdminMutationService`(멱등 + 감사 로그 공통 처리)
  accounts/     프로필, 약관 동의, 이용 제한 검사
  points/       포인트 지갑·원장 서비스, GET /me/points
  experience-pets/  XP 원장·레벨·진화, 펫 선택·이름·대표 (GET /me/experience, /me/pets)
  achievements/ 업적 평가·배지 지급·회수 (GET /me/achievements)
  goals/        목표·단계·진행률, 카테고리·난이도 조회 (POST|GET /goals)
  missions/     미션 생성(보상 확정)·조회·수정·취소·삭제 (POST|GET /missions)
  mission-definitions/  미션 원형, 공개 검수 신청, 관리자 검수 (GET /mission-definitions, /admin/mission-definitions)
  ai-proposals/ AI 계획 제안 수락·거절·만료 (POST /goals/:id/proposals/:id/accept)
  media/        인증 원본(R2) 업로드 URL·확인·삭제 (POST /records/:id/media)
  streak/       일별 스트릭 판정, 연속 일수, 7·30·100일 마일스톤 (GET /me/streak)
  admin-policies/ 관리자 정책 API: 카테고리·난이도, 보상표, 판정 기준, 스트릭 금액, 월 한도, 레벨 정책 (/admin/catalogs, /admin/policies)
  challenges/   공식·사용자 개설 챌린지: 정의·공개, 참가·일별 미션, 일별 판정·순위, 정산·보상 지급 (/challenges, /admin/challenges)
  jobs/         주기 작업 실행기 (JOBS_ENABLED)
  verification/ 판정 반영(`decision.service`) + 하위 `records/`(수행 회차), `ai/`(AI 결과 수신·판정 요청), `review/`(관리자 보류 검수·이의 제기)
  health/       GET /health, GET /health/live
scripts/        migrate.mjs, create-admin.mjs
```

## 인증

- 모든 경로는 기본 인증 필요, 공개 경로만 `@Public()`, 관리자 경로는 `@AdminOnly()`
- 새 활동(작성·제출·개설·참여) API에는 `@RequireActive()`(이용 제한·재동의 검사)
- 설계·API 목록: `docs/backend/02-auth-design.md`
- 관리자 생성: `ADMIN_PASSWORD=... node --env-file-if-exists=.env scripts/create-admin.mjs <login_id> <email>`

## 규칙

- 트랜잭션: `DatabaseService.withTransaction(fn)`
  - BEGIN → fn → COMMIT, 오류 시 ROLLBACK 후 재던짐
  - 40001·40P01만 최대 2회 재시도, fn은 재실행에 안전해야 함
  - 서비스 메서드는 `Queryable`로 받아 트랜잭션 안팎 공용
- 타입
  - `date`는 문자열(`YYYY-MM-DD`), JS Date 시간대 밀림 방지
  - `bigint`·`numeric`은 pg 기본값인 문자열
- 날짜: 비즈니스 날짜 계산은 `common/time/kst.js`만 사용
- 경로(팀 문서 05 §1): 앱 `/api/v1`(전역 접두어), 관리자 `/admin/v1`, 내부 AI 콜백 `/internal/v1/ai-callbacks`(헤더 `X-Internal-Token`), 헬스체크 `/health`는 접두어 없음
  - `src/app.setup.js`가 접두어·없는 경로 404를 설정, main.js와 테스트가 공용으로 사용
- 오류 응답: `{ "error": { "code", "message", "details" } }` (팀 문서 05 §2.2)
  - 코드 표는 `common/errors/error-codes.js`(05 §7 원본), 서비스 내부 코드는 `LEGACY_CODE_MAP`으로 변환
  - 표에 없는 도메인 코드는 대문자로 그대로 노출(예: `STEP_HAS_HISTORY`)
  - 입력 오류는 `COMMON_VALIDATION_FAILED` + `details.fields`, 관리자 `reason` 누락은 `ADMIN_REASON_REQUIRED`
- 멱등 키
  - 관리자: 모든 변경 요청 필수(`admin_idempotency_keys`)
  - 앱: `@Idempotent()`가 붙은 요청만 필수(`user_idempotency_keys`) — 회차 시작·제출, 목표 생성, 챌린지 개설·참가, 이의 제기
  - 같은 키·다른 본문 409 `COMMON_IDEMPOTENCY_KEY_REUSED`, 처리 중 409 `COMMON_REQUEST_IN_PROGRESS`, 실패한 요청은 키를 지워 재시도 가능
  - DB 제약 위반은 SQLSTATE별로 409·422·503 변환, 원문은 서버 로그에만 기록
- 보안: helmet 적용, CORS는 `CORS_ORIGINS` 지정 시에만 활성
- 헬스: `/health/live`는 프로세스, `/health`는 DB 연결 포함(준비 상태)
