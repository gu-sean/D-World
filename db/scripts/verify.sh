#!/bin/sh
# 마이그레이션·smoke·개발 시드를 임시 DB에 적용한 뒤 삭제
# 접속 정보는 PGHOST/PGPORT/PGUSER/PGPASSWORD
# (docker 사용자는 backend 폴더에서 `npm run db:verify`를 쓴다)
set -eu
cd "$(dirname "$0")/../.."
DB="d_world_verify_$$"
PSQL="psql -v ON_ERROR_STOP=1 -q"
$PSQL -d postgres -c "CREATE DATABASE $DB" >/dev/null
trap '$PSQL -d postgres -c "DROP DATABASE IF EXISTS $DB" >/dev/null' EXIT
for f in db/migrations/*.sql; do $PSQL -d "$DB" -f "$f" >/dev/null; echo "migrated $f"; done
for f in db/tests/*.sql; do $PSQL -d "$DB" -f "$f" >/dev/null; echo "passed   $f"; done
for f in db/seeds/dev/*.sql; do
    $PSQL -d "$DB" -v admin_password_hash=verify-only -v user_password_hash=verify-only -f "$f" >/dev/null
    echo "seeded   $f"
done
