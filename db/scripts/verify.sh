#!/bin/sh
# 마이그레이션·smoke·개발 시드를 임시 DB에 적용한 뒤 삭제
# 접속 정보는 PGHOST/PGPORT/PGUSER/PGPASSWORD
set -eu
cd "$(dirname "$0")/../.."
DB="d_world_verify_$$"
PSQL="psql -v ON_ERROR_STOP=1 -q"
$PSQL -d postgres -c "CREATE DATABASE $DB" >/dev/null
trap '$PSQL -d postgres -c "DROP DATABASE IF EXISTS $DB" >/dev/null' EXIT
for f in db/migrations/*.sql; do $PSQL -d "$DB" -f "$f" >/dev/null; echo "migrated $f"; done
for f in db/tests/*.sql; do $PSQL -d "$DB" -f "$f" >/dev/null; echo "passed   $f"; done
$PSQL -d "$DB" -v admin_password_hash=verify-only -f db/seeds/dev/001_dev_reference.sql >/dev/null
echo "seeded   db/seeds/dev/001_dev_reference.sql"
