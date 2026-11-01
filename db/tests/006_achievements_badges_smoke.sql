-- smoke 006, 샘플 데이터는 롤백
BEGIN;

INSERT INTO users (id) VALUES
    ('00000000-0000-0000-0000-000000000601'),
    ('00000000-0000-0000-0000-000000000612');
INSERT INTO profiles (user_id, nickname)
VALUES ('00000000-0000-0000-0000-000000000601', 'TestHero06');
INSERT INTO admin_accounts (id, login_id, email, password_hash)
VALUES ('00000000-0000-0000-0000-000000000602',
        'owner06', 'owner06@example.com', 'test-hash');
INSERT INTO goal_categories (id, code, name, display_order)
VALUES ('00000000-0000-0000-0000-000000000603', 'fitness06', '운동06', 1);
INSERT INTO difficulty_levels (id, code, name, display_order)
VALUES ('00000000-0000-0000-0000-000000000604', 'basic06', '기본06', 1);

INSERT INTO goals
    (id, user_id, category_id, difficulty_id, title,
     start_date, end_date, status, completed_at)
VALUES ('00000000-0000-0000-0000-000000000605',
        '00000000-0000-0000-0000-000000000601',
        '00000000-0000-0000-0000-000000000603',
        '00000000-0000-0000-0000-000000000604',
        '첫 목표', CURRENT_DATE - 1, CURRENT_DATE + 1,
        'completed', now() - interval '1 hour');

INSERT INTO achievement_definitions
    (id, code, status, created_by_admin_id)
VALUES ('00000000-0000-0000-0000-000000000608',
        'first_goal_06', 'public',
        '00000000-0000-0000-0000-000000000602');
INSERT INTO achievement_badge_images
    (id, achievement_id, version_no, r2_object_key,
     mime_type, size_bytes, uploaded_at, created_by_admin_id)
VALUES ('00000000-0000-0000-0000-000000000607',
        '00000000-0000-0000-0000-000000000608',
        1, 'badges/first-goal/v1.webp', 'image/webp', 1024,
        now() - interval '2 days',
        '00000000-0000-0000-0000-000000000602');
INSERT INTO achievement_versions
    (id, achievement_id, version_no, title, description, rarity,
     condition_type, target_count, reward_points,
     badge_image_id, effective_at, created_by_admin_id)
VALUES ('00000000-0000-0000-0000-000000000609',
        '00000000-0000-0000-0000-000000000608',
        1, '첫 목표 달성', '첫 목표를 완료한다', 'common',
        'first_goal_completed', 1, 50,
        '00000000-0000-0000-0000-000000000607',
        now() - interval '2 days',
        '00000000-0000-0000-0000-000000000602');

INSERT INTO user_achievements
    (id, user_id, achievement_id, achievement_version_id,
     badge_image_id, source_type, source_id,
     first_achieved_at, awarded_points, paid_points)
VALUES ('00000000-0000-0000-0000-000000000610',
        '00000000-0000-0000-0000-000000000601',
        '00000000-0000-0000-0000-000000000608',
        '00000000-0000-0000-0000-000000000609',
        '00000000-0000-0000-0000-000000000607',
        'goal', '00000000-0000-0000-0000-000000000605',
        now() - interval '1 hour', 50, 50);

INSERT INTO user_achievement_events
    (id, user_achievement_id, user_id, event_type,
     source_type, source_id, idempotency_key)
VALUES ('00000000-0000-0000-0000-000000000615',
        '00000000-0000-0000-0000-000000000610',
        '00000000-0000-0000-0000-000000000601',
        'earned', 'goal',
        '00000000-0000-0000-0000-000000000605',
        'achievement:601:608:earned');

UPDATE profiles
   SET representative_achievement_id =
       '00000000-0000-0000-0000-000000000610'
 WHERE user_id = '00000000-0000-0000-0000-000000000601';

INSERT INTO point_wallets (user_id) VALUES
    ('00000000-0000-0000-0000-000000000601'),
    ('00000000-0000-0000-0000-000000000612');
