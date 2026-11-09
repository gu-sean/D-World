-- smoke 014: 정기 작업용 부분 인덱스가 있고 작업 쿼리 조건을 포함하는지 확인
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                    WHERE indexname = 'challenge_daily_missions_pending_idx'
                      AND indexdef LIKE '%WHERE%pending%') THEN
        RAISE EXCEPTION 'challenge_daily_missions_pending_idx missing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                    WHERE indexname = 'missions_streak_scan_idx'
                      AND indexdef LIKE '%cancelled%' AND indexdef LIKE '%challenge%') THEN
        RAISE EXCEPTION 'missions_streak_scan_idx missing';
    END IF;
END $$;
