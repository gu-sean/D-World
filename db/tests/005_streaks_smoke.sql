-- smoke 005, 샘플 데이터는 롤백
BEGIN;

INSERT INTO users (id) VALUES
    ('00000000-0000-0000-0000-000000000533'),
    ('00000000-0000-0000-0000-000000000535');
INSERT INTO admin_accounts (id, login_id, email, password_hash)
VALUES ('00000000-0000-0000-0000-000000000532',
        'owner05', 'owner05@example.com', 'test-hash');
INSERT INTO goal_categories (id, code, name, display_order)
VALUES ('00000000-0000-0000-0000-000000000530', 'fitness05', '운동05', 1);
INSERT INTO difficulty_levels (id, code, name, display_order)
VALUES ('00000000-0000-0000-0000-000000000531', 'basic05', '기본05', 1);
INSERT INTO verification_criteria_versions
    (id, category_id, verification_method, version_no,
     rules_json, effective_at, created_by_admin_id)
VALUES ('00000000-0000-0000-0000-000000000534',
        '00000000-0000-0000-0000-000000000530',
        'sensor', 1, '{}'::jsonb, now() - interval '30 days',
        '00000000-0000-0000-0000-000000000532');

INSERT INTO missions
    (id, user_id, source_type, title, category_id, difficulty_id,
     verification_method, scheduled_date)
SELECT ('00000000-0000-0000-0000-' || lpad((500 + n)::text, 12, '0'))::uuid,
       '00000000-0000-0000-0000-000000000533'::uuid,
       'user', '스트릭 미션 ' || n::text,
       '00000000-0000-0000-0000-000000000530'::uuid,
       '00000000-0000-0000-0000-000000000531'::uuid,
       'sensor', (now() AT TIME ZONE 'Asia/Seoul')::date - (8 - n)
FROM generate_series(1, 7) AS n;

INSERT INTO mission_records
    (id, mission_id, user_id, attempt_no, submission_no,
     status, evidence_kind, started_at, submitted_at)
SELECT ('00000000-0000-0000-0000-' || lpad((510 + n)::text, 12, '0'))::uuid,
       ('00000000-0000-0000-0000-' || lpad((500 + n)::text, 12, '0'))::uuid,
       '00000000-0000-0000-0000-000000000533'::uuid,
       1, 1, 'submitted', 'sensor_summary',
       (((now() AT TIME ZONE 'Asia/Seoul')::date - (8 - n))::timestamp
            + interval '12 hours') AT TIME ZONE 'Asia/Seoul',
       (((now() AT TIME ZONE 'Asia/Seoul')::date - (8 - n))::timestamp
            + interval '12 hours 1 minute') AT TIME ZONE 'Asia/Seoul'
FROM generate_series(1, 7) AS n;

INSERT INTO verification_results
    (id, record_id, result_no, source, decision,
     criteria_version_id, engine_version)
SELECT ('00000000-0000-0000-0000-' || lpad((520 + n)::text, 12, '0'))::uuid,
       ('00000000-0000-0000-0000-' || lpad((510 + n)::text, 12, '0'))::uuid,
       1, 'ai', 'approved',
       '00000000-0000-0000-0000-000000000534'::uuid, 'model-v1'
FROM generate_series(1, 7) AS n;

UPDATE missions SET status = 'completed'
WHERE user_id = '00000000-0000-0000-0000-000000000533';

INSERT INTO streak_days
    (user_id, streak_date, status,
     qualifying_mission_id, qualifying_record_id, qualifying_result_id)
SELECT '00000000-0000-0000-0000-000000000533'::uuid,
       (now() AT TIME ZONE 'Asia/Seoul')::date - (8 - n),
       'success',
       ('00000000-0000-0000-0000-' || lpad((500 + n)::text, 12, '0'))::uuid,
       ('00000000-0000-0000-0000-' || lpad((510 + n)::text, 12, '0'))::uuid,
       ('00000000-0000-0000-0000-' || lpad((520 + n)::text, 12, '0'))::uuid
FROM generate_series(1, 7) AS n;

INSERT INTO streak_states
    (user_id, current_success_days, longest_success_days, last_success_date)
VALUES ('00000000-0000-0000-0000-000000000533',
        7, 7, (now() AT TIME ZONE 'Asia/Seoul')::date - 1);

