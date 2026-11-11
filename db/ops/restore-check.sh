#!/bin/sh
# 복구 리허설: 가장 최근 백업을 임시 DB에 복원하고 핵심 개수를 확인한 뒤 임시 DB를 지운다
# 접속: PGHOST PGPORT PGUSER(DB 생성 권한 필요) PGPASSWORD, 백업 위치 BACKUP_DIR(기본 ./backups)
# 실행: 분기마다 한 번(운영 DB에는 절대 복원하지 않는다, 별도 서버·임시 DB에서만)
#   BACKUP_DIR=/var/backups/dworld PGUSER=postgres PGPASSWORD=... ./restore-check.sh
# 성공 기준: 테이블 수·마이그레이션 수가 기대 값과 같고 users 조회가 됨
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
EXPECT_TABLES="${EXPECT_TABLES:-93}"          # schema_migrations 제외 업무 테이블 수
EXPECT_MIGRATIONS="${EXPECT_MIGRATIONS:-13}"  # 적용된 마이그레이션 파일 수
CHECK_DB="dworld_restore_check_$$"

LATEST="$(ls -1t "$BACKUP_DIR"/daily/*.dump 2>/dev/null | head -n 1 || true)"
[ -n "$LATEST" ] || { echo "백업 파일 없음: $BACKUP_DIR/daily" >&2; exit 1; }

# 체크섬 확인
( cd "$(dirname "$LATEST")" && sha256sum -c "$(basename "$LATEST").sha256" >/dev/null ) \
    || { echo "체크섬 불일치: $LATEST" >&2; exit 1; }

cleanup() { psql -d postgres -q -c "DROP DATABASE IF EXISTS $CHECK_DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql -d postgres -q -v ON_ERROR_STOP=1 -c "CREATE DATABASE $CHECK_DB"
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$CHECK_DB" "$LATEST"

TABLES="$(psql -d "$CHECK_DB" -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> 'schema_migrations'")"
MIGRATIONS="$(psql -d "$CHECK_DB" -t -A -c "SELECT count(*) FROM schema_migrations" 2>/dev/null || echo 0)"
USERS="$(psql -d "$CHECK_DB" -t -A -c "SELECT count(*) FROM users")"

echo "복원 대상: $LATEST"
echo "테이블 $TABLES (기대 $EXPECT_TABLES), 마이그레이션 $MIGRATIONS (기대 $EXPECT_MIGRATIONS), 회원 $USERS"
[ "$TABLES" = "$EXPECT_TABLES" ] || { echo "테이블 수 불일치" >&2; exit 1; }
[ "$MIGRATIONS" = "$EXPECT_MIGRATIONS" ] || { echo "마이그레이션 수 불일치" >&2; exit 1; }
echo "복구 리허설 성공"
