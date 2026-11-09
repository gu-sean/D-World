#!/bin/sh
# 논리 백업(pg_dump 커스텀 형식) + 계층 보관(일 7·주 4·월 12) + 무결성 확인
# 접속: PGHOST PGPORT PGUSER(dworld_backup 권장) PGPASSWORD PGDATABASE
# 설정: BACKUP_DIR(기본 ./backups), KEEP_DAILY(7) KEEP_WEEKLY(4) KEEP_MONTHLY(12)
# 실행: 하루 한 번 스케줄러(cron 등)에서, 예) 03:30
#   30 3 * * *  PGHOST=... PGUSER=dworld_backup PGPASSWORD=... PGDATABASE=d_world BACKUP_DIR=/var/backups/dworld /opt/dworld/db/ops/backup.sh
# 이 스크립트는 논리 백업만 한다. 15분 단위 시점 복구(PITR)가 필요하면 WAL 아카이빙을 따로 켠다(db/ops/README.md)
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
KEEP_MONTHLY="${KEEP_MONTHLY:-12}"
: "${PGDATABASE:?PGDATABASE 필요}"

STAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly" "$BACKUP_DIR/monthly"
FILE="$BACKUP_DIR/daily/${PGDATABASE}_${STAMP}.dump"
TMP="$FILE.partial"

# 1) 덤프: 소유자·권한은 복구 환경에서 다시 정하므로 제외, 진행 중 쓰기와 무관한 스냅샷
pg_dump --format=custom --no-owner --no-privileges --file="$TMP"

# 2) 무결성: 목차를 읽을 수 있고 비어 있지 않아야 함, 실패하면 불완전 파일은 지우고 종료
if ! pg_restore --list "$TMP" >/dev/null 2>&1 || [ ! -s "$TMP" ]; then
    rm -f "$TMP"
    echo "백업 검증 실패: $FILE" >&2
    exit 1
fi
mv "$TMP" "$FILE"
( cd "$BACKUP_DIR/daily" && sha256sum "$(basename "$FILE")" > "$(basename "$FILE").sha256" )

# 3) 주간(일요일)·월간(매월 1일) 사본
[ "$(date +%u)" = "7" ]  && cp "$FILE" "$FILE.sha256" "$BACKUP_DIR/weekly/"
[ "$(date +%d)" = "01" ] && cp "$FILE" "$FILE.sha256" "$BACKUP_DIR/monthly/"

# 4) 보관 개수 초과분 삭제(오래된 것부터)
prune() { # 디렉터리 개수
    ls -1t "$1"/*.dump 2>/dev/null | tail -n +"$(( $2 + 1 ))" | while read -r old; do
        rm -f "$old" "$old.sha256"
    done
}
prune "$BACKUP_DIR/daily" "$KEEP_DAILY"
prune "$BACKUP_DIR/weekly" "$KEEP_WEEKLY"
prune "$BACKUP_DIR/monthly" "$KEEP_MONTHLY"

echo "백업 완료: $FILE ($(wc -c < "$FILE") bytes)"
