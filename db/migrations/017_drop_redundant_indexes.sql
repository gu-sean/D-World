-- 중복 인덱스 3개 제거 (구조·데이터 변경 없음)
-- (a, b DESC) 인덱스는 같은 표의 유니크 인덱스 (a, b)와 정렬 방향만 다르다.
-- B-tree는 역방향으로도 읽을 수 있어 "최신 N건" 조회(ORDER BY b DESC LIMIT n)를 유니크 인덱스가 그대로 처리한다.
BEGIN;

DROP INDEX IF EXISTS verification_results_record_recent_idx;  -- verification_results_record_id_result_no_key
DROP INDEX IF EXISTS streak_days_user_recent_idx;             -- streak_days_pkey
DROP INDEX IF EXISTS mission_records_mission_recent_idx;      -- mission_records_mission_id_attempt_no_key

COMMIT;
