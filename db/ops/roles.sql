-- DB 계정 분리: 소유(마이그레이션)·앱·읽기 전용·백업을 서로 다른 계정으로 나눈다
-- 실행: 관리자(superuser 또는 CREATEROLE 권한) 계정으로, 대상 DB에 접속한 상태에서
--   psql -d <DB> -v ON_ERROR_STOP=1 \
--        -v migrator_password=... -v app_password=... \
--        -v readonly_password=... -v backup_password=... -f db/ops/roles.sql
-- 비밀번호는 저장소·로그에 남기지 말고 비밀 관리 도구에서 꺼내 넘긴다(변수 4개 모두 필수)
-- 여러 번 실행해도 안전하다(계정은 비밀번호만 갱신, 권한은 다시 부여)
-- 실행 시점: ① 마이그레이션 전(계정·기본 권한) → ② migrator로 마이그레이션 → ③ 이 파일을 한 번 더(기존 테이블 권한)
--
-- 계정 역할
--   dworld_migrator  DDL(테이블·인덱스·함수 생성·변경), 마이그레이션 전용, 평소 접속 금지
--   dworld_app       백엔드가 쓰는 계정, DML(SELECT/INSERT/UPDATE/DELETE)만, DDL·TRUNCATE 불가
--   dworld_readonly  분석·조회용, SELECT만, 개인정보·인증 비밀 테이블은 제외
--   dworld_backup    백업 전용, 전체 읽기(pg_dump)만

\if :{?migrator_password}
\else
    \echo 'migrator_password 변수가 필요함'
    \quit
\endif
\if :{?app_password}
\else
    \echo 'app_password 변수가 필요함'
    \quit
\endif
\if :{?readonly_password}
\else
    \echo 'readonly_password 변수가 필요함'
    \quit
\endif
\if :{?backup_password}
\else
    \echo 'backup_password 변수가 필요함'
    \quit
\endif

-- ── 1. 계정 생성(없을 때만) 후 비밀번호·한도 설정 ─────────────
SELECT 'CREATE ROLE dworld_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE'
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dworld_migrator') \gexec
SELECT 'CREATE ROLE dworld_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE'
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dworld_app') \gexec
SELECT 'CREATE ROLE dworld_readonly LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE'
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dworld_readonly') \gexec
SELECT 'CREATE ROLE dworld_backup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE'
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dworld_backup') \gexec

SELECT format('ALTER ROLE dworld_migrator PASSWORD %L CONNECTION LIMIT 5', :'migrator_password') \gexec
SELECT format('ALTER ROLE dworld_app PASSWORD %L CONNECTION LIMIT 50', :'app_password') \gexec
SELECT format('ALTER ROLE dworld_readonly PASSWORD %L CONNECTION LIMIT 10', :'readonly_password') \gexec
SELECT format('ALTER ROLE dworld_backup PASSWORD %L CONNECTION LIMIT 3', :'backup_password') \gexec

-- 계정별 기본 제한(백엔드의 DATABASE_STATEMENT_TIMEOUT_MS·IDLE_TX_TIMEOUT_MS와 같은 값, 이중 방어)
ALTER ROLE dworld_app SET statement_timeout = '30s';
ALTER ROLE dworld_app SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE dworld_readonly SET statement_timeout = '60s';
ALTER ROLE dworld_readonly SET default_transaction_read_only = on;
-- 마이그레이션은 오래 걸릴 수 있어 제한하지 않음, 잠금 대기만 짧게
ALTER ROLE dworld_migrator SET lock_timeout = '10s';

-- ── 2. 데이터베이스·스키마 접근 ───────────────────────────────
SELECT current_database() AS dbname \gset
REVOKE ALL ON DATABASE :"dbname" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"dbname" TO dworld_migrator, dworld_app, dworld_readonly, dworld_backup;

-- 아무나 public 스키마에 객체를 만들지 못하게 함
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO dworld_migrator;
GRANT USAGE ON SCHEMA public TO dworld_app, dworld_readonly, dworld_backup;

-- ── 3. 이미 있는 객체 권한 ────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dworld_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dworld_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dworld_readonly;
-- 백업 계정: 모든 테이블·시퀀스 읽기(PostgreSQL 14+)
GRANT pg_read_all_data TO dworld_backup;

-- 앱은 마이그레이션 이력 테이블을 읽을 필요가 없음
SELECT 'REVOKE ALL ON schema_migrations FROM dworld_app, dworld_readonly'
 WHERE to_regclass('public.schema_migrations') IS NOT NULL \gexec

-- 읽기 전용 계정에서 제외할 테이블: 비밀번호 해시·토큰·개인 식별 정보
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'phone_credentials', 'user_identities', 'phone_verification_challenges',
        'auth_sessions', 'admin_accounts', 'admin_sessions', 'push_devices',
        'user_idempotency_keys', 'admin_idempotency_keys'
    ] LOOP
        IF to_regclass('public.' || t) IS NOT NULL THEN
            EXECUTE format('REVOKE ALL ON public.%I FROM dworld_readonly', t);
        END IF;
    END LOOP;
END $$;

-- ── 4. 앞으로 만들 객체(migrator가 만드는 것) 기본 권한 ───────
ALTER DEFAULT PRIVILEGES FOR ROLE dworld_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dworld_app;
ALTER DEFAULT PRIVILEGES FOR ROLE dworld_migrator IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO dworld_app;
ALTER DEFAULT PRIVILEGES FOR ROLE dworld_migrator IN SCHEMA public
    GRANT SELECT ON TABLES TO dworld_readonly;
-- 새 민감 테이블은 readonly에 자동으로 열리므로, 만들 때 마이그레이션에서 REVOKE 하거나 위 목록에 추가할 것

\echo '계정 분리 완료: dworld_migrator / dworld_app / dworld_readonly / dworld_backup'
