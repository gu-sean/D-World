# 운영 DB 마이그레이션 적용 절차

- 대상: `db/migrations/001~014`(구 014~017을 기능 파일에 통합한 최종본, 구 001~017과 **스키마 동일**)
- 적용기: `backend/scripts/migrate.mjs`(`schema_migrations`에 파일명·SHA-256 기록, 적용된 파일이 바뀌면 오류)
- 마이그레이션에는 되돌리기(down)가 없다 → 되돌릴 때는 **적용 전 백업으로 복원**한다
- 각 파일은 자체 `BEGIN/COMMIT`이라 실패한 파일은 통째로 롤백되고 이후 파일은 적용되지 않는다

## 0. 경우 구분
| 경우 | 설명 | 절차 |
|---|---|---|
| A. 새 DB | 아직 아무것도 적용되지 않은 운영·스테이징 DB | 1 → 2 |
| B. 구 파일이 적용된 DB | 구 001~017(통합 전 파일 이름)이 이미 적용된 DB, 데이터 보존 필요 | 1 → 3 |
| C. 구 001~016만 적용 | 구 017(날씨)이 없는 DB | 1 → 3의 사전 단계 → 3 |
- 개발·테스트 DB는 데이터가 필요 없으면 `npm run db:reset`이 가장 간단하다(운영에서는 reset 거부)

## 1. 사전 준비(공통)
1. 적용 시간 공지, 쓰기 트래픽이 적은 시간대 선택
2. **백업**: `db/ops/backup.sh`로 수동 백업 후 `restore-check.sh`로 복원 가능 확인
3. 디스크 여유 확인(데이터 크기의 20% 이상), 장기 트랜잭션 없음 확인(`monitoring.sql` 2)
4. 계정 준비: `roles.sql`로 `dworld_migrator` 등 생성(`db/ops/README.md` 5)
5. 배포 순서: **DB 마이그레이션 → 앱 배포**(통합본은 기존 앱과 호환, 컬럼 삭제 없음)

## 2. 새 DB에 적용(경우 A)
```sh
export DATABASE_URL='postgres://dworld_migrator:<비번>@<호스트>:5432/d_world?sslmode=require'
cd backend
node scripts/migrate.mjs              # 001~014, "14개 적용 완료" 확인
```
1. `roles.sql`을 한 번 더 실행(이미 만든 테이블 권한 부여)
2. 확인: 업무 테이블 93개, 마이그레이션 13행
```sql
SELECT count(*) FROM information_schema.tables
 WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> 'schema_migrations'; -- 93
SELECT count(*) FROM schema_migrations;                                                         -- 13
```
3. 운영 기준 데이터(분야·난이도·보상표·레벨·약관·관리자 계정)는 개발 시드(`db/seeds/dev`)가 아니라 별도로 넣는다
   - 관리자 계정: `backend/scripts/create-admin.mjs`, 나머지는 관리자 API(M 정책)로 등록
4. 앱을 `dworld_app` 계정으로 기동 → `GET /health` 확인

## 3. 구 파일이 적용된 DB(경우 B·C)
구 014~017을 006·007·008·013에 합치면서 해당 파일의 체크섬이 바뀌었다. 그대로 `migrate.mjs`를 실행하면 "적용된 마이그레이션이 변경됨"으로 멈춘다. 스키마는 같으므로 이력만 맞춘다.

**사전 단계(경우 C만)**: 구 017(날씨 테이블)이 없는 DB는 객체부터 만든다.
```sh
git show 19c87a5:db/migrations/017_weather_observations.sql | psql -d <DB> -v ON_ERROR_STOP=1
```

**이력 전환**
```sh
export PGHOST=... PGPORT=5432 PGUSER=dworld_migrator PGPASSWORD=... PGDATABASE=d_world
sh db/ops/rebaseline.sh             # 변경 예정 확인(삭제 4건: 014~017, 수정 4건: 006·007·008·013)
sh db/ops/rebaseline.sh --apply     # 한 트랜잭션으로 반영
cd backend && node scripts/migrate.mjs   # "적용할 마이그레이션 없음" 이면 성공
```
- 구 014~017 객체(`challenge_daily_missions_pending_idx`, `missions_streak_scan_idx`, `admin_asset_uploads`, `achievement_backfill_runs`, `weather_grid_cells`, `weather_observations`)가 하나라도 없으면 스크립트가 중단한다
- 스키마·데이터는 바꾸지 않는다(`schema_migrations` 행만 갱신)

## 4. 적용 후 확인
- `migrate.mjs` 재실행 시 "적용할 마이그레이션 없음"
- 앱 헬스 체크, 주요 API(로그인·홈·미션 조회) 수동 확인
- `monitoring.sql` 1·3·10(연결·잠금·적체)이 평소 범위인지 확인
- 정기 작업 로그에서 `weather-collect`·`weather-purge` 등 신규 작업 오류 없음

## 5. 실패 시
| 상황 | 조치 |
|---|---|
| 파일 하나가 실패 | 그 파일은 롤백됨. 원인 수정 후 같은 명령 재실행(앞 파일은 건너뜀) |
| 적용 후 문제 발견 | 앱 배포 중단 → 사전 백업을 **새 인스턴스에 복원** → 이상 없으면 전환, 원인 분석 후 재시도 |
| `schema_migrations`와 파일 불일치 | 파일을 되돌리지 말고 원인을 확인(누가 적용된 파일을 고쳤는지). 이력만 어긋난 경우에 한해 `rebaseline.sh` |

## 6. 이후 변경 규칙
- 적용된 파일은 수정하지 않고 새 번호(`014`부터)로 추가한다. 보정이 쌓이면 첫 공유 배포 전에 다시 기능 파일로 통합한다(이번과 같은 방식)
- 큰 테이블의 인덱스 추가는 `CREATE INDEX CONCURRENTLY`(트랜잭션 밖)로 별도 파일에서 수행해 쓰기 잠금을 피한다
- 컬럼 삭제·타입 변경은 데이터 이관 계획과 함께, 하위 호환 변경(추가)을 우선한다

## 체크리스트
- [ ] 공지·시간대 확정
- [ ] 백업 + 복원 확인
- [ ] 계정(roles.sql) 준비
- [ ] 마이그레이션 적용(`migrate.mjs` 또는 `rebaseline.sh`)
- [ ] 테이블 93개·이력 13행 확인
- [ ] `roles.sql` 재실행
- [ ] 앱 배포·헬스 체크·주요 API 확인
- [ ] 결과 기록(적용 일시·담당·소요 시간)
