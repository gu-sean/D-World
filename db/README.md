# D-World DB

## 개요
- 엔진: PostgreSQL 14+ (개발 compose는 16)
- 규모(014 기준): 테이블 93(+`schema_migrations`), 뷰 1, 함수 82, 트리거 95, FK 201, CHECK 459, 인덱스 317
- 스키마: `public` 단일, 마이그레이션 `001~014`를 번호 순서로 적용
- 시간 기준: 저장은 `timestamptz`, 일·월 집계(월간 한도, 스트릭)는 `Asia/Seoul`
- 식별자: 전 테이블 `uuid` PK, 앱이 생성

```
db/
  migrations/   001~014 (기능별 파일, 번호 = 적용 순서)
  seeds/dev/    개발용 시드 (001 기준 데이터, 002 콘텐츠·개발 사용자·공개 챌린지, assets)
  (시연용 가상 데이터는 SQL이 아니라 `backend/scripts/seed-demo.mjs`, 아래 "시연 데이터" 참고)
  scripts/      verify.sh (Docker 없이), verify-docker.sh (Docker)
  ops/          운영 기준·계정 분리·백업·복구 리허설·모니터링·마이그레이션 적용 절차 ([ops/README.md](ops/README.md))
  (줄바꿈 LF 고정은 저장소 루트 .gitattributes)
```
- 저장소 루트 `docker-compose.yml`: 개발용 Postgres 16, `./db`를 `/db`로 읽기 전용 마운트. MinIO는 `--profile minio`로만 뜬다(`bitnamilegacy/minio`, 버킷 `dworld-dev` 자동 생성)

## 설계 원칙
**소유자 무결성**
- 사용자 소유 테이블 41개, 타 테이블 참조는 `(id, user_id)` 복합 FK 33개로 소유자 일치를 DB가 강제
- 다른 사용자 데이터 참조는 FK 단계에서 거절

**불변·추가 전용**
- 원장·정책 버전·이력 23개 테이블은 트리거로 UPDATE·DELETE 제한 (전면 차단 또는 식별·금액 컬럼 고정)
- 대상: 포인트·XP·재고 원장, 보상표·레벨·가격·인증 기준·업적 버전, 지급 기록(업적·스트릭 마일스톤), 펫 등
- 정책 변경은 새 버전 행 추가, 기존 지급 내역은 지급 시점 버전을 계속 참조
- 삭제는 `users` 삭제 연쇄에서만 허용

**상태 전이**
- 상태 컬럼은 CHECK + 트리거로 허용 전이만 통과 (예: 결정은 한 번, 완료된 AI 실행 변경 불가)
- 상태와 시각 컬럼 정합성은 CHECK로 묶음 (`is_cancelled` ↔ `cancelled_at` 등)

**중복·동시성**
- 멱등 키 UNIQUE (`ingest_key`, `admin_idempotency_keys`, `user_idempotency_keys`, 원장 `idempotency_key`)
- "유효한 행은 하나"는 부분 UNIQUE 인덱스 (예: 같은 지급의 취소되지 않은 회수 청구)
- 잔액·한도는 지갑 행 잠금 아래 앱이 갱신, 음수 잔액·음수 미회수액은 CHECK가 차단

**탈퇴**
- `users` 삭제 시 하위 데이터 `ON DELETE CASCADE`, 신고·확정 챌린지 순위는 개인 식별만 지우고 보존
- 연쇄 삭제·SET NULL 경로의 FK(기준 데이터·`admin_accounts` 참조 제외)에도 인덱스 필수 (같은 테스트가 검사, 새 FK를 인덱스 없이 추가하면 실패)
- R2 파일은 `upload_status='deleted'` 확인 전 삭제 차단

