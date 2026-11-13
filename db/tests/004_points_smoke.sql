-- smoke 004, 샘플 데이터는 롤백
BEGIN;

INSERT INTO users (id) VALUES ('00000401');
INSERT INTO admin_accounts (id, login_id, email, password_hash)
VALUES ('00000402',
        'owner04', 'owner04@example.com', 'test-hash');
INSERT INTO goal_categories (id, code, name, display_order)
VALUES ('00000403', 'fitness04', '운동04', 1);
INSERT INTO difficulty_levels (id, code, name, display_order)
VALUES ('00000404', 'basic04', '기본04', 1);

INSERT INTO mission_reward_rate_versions
    (id, category_id, difficulty_id, version_no, points,
     effective_at, created_by_admin_id)
VALUES ('00000405',
        '00000403',
        '00000404',
        1, 100, now() - interval '1 day',
        '00000402');

INSERT INTO missions
    (id, user_id, source_type, title, category_id, difficulty_id,
     verification_method, scheduled_date, reward_points,
     reward_rate_version_id)
VALUES ('00000406',
        '00000401', 'user', '걷기',
        '00000403',
        '00000404',
        'sensor', CURRENT_DATE, 100,
        '00000405');

INSERT INTO mission_records
    (id, mission_id, user_id, attempt_no, submission_no,
     status, evidence_kind, submitted_at)
VALUES ('00000407',
        '00000406',
        '00000401',
        1, 1, 'submitted', 'sensor_summary', now());

INSERT INTO verification_criteria_versions
    (id, category_id, verification_method, version_no,
     rules_json, effective_at, created_by_admin_id)
VALUES ('00000408',
        '00000403',
        'sensor', 1, '{}'::jsonb, now() - interval '1 day',
        '00000402');

INSERT INTO verification_results
    (id, record_id, result_no, source, decision,
     criteria_version_id, engine_version)
VALUES ('00000409',
        '00000407',
        1, 'ai', 'approved',
        '00000408', 'model-v1');

INSERT INTO point_wallets (user_id)
VALUES ('00000401');

INSERT INTO mission_point_awards
    (mission_id, user_id, first_approved_result_id,
     original_points, paid_points, status)
VALUES ('00000406',
        '00000401',
        '00000409',
        100, 100, 'active');

INSERT INTO point_monthly_usage
    (user_id, month_start_date, gross_auto_awarded_points)
VALUES ('00000401',
        date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date,
        100);

UPDATE point_wallets SET available_points = 100
WHERE user_id = '00000401';

INSERT INTO point_transactions
    (id, user_id, kind, available_delta, balance_after, outstanding_after,
     source_type, source_id, cap_month, cap_delta, idempotency_key)
VALUES ('00000410',
        '00000401',
        'auto_award', 100, 100, 0, 'mission',
        '00000406',
        date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date,
        100, 'mission:406:award');

DO $$
BEGIN
    BEGIN
        INSERT INTO point_monthly_cap_policies
            (id, effective_month, monthly_limit_points,
             created_by_admin_id)
        VALUES ('00000413',
                date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date,
                50000, '00000402');
        RAISE EXCEPTION 'current-month cap change was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE point_wallets SET available_points = -1
         WHERE user_id = '00000401';
        RAISE EXCEPTION 'negative wallet balance was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE point_transactions SET available_delta = 99
         WHERE id = '00000410';
        RAISE EXCEPTION 'point transaction was updated';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        DELETE FROM point_transactions
         WHERE id = '00000410';
        RAISE EXCEPTION 'point transaction was deleted outside withdrawal';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE mission_reward_rate_versions SET points = 200
         WHERE id = '00000405';
        RAISE EXCEPTION 'published reward rate was updated';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE missions SET reward_points = 200
         WHERE id = '00000406';
        RAISE EXCEPTION 'mission reward was changed after creation';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO mission_point_awards
            (mission_id, user_id, first_approved_result_id,
             original_points, paid_points, status)
        VALUES ('00000406',
                '00000401',
                '00000409',
                100, 100, 'active');
        RAISE EXCEPTION 'duplicate mission reward was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO point_transactions
            (id, user_id, kind, available_delta, balance_after,
             outstanding_after, source_type, source_id, idempotency_key)
        VALUES ('00000411',
                '00000401',
                'spend', -50, 50, 0, 'shop_order',
                '00000412',
                'shop:412:spend');
        RAISE EXCEPTION 'ledger snapshot diverged from wallet';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;

DELETE FROM users WHERE id = '00000401';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM point_transactions
               WHERE user_id = '00000401') THEN
        RAISE EXCEPTION 'point history survived account withdrawal';
    END IF;
END;
$$;

ROLLBACK;