INSERT INTO point_monthly_usage
    (user_id, month_start_date, gross_auto_awarded_points)
VALUES ('00000000-0000-0000-0000-000000000601',
        date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date, 50);
UPDATE point_wallets SET available_points = 50
WHERE user_id = '00000000-0000-0000-0000-000000000601';
INSERT INTO point_transactions
    (id, user_id, kind, available_delta, balance_after,
     outstanding_after, source_type, source_id,
     cap_month, cap_delta, idempotency_key)
VALUES ('00000000-0000-0000-0000-000000000611',
        '00000000-0000-0000-0000-000000000601',
        'auto_award', 50, 50, 0, 'achievement',
        '00000000-0000-0000-0000-000000000610',
        date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date,
        50, 'achievement:601:608:award');

DO $$
BEGIN
    BEGIN
        INSERT INTO user_achievements
            (id, user_id, achievement_id, achievement_version_id,
             badge_image_id, source_type, source_id,
             first_achieved_at, awarded_points, paid_points)
        VALUES ('00000000-0000-0000-0000-000000000613',
                '00000000-0000-0000-0000-000000000601',
                '00000000-0000-0000-0000-000000000608',
                '00000000-0000-0000-0000-000000000609',
                '00000000-0000-0000-0000-000000000607',
                'goal', '00000000-0000-0000-0000-000000000605',
                now() - interval '1 hour', 50, 50);
        RAISE EXCEPTION 'duplicate achievement was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        UPDATE achievement_versions SET reward_points = 100
         WHERE id = '00000000-0000-0000-0000-000000000609';
        RAISE EXCEPTION 'achievement version was changed';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE achievement_badge_images SET r2_object_key = 'badges/changed.webp'
         WHERE id = '00000000-0000-0000-0000-000000000607';
        RAISE EXCEPTION 'confirmed badge image was changed';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        DELETE FROM user_achievements
         WHERE id = '00000000-0000-0000-0000-000000000610';
        RAISE EXCEPTION 'achievement grant was directly deleted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE user_achievement_events SET reason = 'changed'
         WHERE id = '00000000-0000-0000-0000-000000000615';
        RAISE EXCEPTION 'achievement event was changed';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO point_transactions
            (id, user_id, kind, available_delta, balance_after,
             outstanding_after, source_type, source_id, idempotency_key)
        VALUES ('00000000-0000-0000-0000-000000000614',
                '00000000-0000-0000-0000-000000000612',
                'auto_award', 10, 0, 0, 'achievement',
                '00000000-0000-0000-0000-000000000610',
                'achievement:wrong-owner');
        RAISE EXCEPTION 'another user claimed achievement points';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;

UPDATE achievement_definitions SET status = 'hidden'
WHERE id = '00000000-0000-0000-0000-000000000608';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM user_achievements
         WHERE id = '00000000-0000-0000-0000-000000000610'
           AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'existing achievement was lost when hidden';
    END IF;
END;
$$;

UPDATE user_achievements SET status = 'revoked'
WHERE id = '00000000-0000-0000-0000-000000000610';

INSERT INTO user_achievement_events
    (id, user_achievement_id, user_id, event_type,
     source_type, source_id, reason, idempotency_key)
VALUES ('00000000-0000-0000-0000-000000000616',
        '00000000-0000-0000-0000-000000000610',
        '00000000-0000-0000-0000-000000000601',
        'revoked', 'goal',
        '00000000-0000-0000-0000-000000000605',
        '승인 판정 번복', 'achievement:601:608:revoked:1');

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM profiles
         WHERE user_id = '00000000-0000-0000-0000-000000000601'
           AND representative_achievement_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'revoked representative badge remained equipped';
    END IF;
END;
$$;

DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000601';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM user_achievements
               WHERE user_id = '00000000-0000-0000-0000-000000000601') THEN
        RAISE EXCEPTION 'achievement grant survived account withdrawal';
    END IF;
END;
$$;

ROLLBACK;