## 마이그레이션
| 번호 | 내용 | 테이블 | 문서 |
|---|---|---|---|
| 001 | 계정, 소셜·휴대폰 로그인, 세션, 약관 문서·동의, 관리자, 이용 제한, 탈퇴 요청, 감사 로그 | 13 | 01, 02 |
| 002 | 목표, 단계, 미션 원형, 날짜별 실행 미션, AI 계획 제안 (운동 종류, 하루 가용 시간 포함) | 8 | 03, 04 |
| 003 | 수행 회차, 인증 판정, 이의 제기, R2 메타데이터 | 5 | 05, 06 |
| 004 | 포인트 지갑, 원장, 월간 한도, 미회수액, 미션 보상표 | 7 | 07, 08 |
| 005 | 스트릭 일별 판정, 마일스톤 보상 | 4 | 09, 10 |
| 006 | 업적, 배지 이미지, 획득 기록, 대표 배지 (`paid_points` 사후 보정), 소급 평가(백필) 요청·진행 커서 | 6 | 11, 12 |
| 007 | 사용자·펫 XP, 레벨 정책, 펫 성장·소유, XP 원장, 관리자 이미지 업로드 티켓(업적·펫 종류보다 이미지가 먼저 올라오는 순환 해소) | 16 | 13, 14 |
| 008 | 챌린지 공개·참여, 일별 인증, 순위, 정산, 보상 (+ 포인트 회수 청구 소스 확장, 보류 XP 배정), 정기 작업용 부분 인덱스 2개(챌린지 일별 pending, 스트릭 확정 대상 미션) | 12 | 15, 16 |
| 009 | 관리자·앱 요청 멱등 키, AI 판정 수신 키, 보상 지급 재시도 | 3 | |
| 010 | 상점 상품, 가격 버전, 주문, 보유 수량 | 5 | 17 |
| 011 | 문의·신고 (이벤트, 처리 결과 분리) | 3 | 18 |
| 012 | 공지, 회원별 알림, 푸시 기기 | 4 | 19 |
| 013 | 추천 문구, AI 분석 실행(재생성)·결과(재조정 전 계획, 리포트 피드백, 생성 미션 추천), 시간별 날씨(수집 대상 격자·정시 관측, 사용자·좌표와 연결하지 않음) | 7 | 20 |
| 014 | 표 설명(COMMENT)만 추가: 미사용 표 `challenge_score_snapshots`는 순위 뷰·최종 순위 표가 대신하므로 비어 있는 것이 정상 | 0 | |
| 합계 | | 93 | |

- 통합 이력: 보정 파일 014~017(2026-11-09)을 기능 파일 006·007·008·013에 합쳤다. 스키마는 통합 전과 동일(열·제약·인덱스·트리거·함수 2,237건 일치 확인)
- 통합 전 파일이 적용된 DB는 `ops/rebaseline.sh`로 이력만 맞추거나 재생성한다([ops/migration-runbook.md](ops/migration-runbook.md))

## 마이그레이션 정책
- 적용된 파일 수정 금지, 변경은 새 번호로 추가 (ORM 동기화 금지), 공유 후 보정은 `014`부터
- 보정이 쌓이면 첫 공유 배포 전에 한 번 기능 파일로 정리 (위 통합 이력 방식), 정리 후 기존 DB는 재생성하거나 `ops/rebaseline.sh`로 이력 전환
- 통합 전후 스키마 동일성은 열·제약·인덱스·트리거·함수 정의를 비교해 확인한다(통합 PR에 결과를 적는다)
- 적용기(`backend/scripts/migrate.mjs`)가 `schema_migrations`에 파일명·SHA-256 기록, 변경 시 오류, `order.txt`가 있으면 그 순서로, 없으면 파일명 순 실행
- 줄바꿈은 LF 고정 (루트 `.gitattributes`), CRLF로 저장하면 체크섬이 달라져 적용기가 "변경됨"으로 판단
- 각 파일은 자체 `BEGIN/COMMIT` 포함, 실패 시 전체 롤백
- 하위 호환 변경(컬럼 추가, 인덱스 추가) 우선, 컬럼 삭제·타입 변경은 데이터 이관 계획과 함께
- 머리 주석: 무엇을 왜 바꾸는지 2~5줄 (기존 보정 파일 형식 따름)

## 실행·검증
저장소 루트에서 실행. 두 방식 모두 순서는 마이그레이션 → smoke(시드 전) → 시드

**A. Docker 사용** (PC에 PostgreSQL 설치 불필요)
```sh
docker compose up -d postgres                 # Postgres 16, 계정 dworld / DB d_world
sh db/scripts/verify-docker.sh                # 임시 DB에서 일괄 검증 후 삭제
```
```sh
# 개발 DB(d_world)에 직접 적용
PSQL="docker compose exec -T postgres psql -U dworld -d d_world -v ON_ERROR_STOP=1 -q"
for f in db/migrations/*.sql; do $PSQL < "$f"; done
for f in db/seeds/dev/*.sql;  do $PSQL -v admin_password_hash='<hash>' -v user_password_hash='<hash>' < "$f"; done
```
- 다른 컨테이너를 쓰면 `PG_EXEC="docker exec -i <컨테이너>" PG_USER=<계정>`을 앞에 붙임
- 컨테이너 정리: `docker compose down` (데이터까지 지우려면 `-v`)

