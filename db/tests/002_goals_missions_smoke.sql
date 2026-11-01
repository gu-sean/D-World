-- smoke 002, 샘플 데이터는 롤백
BEGIN;

INSERT INTO users (id) VALUES
    ('00000000-0000-0000-0000-000000000011'),
    ('00000000-0000-0000-0000-000000000012');

INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES
    ('00000000-0000-0000-0000-000000000013',
     'owner02', 'owner02@example.com', 'test-hash');

INSERT INTO goal_categories (id, code, name, display_order) VALUES
    ('00000000-0000-0000-0000-000000000021', 'exercise', '운동', 1);

INSERT INTO difficulty_levels (id, code, name, display_order) VALUES
    ('00000000-0000-0000-0000-000000000022', 'normal', '보통', 1);

INSERT INTO goals
    (id, user_id, category_id, difficulty_id, title, start_date, end_date)
VALUES
    ('00000000-0000-0000-0000-000000000031',
     '00000000-0000-0000-0000-000000000011',
     '00000000-0000-0000-0000-000000000021',
     '00000000-0000-0000-0000-000000000022',
     '운동 목표', DATE '2026-10-01', DATE '2026-11-30');

INSERT INTO goal_steps (id, goal_id, step_no, title, due_date) VALUES
    ('00000000-0000-0000-0000-000000000032',
     '00000000-0000-0000-0000-000000000031', 1, '첫 단계',
     DATE '2026-10-31');

INSERT INTO ai_plan_proposals
    (id, user_id, goal_id, generation_no, status,
     proposal_json, accepted_plan_json, accepted_at)
VALUES
    ('00000000-0000-0000-0000-000000000033',
     '00000000-0000-0000-0000-000000000011',
     '00000000-0000-0000-0000-000000000031', 1, 'accepted',
     '{}'::jsonb, '{}'::jsonb, now());

INSERT INTO mission_definitions
    (id, origin, created_by_user_id, title, category_id, difficulty_id,
     verification_method, publication_status)
VALUES
    ('00000000-0000-0000-0000-000000000041', 'user',
     '00000000-0000-0000-0000-000000000011', '공개 걷기',
     '00000000-0000-0000-0000-000000000021',
     '00000000-0000-0000-0000-000000000022', 'camera', 'public'),
    ('00000000-0000-0000-0000-000000000042', 'user',
     '00000000-0000-0000-0000-000000000011', '개인 운동',
     '00000000-0000-0000-0000-000000000021',
     '00000000-0000-0000-0000-000000000022', 'camera', 'private');

INSERT INTO missions
    (id, user_id, goal_id, goal_step_id, source_proposal_id, source_type,
     title, category_id, difficulty_id, verification_method, scheduled_date)
VALUES
    ('00000000-0000-0000-0000-000000000051',
     '00000000-0000-0000-0000-000000000011',
     '00000000-0000-0000-0000-000000000031',
     '00000000-0000-0000-0000-000000000032',
     '00000000-0000-0000-0000-000000000033', 'ai', 'AI 미션',
     '00000000-0000-0000-0000-000000000021',
     '00000000-0000-0000-0000-000000000022', 'camera',
     DATE '2026-10-28'),
    ('00000000-0000-0000-0000-000000000052',
     '00000000-0000-0000-0000-000000000011',
     '00000000-0000-0000-0000-000000000031',
     '00000000-0000-0000-0000-000000000032',
     NULL, 'user', '진행 중 미션',
     '00000000-0000-0000-0000-000000000021',
     '00000000-0000-0000-0000-000000000022', 'camera',
     DATE '2026-10-28'),
    ('00000000-0000-0000-0000-000000000053',
     '00000000-0000-0000-0000-000000000012',
     NULL, NULL, NULL, 'user', '독립 미션',
     '00000000-0000-0000-0000-000000000021',
     '00000000-0000-0000-0000-000000000022', 'camera',
     DATE '2026-10-28');

