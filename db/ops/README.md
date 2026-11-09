# DB 운영 기준

- 대상: 운영·스테이징 PostgreSQL (개발 DB는 해당 없음)
- 아래 수치는 일반적인 서비스 운영 기준을 초기값으로 정한 것이다. 트래픽·비용·법무 검토 후 조정한다
- 마이그레이션 적용 절차: [migration-runbook.md](migration-runbook.md)

## 파일
| 파일 | 용도 |
|---|---|
| `roles.sql` | 계정 4종 생성·권한 부여(재실행 가능) |
| `backup.sh` | 논리 백업(`pg_dump`) + 계층 보관 + 무결성 확인 |
| `restore-check.sh` | 최근 백업을 임시 DB에 복원해 검증(복구 리허설) |
| `monitoring.sql` | 점검 쿼리 10종(연결·잠금·bloat·적체 등) |
| `rebaseline.sh` | 구 014~017 적용 DB의 마이그레이션 이력을 통합본에 맞춤 |

## 1. 백업·복구
| 항목 | 기준 |
|---|---|
| 방식 | 관리형 DB면 제공 기능(자동 백업 + 시점 복구)을 우선 사용, 자체 운영이면 `backup.sh`(논리) + WAL 아카이빙(시점 복구) |
| 주기 | 논리 백업 매일 03:30(KST), WAL은 연속 |
| 보관 | 일간 7개 · 주간 4개 · 월간 12개(`backup.sh`가 자동 정리), WAL 7일 |
| 복구 목표 | RPO 15분(WAL 사용 시, 논리 백업만이면 24시간), RTO 1시간 |
| 저장 위치 | DB 서버와 다른 장소(다른 가용 영역·리전), 암호화, 백업 계정만 접근 |
| 필수 백업 시점 | 마이그레이션·대량 데이터 변경 직전(수동 실행) |
| 복구 리허설 | 출시 직후 월 1회, 이후 분기 1회, `restore-check.sh`로 자동 검증 후 결과 기록 |
| 알림 | 마지막 성공 백업이 25시간 넘으면 알림, 백업 스크립트 실패(종료 코드 1) 즉시 알림 |
- 백업 계정은 `dworld_backup`(읽기 전용)만 쓴다
- 복원은 운영 DB에 직접 하지 않고 새 인스턴스·임시 DB에 한 뒤 전환한다
- R2 파일은 DB 백업에 들어가지 않는다 → 버킷 버전 관리·수명 주기 규칙을 별도로 설정

## 2. 데이터 보존 기간
- 법정 보존 기간은 서비스 유형에 따라 다르다. 아래는 일반 기준이며 **출시 전 법무 확인 필요**

| 데이터 | 보존 | 방식 | 구현 |
|---|---|---|---|
| 멱등 키(`user_/admin_idempotency_keys`) | 24시간 | 정기 작업 삭제 | 구현(`IDEMPOTENCY_RETENTION_HOURS`) |
| 날씨 관측·수집 격자 | 7일 | 정기 작업 삭제 | 구현(`weather-purge`) |
| 이미지 업로드 티켓(`admin_asset_uploads`) | 7일 | 정기 작업 삭제 | 구현(`asset-uploads-cleanup`) |
| 인증번호(`phone_verification_challenges`) | 만료 후 7일 | 정기 작업 삭제 | 미구현 |
| 세션(`auth_sessions`·`admin_sessions`) | 만료·폐기 후 30일 | 정기 작업 삭제 | 미구현 |
| 알림(`user_notifications`) | 180일 | 정기 작업 삭제 | 미구현 |
| 관리자 감사 로그(`admin_audit_logs`) | 1년 이상(접속·처리 기록) | 삭제하지 않고 연 1회 아카이브 | 미구현 |
| 문의·신고(`support_tickets`) | 처리 후 3년(소비자 분쟁 처리 기록 기준) | 만료 후 익명화·삭제 | 미구현 |
| 포인트·경험치·주문 원장 | 5년(대금 결제·재화 공급 기록 기준) | 삭제하지 않음 | 탈퇴 후 개인 식별 제거 |
| 탈퇴 회원 개인정보 | 탈퇴 처리 완료 시 즉시 | `users` 삭제 연쇄 | 구현 |
- 미구현 항목은 백엔드 정기 작업으로 추가한다(작업 단위 100~1000건 배치, 건별 트랜잭션)
- 원장·감사 로그는 삭제 대신 **파티셔닝 후 오래된 파티션을 분리·아카이브**하는 방식으로 처리한다

