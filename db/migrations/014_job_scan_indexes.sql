-- 정기 작업의 전체 스캔 방지용 부분 인덱스
BEGIN;

-- 챌린지 일별 결과 확정 작업: status = 'pending'이고 날짜가 지난 행만 찾음
CREATE INDEX challenge_daily_missions_pending_idx
    ON challenge_daily_missions (challenge_date)
    WHERE status = 'pending';

-- 스트릭 날짜 확정 작업: 지난 날짜의 취소·챌린지 외 미션만 찾음
CREATE INDEX missions_streak_scan_idx
    ON missions (scheduled_date)
    WHERE status <> 'cancelled' AND source_type <> 'challenge';

COMMIT;
