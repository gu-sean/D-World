-- 운영 점검 쿼리 모음: 읽기 전용 계정(dworld_readonly)으로 실행해도 되는 조회만 있다
-- 실행: psql -d <DB> -f db/ops/monitoring.sql   (필요한 절만 복사해 써도 됨)
-- 알림 기준값은 db/ops/README.md "모니터링" 표 참고

\echo '── 1. 연결 사용량 (알림: 최대 연결의 80% 초과) ──'
SELECT count(*) AS 연결수,
       current_setting('max_connections')::int AS 최대,
       round(100.0 * count(*) / current_setting('max_connections')::int, 1) AS 사용률_퍼센트
  FROM pg_stat_activity;

SELECT usename AS 계정, state AS 상태, count(*) AS 개수
  FROM pg_stat_activity
 WHERE datname = current_database()
 GROUP BY usename, state
 ORDER BY count(*) DESC;

\echo '── 2. 오래 열린 트랜잭션 (알림: 5분 초과, 잠금·bloat 원인) ──'
SELECT pid, usename AS 계정, state AS 상태,
       now() - xact_start AS 트랜잭션_경과,
       now() - state_change AS 상태_경과,
       left(query, 120) AS 마지막_쿼리
  FROM pg_stat_activity
 WHERE xact_start IS NOT NULL
   AND now() - xact_start > interval '5 minutes'
 ORDER BY xact_start;

\echo '── 3. 잠금 대기 (알림: 30초 초과 대기) ──'
SELECT blocked.pid AS 대기_pid,
       blocking.pid AS 차단_pid,
       now() - blocked.query_start AS 대기_시간,
       left(blocked.query, 80) AS 대기_쿼리,
       left(blocking.query, 80) AS 차단_쿼리
  FROM pg_stat_activity blocked
  JOIN LATERAL unnest(pg_blocking_pids(blocked.pid)) AS b(pid) ON true
  JOIN pg_stat_activity blocking ON blocking.pid = b.pid
 ORDER BY 대기_시간 DESC;

\echo '── 4. 데드락·롤백 (알림: 데드락 1건이라도 발생) ──'
SELECT datname AS DB, deadlocks AS 데드락, xact_rollback AS 롤백, xact_commit AS 커밋,
       round(100.0 * blks_hit / NULLIF(blks_hit + blks_read, 0), 2) AS 캐시_적중률_퍼센트
  FROM pg_stat_database
 WHERE datname = current_database();

\echo '── 5. 테이블 크기·행 수 (증가 속도 추적, 파티셔닝 판단 근거) ──'
SELECT relname AS 테이블,
       pg_size_pretty(pg_total_relation_size(relid)) AS 총크기,
       n_live_tup AS 행수_추정,
       n_dead_tup AS 죽은_행,
       last_autovacuum AS 마지막_autovacuum
  FROM pg_stat_user_tables
 ORDER BY pg_total_relation_size(relid) DESC
 LIMIT 20;

\echo '── 6. 죽은 행 비율 높은 테이블 (알림: 20% 초과 + 1만 행 이상) ──'
SELECT relname AS 테이블, n_live_tup AS 행수, n_dead_tup AS 죽은_행,
       round(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 1) AS 죽은_비율_퍼센트
  FROM pg_stat_user_tables
 WHERE n_dead_tup > 10000
   AND n_dead_tup > 0.2 * (n_live_tup + n_dead_tup)
 ORDER BY n_dead_tup DESC;

\echo '── 7. 한 번도 안 쓰인 인덱스(후보) — 운영 기간이 충분할 때만 판단 ──'
SELECT s.relname AS 테이블, s.indexrelname AS 인덱스,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS 크기, s.idx_scan AS 사용횟수
  FROM pg_stat_user_indexes s
  JOIN pg_index i ON i.indexrelid = s.indexrelid
 WHERE s.idx_scan = 0 AND NOT i.indisunique AND NOT i.indisprimary
 ORDER BY pg_relation_size(s.indexrelid) DESC
 LIMIT 20;

\echo '── 8. 복제 지연 (복제본이 있을 때만 행이 나옴, 알림: 30초 초과) ──'
SELECT application_name AS 복제본, state AS 상태,
       write_lag, flush_lag, replay_lag
  FROM pg_stat_replication;

\echo '── 9. 느린 쿼리 상위 (pg_stat_statements 확장이 켜져 있을 때) ──'
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements')
            THEN '확장 사용 가능: 아래 쿼리를 실행'
            ELSE '확장 없음: shared_preload_libraries에 pg_stat_statements 추가 후 CREATE EXTENSION 필요'
       END AS pg_stat_statements;
-- 확장이 있으면(버전에 따라 컬럼명 mean_exec_time):
-- SELECT left(query, 100) AS 쿼리, calls AS 호출수,
--        round(mean_exec_time::numeric, 1) AS 평균_ms,
--        round(total_exec_time::numeric / 1000, 1) AS 총_초
--   FROM pg_stat_statements
--  ORDER BY total_exec_time DESC LIMIT 20;

\echo '── 10. 정기 작업 적체 (앱 작업이 밀리면 이 값이 커짐) ──'
SELECT '푸시 대기' AS 항목, count(*) AS 건수 FROM user_notifications WHERE push_status = 'pending'
UNION ALL SELECT 'AI 판정 대기 회차', count(*) FROM mission_records WHERE status = 'submitted'
UNION ALL SELECT '공지 미처리(예약 도래)', count(*) FROM notices
          WHERE status = 'scheduled' AND scheduled_at <= now()
UNION ALL SELECT '챌린지 일별 pending(지난 날짜)', count(*) FROM challenge_daily_missions
          WHERE status = 'pending' AND challenge_date < CURRENT_DATE
UNION ALL SELECT '날씨 수집 대상 격자(24h)', count(*) FROM weather_grid_cells
          WHERE last_requested_at > now() - interval '24 hours';