## 3. 파티셔닝
- 현재 미적용. 단일 테이블이 5천만 행 또는 50GB를 넘으면 월 단위 범위 파티션을 검토
- 후보: `point_transactions`, `experience_transactions`, `admin_audit_logs`, `user_notifications`
- 판단 근거는 `monitoring.sql` 5번(테이블 크기·행 수)을 월 1회 기록해 증가 속도로 본다

## 4. 모니터링
- 서버 설정(권장): `shared_preload_libraries = 'pg_stat_statements'`, `log_min_duration_statement = 500ms`, `log_lock_waits = on`, `log_temp_files = 10MB`, `log_autovacuum_min_duration = 1s`, `track_io_timing = on`

| 지표 | 알림 기준 | 확인 쿼리 |
|---|---|---|
| 연결 사용률 | 최대 연결의 80% 초과 | `monitoring.sql` 1 |
| 오래 열린 트랜잭션 | 5분 초과 | 2 |
| 잠금 대기 | 30초 초과 | 3 |
| 데드락 | 1건 이상 | 4 |
| 캐시 적중률 | 95% 미만 | 4 |
| 죽은 행 비율 | 20% 초과(1만 행 이상) | 6 |
| 복제 지연 | 30초 초과 | 8 |
| 느린 쿼리 | 평균 500ms 초과 상위 10개를 주 1회 검토 | 9 |
| 정기 작업 적체 | 푸시·AI 판정 대기·공지·챌린지 pending이 계속 증가 | 10 |
| 디스크 사용률 | 80% 초과 | 인프라 지표 |
| 백업 | 마지막 성공이 25시간 초과 | 백업 스크립트·스케줄러 |
- 사용되지 않는 인덱스(7번)는 운영 4주 이상 지난 뒤에만 정리 후보로 본다

## 5. 계정 분리
| 계정 | 권한 | 쓰는 곳 |
|---|---|---|
| `dworld_migrator` | DDL(스키마 객체 소유) | 마이그레이션 적용 전용, 평소 접속 금지 |
| `dworld_app` | DML만(SELECT·INSERT·UPDATE·DELETE), DDL·TRUNCATE 불가, `schema_migrations` 접근 불가 | 백엔드 `DATABASE_URL` |
| `dworld_readonly` | SELECT만, 비밀번호 해시·토큰·세션·기기 등 민감 테이블 제외 | 분석·BI·수동 조회 |
| `dworld_backup` | 전체 읽기(`pg_read_all_data`) | `backup.sh` |
- 적용 순서: ① `roles.sql`(계정·기본 권한) → ② `dworld_migrator`로 마이그레이션 → ③ `roles.sql` 한 번 더(이미 만든 테이블 권한)
- 새 테이블이 `dworld_readonly`에 자동으로 열리므로, 민감 정보가 있으면 마이그레이션에서 REVOKE 하거나 `roles.sql` 제외 목록에 추가
- 비밀번호: 계정마다 다르게, 비밀 관리 도구에 보관, 90일마다 교체(`roles.sql`을 새 비밀번호로 재실행), 저장소에 커밋 금지
- 접속: 운영은 TLS 필수(`DATABASE_SSL=true`), 방화벽에서 앱 서버·백업 서버·관리망만 허용
- 개발·테스트 환경은 단일 계정(`dworld`)을 그대로 쓴다. 운영 전환 때 백엔드 환경 변수에서 `DATABASE_URL`(앱 계정)과 마이그레이션용 URL(migrator 계정)을 나눠 설정
- 시험 결과(2026-11-09): 앱 계정의 `CREATE TABLE`·`TRUNCATE`·`DROP TABLE` 거부, readonly의 민감 테이블 조회·쓰기 거부, 마이그레이션 이후 생성된 테이블에 앱 권한 자동 부여 확인