DO $$
BEGIN
    BEGIN
        INSERT INTO missions
            (id, user_id, goal_id, source_type, title, category_id,
             difficulty_id, verification_method, scheduled_date)
        VALUES
            ('00000000-0000-0000-0000-000000000054',
             '00000000-0000-0000-0000-000000000012',
             '00000000-0000-0000-0000-000000000031',
             'user', '다른 사람 목표',
             '00000000-0000-0000-0000-000000000021',
             '00000000-0000-0000-0000-000000000022',
             'camera', DATE '2026-10-28');
        RAISE EXCEPTION 'mission owner mismatch was accepted';
    EXCEPTION WHEN foreign_key_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO account_actions
            (id, user_id, admin_id, action_type, reason, starts_at)
        VALUES
            ('00000000-0000-0000-0000-000000000061',
             '00000000-0000-0000-0000-000000000011',
             '00000000-0000-0000-0000-000000000013',
             'restriction', '기간 누락', now());
        RAISE EXCEPTION 'restriction without end time was accepted';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO missions
            (id, user_id, definition_id, source_type, title, category_id,
             difficulty_id, verification_method, scheduled_date)
        VALUES
            ('00000000-0000-0000-0000-000000000055',
             '00000000-0000-0000-0000-000000000012',
             '00000000-0000-0000-0000-000000000042',
             'template', '다른 사람의 비공개 미션',
             '00000000-0000-0000-0000-000000000021',
             '00000000-0000-0000-0000-000000000022',
             'camera', DATE '2026-10-28');
        RAISE EXCEPTION 'private definition was usable by another user';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;

    BEGIN
        INSERT INTO mission_publication_reviews
            (id, definition_id, reviewed_by_admin_id, decision)
        VALUES
            ('00000000-0000-0000-0000-000000000062',
             '00000000-0000-0000-0000-000000000041',
             '00000000-0000-0000-0000-000000000013', 'rejected');
        RAISE EXCEPTION 'rejection without reason was accepted';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    BEGIN
        UPDATE missions SET status = 'cancelled'
        WHERE id = '00000000-0000-0000-0000-000000000051';
        RAISE EXCEPTION 'cancellation without reason was accepted';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END;
$$;

INSERT INTO ai_plan_proposals
    (id, user_id, goal_id, generation_no, proposal_json)
VALUES
    ('00000000-0000-0000-0000-000000000034',
     '00000000-0000-0000-0000-000000000011',
     '00000000-0000-0000-0000-000000000031', 2, '{}'::jsonb);

DO $$
BEGIN
    BEGIN
        INSERT INTO missions
            (id, user_id, goal_id, source_proposal_id, source_type, title,
             category_id, difficulty_id, verification_method, scheduled_date)
        VALUES
            ('00000000-0000-0000-0000-000000000056',
             '00000000-0000-0000-0000-000000000011',
             '00000000-0000-0000-0000-000000000031',
             '00000000-0000-0000-0000-000000000034',
             'ai', '미수락 제안 미션',
             '00000000-0000-0000-0000-000000000021',
             '00000000-0000-0000-0000-000000000022',
             'camera', DATE '2026-10-28');
        RAISE EXCEPTION 'draft AI proposal created a mission';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END;
$$;

UPDATE missions SET status = 'in_progress'
WHERE id = '00000000-0000-0000-0000-000000000052';

DO $$
BEGIN
    BEGIN
        UPDATE missions SET target_value = 20, target_unit = '회'
        WHERE id = '00000000-0000-0000-0000-000000000052';
        RAISE EXCEPTION 'started mission rules were editable';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM = 'started mission rules were editable' THEN
            RAISE;
        END IF;
    END;
END;
$$;

UPDATE missions SET memo = '수행 중 메모'
WHERE id = '00000000-0000-0000-0000-000000000052';

UPDATE goals SET deleted_at = now()
WHERE id = '00000000-0000-0000-0000-000000000031';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM missions
        WHERE id = '00000000-0000-0000-0000-000000000051'
          AND status = 'cancelled' AND cancel_reason = 'goal_deleted'
          AND deleted_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'unstarted mission was not cancelled';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM missions
        WHERE id = '00000000-0000-0000-0000-000000000052'
          AND status = 'in_progress' AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'started mission was changed by goal deletion';
    END IF;
END;
$$;

-- 비공개 원형이 있으면 소유자를 삭제할 수 없다
DO $$
BEGIN
    BEGIN
        DELETE FROM users
        WHERE id = '00000000-0000-0000-0000-000000000011';
        RAISE EXCEPTION 'private definition survived user deletion';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END;
$$;

DELETE FROM mission_definitions
WHERE id = '00000000-0000-0000-0000-000000000042';

DELETE FROM users
WHERE id = '00000000-0000-0000-0000-000000000011';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM mission_definitions
        WHERE id = '00000000-0000-0000-0000-000000000041'
          AND origin = 'user' AND publication_status = 'public'
          AND created_by_user_id IS NULL
    ) THEN
        RAISE EXCEPTION 'public definition was not anonymized';
    END IF;
    IF EXISTS (
        SELECT 1 FROM missions
        WHERE user_id = '00000000-0000-0000-0000-000000000011'
    ) THEN
        RAISE EXCEPTION 'personal mission data remained after withdrawal';
    END IF;
END;
$$;

ROLLBACK;
