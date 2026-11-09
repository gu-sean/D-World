-- smoke 016: 소급 평가 요청은 업적 버전당 하나이고, 버전은 같은 업적의 것이어야 함
BEGIN;

INSERT INTO admin_accounts (id, login_id, email, password_hash)
VALUES ('00000000-0000-0000-0000-0000000f0161', 'smoke016', 'smoke016@example.com', 'x');

DO $$
BEGIN
    -- 없는 버전을 가리키는 요청은 거절
    BEGIN
        INSERT INTO achievement_backfill_runs
            (id, achievement_id, version_id, requested_by_admin_id)
        VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
                '00000000-0000-0000-0000-0000000f0161');
        RAISE EXCEPTION 'backfill run for unknown version accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    -- 처리 대기 요청을 찾는 부분 인덱스가 있어야 함
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                    WHERE indexname = 'achievement_backfill_runs_pending_idx'
                      AND indexdef LIKE '%WHERE%completed_at IS NULL%') THEN
        RAISE EXCEPTION 'achievement_backfill_runs_pending_idx missing';
    END IF;
END $$;

ROLLBACK;
