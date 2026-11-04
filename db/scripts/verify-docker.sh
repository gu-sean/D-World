#!/bin/sh
# [Docker 사용] 마이그레이션·smoke·개발 시드를 컨테이너의 임시 DB에 적용한 뒤 삭제
# 사전 준비: 저장소 루트에서 `docker compose up -d postgres` (healthy 확인)
# 컨테이너 안의 psql만 쓰므로 PC에 PostgreSQL을 설치하지 않아도 된다
# 다른 컨테이너를 쓰려면: PG_EXEC="docker exec -i <컨테이너>" PG_USER=<계정> sh db/scripts/verify-docker.sh
set -eu
cd "$(dirname "$0")/../.."
PG_EXEC=${PG_EXEC:-"docker compose exec -T postgres"}
PG_USER=${PG_USER:-dworld}
DB="d_world_verify_$$"
PSQL="$PG_EXEC psql -U $PG_USER -v ON_ERROR_STOP=1 -q"
$PSQL -d postgres -c "CREATE DATABASE $DB" >/dev/null
trap '$PSQL -d postgres -c "DROP DATABASE IF EXISTS $DB" >/dev/null' EXIT
# 파일은 표준 입력으로 넘겨서 컨테이너에 db 폴더가 마운트되지 않아도 동작
for f in db/migrations/*.sql; do $PSQL -d "$DB" < "$f" >/dev/null; echo "migrated $f"; done
for f in db/tests/*.sql; do $PSQL -d "$DB" < "$f" >/dev/null; echo "passed   $f"; done
for f in db/seeds/dev/*.sql; do
    $PSQL -d "$DB" -v admin_password_hash=verify-only -v user_password_hash=verify-only < "$f" >/dev/null
    echo "seeded   $f"
done