**B. Docker 없이** (로컬 PostgreSQL 14+ 와 `psql` 필요)
```sh
export PGHOST=localhost PGPORT=5432 PGUSER=<계정> PGPASSWORD=<비밀번호>
sh db/scripts/verify.sh                       # 임시 DB에서 일괄 검증 후 삭제
```
```sh
# 개발 DB(d_world)에 직접 적용
createdb d_world
for f in db/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d d_world -f "$f"; done
for f in db/seeds/dev/*.sql;  do psql -v ON_ERROR_STOP=1 -d d_world -v admin_password_hash='<hash>' -v user_password_hash='<hash>' -f "$f"; done
```

## 시연 데이터
- 목적: 시연·수동 테스트용으로 사용자 1명이 앱 기능을 한 번씩 쓴 상태를 만든다 (아래는 이 데이터를 처음부터 만드는 시드 스크립트)
- 방식: 원장·캐시·트리거 정합성을 SQL로 직접 맞추지 않고 **앱 API·서비스를 그대로 통과**시켜 생성 (`backend/scripts/seed-demo.mjs`)
- 선행: 마이그레이션 + 개발 시드 001·002 적용, `npm run build`
- 실행: `DEMO_USER_PASSWORD=... DATABASE_URL=... npm run db:seed:demo` (사용자가 이미 있으면 건너뜀, 다시 만들려면 DB 재생성)
- 로그인: 휴대폰 `01000000002` / `DEMO_USER_PASSWORD`, 사용자 id `d0000000-0000-4000-8000-000000000801`
- 만들어지는 것(각 1건): 계정(휴대폰·구글 연결·약관 동의·푸시 기기), 펫 선택·대표, 목표(활성)·단계, 미션 3개(승인·거절·대기), 인증 판정 승인(포인트·XP·스트릭 반영)·거절·이의 제기, 목표 완료로 업적 획득, 포인트 지급·상점 주문·인벤토리, 챌린지 참여, 공지 게시·알림, 문의, 시간별 날씨(서울 격자)·상황 추천, 주간 AI 리포트(가상)
- 비어 있는 테이블: 정산·순위·회수·탈퇴·모더레이션 등 **상태 전이가 더 필요한 것**, R2 파일(`media_files`), AI 계획 제안·재조정(AI 서버 필요), 펫 진화 기록(XP 부족)

## 앱이 지켜야 할 규칙
DB가 강제하지 않는 것만 정리

**트랜잭션**
- 포인트: `point_wallets` 행 잠금 → 한도 집계·원장·잔액·미회수액을 한 트랜잭션으로 (원장은 수정·삭제 불가)
- 인증 승인: 제출 번호 배정, 현재 판정 교체, 미션 완료, 보상 지급을 한 트랜잭션으로
- 판정 번복: 스트릭·마일스톤·챌린지 재계산을 포인트·XP·배지 회수와 같은 트랜잭션으로
- XP: 원장·캐시 잔액·레벨·진화 이력을 함께 갱신, 펫 XP 수령자는 수행 시작 때 고정 (대표 펫이 없으면 `pending_pet_experience`, 이후 수령 펫·종 버전·단계를 한 번만 채움)
- 업적 지급: 지급 행 생성 → 포인트 지급 → 필요 시 `paid_points` 보정 (월 한도로 줄어든 경우)
- 챌린지 지급: 참가자 한 명당 한 트랜잭션, 중복은 `challenge_reward_grants`와 원장 멱등 키가 차단, 실패는 `challenge_reward_payment_attempts`로 재시도
- 상점: 지갑 잠금 → `spend` 원장 → `shop_orders` → `user_inventory_events`, 환불은 미사용 수량만
- AI 제안 수락과 미션 생성, 재생성의 취소와 생성은 각각 한 트랜잭션
- 운동 종류: "분야가 exercise면 `exercise_code` 필수", "sensor면 running"은 앱이 검사 (DB는 코드가 있을 때 방식 일치만 확인)

**멱등성**
- AI 판정·분석 결과는 `ingest_key` 필수
- 관리자 변경 요청은 `admin_idempotency_keys`, 앱 요청은 `user_idempotency_keys`에 `in_progress`로 먼저 삽입, 같은 키·같은 `request_hash`면 저장된 응답 재생, 다르면 오류