INSERT INTO streak_milestone_policy_versions
    (id, target_success_days, version_no, points,
     effective_at, created_by_admin_id)
VALUES ('00000000-0000-0000-0000-000000000540',
        7, 1, 300, now() - interval '30 days',
        '00000000-0000-0000-0000-000000000532');

DO $$
BEGIN
    BEGIN
        INSERT INTO streak_milestone_awards
            (id, user_id, target_success_days, policy_version_id,
             awarded_points, paid_points, first_achieved_date, status)
        VALUES ('00000000-0000-0000-0000-000000000541',
                '00000000-0000-0000-0000-000000000533',
                7, '00000000-0000-0000-0000-000000000540',
                300, 300,
                (now() AT TIME ZONE 'Asia/Seoul')::date - 2,
                'active');
        RAISE EXCEPTION 'seven-day reward was granted after six successes';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO streak_days
            (user_id, streak_date, status,
             qualifying_mission_id, qualifying_record_id,
             qualifying_result_id)
        VALUES ('00000000-0000-0000-0000-000000000533',
                (now() AT TIME ZONE 'Asia/Seoul')::date,
                'success',
                '00000000-0000-0000-0000-000000000507',
                '00000000-0000-0000-0000-000000000517',
                '00000000-0000-0000-0000-000000000527');
        RAISE EXCEPTION 'mission counted for the wrong streak day';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;

INSERT INTO streak_milestone_awards
    (id, user_id, target_success_days, policy_version_id,
     awarded_points, paid_points, first_achieved_date, status)
VALUES ('00000000-0000-0000-0000-000000000550',
        '00000000-0000-0000-0000-000000000533',
        7, '00000000-0000-0000-0000-000000000540',
        300, 300,
        (now() AT TIME ZONE 'Asia/Seoul')::date - 1,
        'active');

INSERT INTO point_wallets (user_id) VALUES
    ('00000000-0000-0000-0000-000000000533'),
    ('00000000-0000-0000-0000-000000000535');
INSERT INTO point_monthly_usage
    (user_id, month_start_date, gross_auto_awarded_points)
VALUES ('00000000-0000-0000-0000-000000000533',
        date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date, 300);
UPDATE point_wallets SET available_points = 300
WHERE user_id = '00000000-0000-0000-0000-000000000533';

INSERT INTO point_transactions
    (id, user_id, kind, available_delta, balance_after,
     outstanding_after, source_type, source_id,
     cap_month, cap_delta, idempotency_key)
VALUES ('00000000-0000-0000-0000-000000000551',
        '00000000-0000-0000-0000-000000000533',
        'auto_award', 300, 300, 0, 'streak',
        '00000000-0000-0000-0000-000000000550',
        date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date,
        300, 'streak:533:7:award');

DO $$
BEGIN
    BEGIN
        INSERT INTO streak_milestone_awards
            (id, user_id, target_success_days, policy_version_id,
             awarded_points, paid_points, first_achieved_date, status)
        VALUES ('00000000-0000-0000-0000-000000000552',
                '00000000-0000-0000-0000-000000000533',
                7, '00000000-0000-0000-0000-000000000540',
                300, 300,
                (now() AT TIME ZONE 'Asia/Seoul')::date - 1,
                'active');
        RAISE EXCEPTION 'duplicate seven-day reward was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO point_transactions
            (id, user_id, kind, available_delta, balance_after,
             outstanding_after, source_type, source_id, idempotency_key)
        VALUES ('00000000-0000-0000-0000-000000000553',
                '00000000-0000-0000-0000-000000000535',
                'auto_award', 10, 0, 0, 'streak',
                '00000000-0000-0000-0000-000000000550',
                'streak:wrong-owner');
        RAISE EXCEPTION 'another user claimed streak reward';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        DELETE FROM streak_milestone_awards
         WHERE id = '00000000-0000-0000-0000-000000000550';
        RAISE EXCEPTION 'streak award history was directly deleted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;

DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000533';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM streak_days
               WHERE user_id = '00000000-0000-0000-0000-000000000533')
       OR EXISTS (SELECT 1 FROM streak_milestone_awards
                  WHERE user_id = '00000000-0000-0000-0000-000000000533') THEN
        RAISE EXCEPTION 'streak data survived account withdrawal';
    END IF;
END;
$$;

ROLLBACK;
