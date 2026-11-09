#!/bin/sh
# 마이그레이션 기준선 전환: 구 014~017 파일이 적용된 DB의 schema_migrations를 통합된 001~013 파일에 맞춘다
# 배경: 보정 파일 014~017을 기능 파일(006·007·008·013)에 합쳤다. 스키마는 완전히 같지만 파일 이름과
#       체크섬이 바뀌어 적용기(migrate.mjs)가 "적용된 마이그레이션이 변경됨"으로 멈춘다.
#       데이터를 지우지 않고 이력만 맞추려는 DB(스테이징·보존이 필요한 개발 DB)에 쓴다. 개발·테스트 DB는 reset이 더 간단하다.
# 하는 일: 현재 파일 목록·체크섬으로 이력 갱신, 더 이상 없는 파일(014~017)의 이력 삭제. 스키마는 건드리지 않는다.
# 안전장치: 통합 전 객체(014~017이 만든 테이블·인덱스)가 DB에 이미 있어야 하고, 기본은 확인만(--apply 필요)
# 사용: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE 설정 후
#   sh db/ops/rebaseline.sh            # 무엇을 바꿀지 출력만
#   sh db/ops/rebaseline.sh --apply    # 실제 반영(한 트랜잭션)
# 선행: 반드시 백업(db/ops/backup.sh) 후 실행
set -eu

DIR="${MIGRATIONS_DIR:-$(dirname "$0")/../migrations}"
APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1
: "${PGDATABASE:?PGDATABASE 필요}"

q() { psql -v ON_ERROR_STOP=1 -t -A -q "$@"; }

# 1) 구 014~017이 만든 객체가 모두 있어야 한다(없으면 통합 전 DB가 아니므로 중단)
MISSING="$(q -c "
  SELECT string_agg(x, ', ') FROM (VALUES
    ('challenge_daily_missions_pending_idx'), ('missions_streak_scan_idx'),
    ('admin_asset_uploads'), ('achievement_backfill_runs'),
    ('weather_grid_cells'), ('weather_observations')) v(x)
   WHERE to_regclass('public.' || x) IS NULL")"
if [ -n "$MISSING" ]; then
    echo "중단: 구 014~017 객체가 없음 ($MISSING). 통합 전 스키마가 아니거나 일부만 적용된 DB입니다." >&2
    exit 1
fi

# 2) 현재 파일의 체크섬(적용기와 같은 방식: 파일 바이트 SHA-256)
VALUES=""
for f in "$DIR"/*.sql; do
    name="$(basename "$f")"
    sum="$(sha256sum "$f" | cut -d' ' -f1)"
    VALUES="${VALUES}${VALUES:+,}('${name}','${sum}')"
done

PLAN="
  WITH files(filename, checksum) AS (VALUES ${VALUES})
  SELECT 'update' AS 작업, f.filename FROM files f
    JOIN schema_migrations m USING (filename) WHERE m.checksum <> f.checksum
  UNION ALL SELECT 'insert', f.filename FROM files f
    WHERE NOT EXISTS (SELECT 1 FROM schema_migrations m WHERE m.filename = f.filename)
  UNION ALL SELECT 'delete', m.filename FROM schema_migrations m
    WHERE NOT EXISTS (SELECT 1 FROM files f WHERE f.filename = m.filename)
  ORDER BY 1, 2"

echo "대상 DB: $PGDATABASE"
echo "변경 예정(작업|파일):"
q -c "$PLAN"

if [ "$APPLY" -ne 1 ]; then
    echo "확인만 했습니다. 반영하려면 --apply 를 붙이세요."
    exit 0
fi

q -c "
  BEGIN;
  WITH files(filename, checksum) AS (VALUES ${VALUES})
  DELETE FROM schema_migrations m
   WHERE NOT EXISTS (SELECT 1 FROM files f WHERE f.filename = m.filename);
  WITH files(filename, checksum) AS (VALUES ${VALUES})
  UPDATE schema_migrations m SET checksum = f.checksum
    FROM files f WHERE f.filename = m.filename AND m.checksum <> f.checksum;
  WITH files(filename, checksum) AS (VALUES ${VALUES})
  INSERT INTO schema_migrations (filename, checksum)
    SELECT filename, checksum FROM files f
     WHERE NOT EXISTS (SELECT 1 FROM schema_migrations m WHERE m.filename = f.filename);
  COMMIT;" >/dev/null
echo "반영 완료: schema_migrations $(q -c 'SELECT count(*) FROM schema_migrations')행"