**R2**
- 서버가 업로드 URL 발급 → 업로드 후 존재·크기·형식 확인 → `uploaded`로 변경
- 탈퇴: R2 정리 확인 → `upload_status='deleted'` → `users` 삭제

**탈퇴 순서**
- 비공개 미션 원형 먼저 삭제, 실행 미션이 참조하는 원형은 선정리
- 개인 펫 원장·참조 정리 후 삭제, 공용 펫 정책·단계 이미지는 보존
- 확정 챌린지 순위 표시명 익명화는 DB가 처리

**서버 작업**
- 단계 종료일 이후 필수 미션 완료 시 목표 자동 완료
- 예약 공지 게시, 회원별 알림 생성(`fanout_completed_at` 기록), 푸시 발송·재시도
- 푸시: 수신 설정 꺼짐·활성 기기 없음이면 `skipped`, 마케팅 공지는 동의 회원만
- 인증: 문자 발송 간격, 인증 만료 3분, 비밀번호 5회 실패 후 5분 제한, 세션 회전, 약관 재동의
- 업적 조건 변경·신규 공개 후 과거 활동 백필, 스트릭 업적은 `streak_milestone_awards`의 포인트 지급 재사용
- 재조정 수락: 단계·미션 변경과 `accepted_plan_json` 저장을 한 트랜잭션으로, 리포트·재조정은 `superseded_at` 기록 후 `generation_no`를 올려 재생성
- 문의·신고: 신고자 정보는 대상자·결과 안내에 노출 금지, 콘텐츠 조치는 기존 게시 상태 변경으로 실행하고 티켓에는 `content_action`만 기록

## 운영 전 필요한 값
- 사용자·펫 레벨 정책, 펫 단계 버전
- 스트릭 7·30·100일 보상
- 미션 보상표 (카테고리 × 난이도)
- 인증 판정 기준 (카테고리 × 방식)
- 월간 포인트 한도 (004 초기값 100,000P)
- 약관·개인정보 문서
- 004 적용 전 미션·템플릿은 보상 0P, 운영 데이터가 있으면 별도 보정 필요
- 없는 데이터: 펫 종류·단계 이미지, 배지 이미지, 공식 미션 템플릿, 상점 상품 (개발 시드 002에 임시값만 있음)

## 운영 기준
- 상세·수치·스크립트: [ops/README.md](ops/README.md), 마이그레이션 적용 절차: [ops/migration-runbook.md](ops/migration-runbook.md)
- 백업·복구: 매일 논리 백업(일 7·주 4·월 12 보관) + WAL 시점 복구, RPO 15분·RTO 1시간 목표, 복구 리허설 분기 1회
- 보존 기간: 멱등 키 24시간, 날씨 7일, 세션·인증번호·알림은 정기 정리(미구현), 원장 5년, 감사 로그 1년 이상(법무 확인 필요)
- 모니터링: 연결·장기 트랜잭션·잠금·데드락·죽은 행·복제 지연·정기 작업 적체 기준과 점검 쿼리(`ops/monitoring.sql`)
- 계정 분리: `dworld_migrator`(DDL) / `dworld_app`(DML만) / `dworld_readonly`(민감 테이블 제외) / `dworld_backup`(읽기)
- 파티셔닝: 현재 미적용, 단일 테이블 5천만 행·50GB 초과 시 검토
- 미정: 관리형 DB 사용 여부, R2 원본 보관 기간, 보존 기간의 법무 확인

## 알려진 제약
- 업적 `paid_points`는 원장 지급액과 DB가 대조하지 않음 (월 한도·미회수 상계 기준 확정 후 제약화)
- 챌린지 XP 실동작 smoke 없음 (`guard_experience_award`의 챌린지 분기는 함수 정의 검사로만 보호)
- `verify.sh`는 `psql` 필요, 로컬에 없으면 컨테이너로 같은 순서 실행
- 상점 취소는 보유 수량 행을 잠그지 않고 "주문 이후 사용 없음"을 확인 → 취소·사용 동시 요청 시 다른 주문분 재고가 있으면 사용 후 전액 환불 가능 (재고 부족이면 CHECK가 차단)
- e2e 테스트는 `DATABASE_URL`의 DB에 데이터를 남김 → 개발 DB가 아닌 별도 DB로 실행 ([backend/README.md](../backend/README.md#테스트))
