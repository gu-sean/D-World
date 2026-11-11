-- smoke 001, 샘플 데이터는 롤백
BEGIN;

INSERT INTO users (id) VALUES
    ('00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000002');

INSERT INTO profiles (user_id, nickname) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Runner1');

DO $$
BEGIN
    BEGIN
        INSERT INTO profiles (user_id, nickname) VALUES
            ('00000000-0000-0000-0000-000000000002', 'runner1');
        RAISE EXCEPTION 'case-insensitive nickname uniqueness was not enforced';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;
END;
$$;

INSERT INTO user_identities (id, user_id, provider, provider_subject) VALUES
    ('10000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000001', 'google', 'google-a');

DO $$
BEGIN
    BEGIN
        INSERT INTO user_identities (id, user_id, provider, provider_subject) VALUES
            ('10000000-0000-0000-0000-000000000002',
             '00000000-0000-0000-0000-000000000001', 'google', 'google-b');
        RAISE EXCEPTION 'one provider account per user was not enforced';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO user_identities (id, user_id, provider, provider_subject) VALUES
            ('10000000-0000-0000-0000-000000000003',
             '00000000-0000-0000-0000-000000000002', 'google', 'google-a');
        RAISE EXCEPTION 'provider subject uniqueness was not enforced';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;
END;
$$;

INSERT INTO account_withdrawal_requests (id, user_id) VALUES
    ('20000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000001');

DO $$
BEGIN
    BEGIN
        INSERT INTO account_withdrawal_requests (id, user_id) VALUES
            ('20000000-0000-0000-0000-000000000002',
             '00000000-0000-0000-0000-000000000001');
        RAISE EXCEPTION 'duplicate open withdrawal request was not blocked';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;
END;
$$;

UPDATE account_withdrawal_requests
SET status = 'completed', completed_at = now(), reason = 'personal data in reason'
WHERE id = '20000000-0000-0000-0000-000000000001';

INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES
    ('30000000-0000-0000-0000-000000000001',
     'owner01', 'owner@example.com', 'test-hash');

INSERT INTO admin_audit_logs
    (id, admin_id, target_user_id, action, result, reason, before_value, after_value)
VALUES
    ('40000000-0000-0000-0000-000000000001',
     '30000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000001',
     'withdrawal', 'success', 'personal data',
     '{"nickname":"Runner1"}', '{"status":"deleted"}');

DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000001';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM account_withdrawal_requests
        WHERE id = '20000000-0000-0000-0000-000000000001'
          AND user_id IS NULL AND status = 'completed' AND reason IS NULL
    ) THEN
        RAISE EXCEPTION 'completed withdrawal did not retain anonymous status';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM admin_audit_logs
        WHERE id = '40000000-0000-0000-0000-000000000001'
          AND target_user_id IS NULL AND reason IS NULL
          AND before_value IS NULL AND after_value IS NULL
    ) THEN
        RAISE EXCEPTION 'administrator log retained user details';
    END IF;

    IF EXISTS (
        SELECT 1 FROM profiles
        WHERE user_id = '00000000-0000-0000-0000-000000000001'
    ) THEN
        RAISE EXCEPTION 'profile was not deleted with user';
    END IF;
END;
$$;

ROLLBACK;
