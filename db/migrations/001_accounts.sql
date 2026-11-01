-- 계정·인증·약관 동의·관리자·이용 제한·탈퇴

BEGIN;

CREATE TABLE users (
    id uuid PRIMARY KEY,
    status varchar(24) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'withdrawal_processing')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    nickname varchar(12) NOT NULL
        CHECK (nickname ~ '^[가-힣A-Za-z0-9]{2,12}$'),
    notification_enabled boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX profiles_nickname_ci_uq ON profiles (lower(nickname));

CREATE TABLE phone_credentials (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone_e164 varchar(16) NOT NULL UNIQUE
        CHECK (phone_e164 ~ '^\+[1-9][0-9]{1,14}$'),
    password_hash text NOT NULL CHECK (length(password_hash) > 0),
    verified_at timestamptz NOT NULL,
    password_changed_at timestamptz NOT NULL,
    failed_attempt_count smallint NOT NULL DEFAULT 0
        CHECK (failed_attempt_count BETWEEN 0 AND 5),
    locked_until timestamptz
);

CREATE TABLE user_identities (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider varchar(20) NOT NULL
        CHECK (provider IN ('apple', 'google', 'naver')),
    provider_subject text NOT NULL CHECK (length(provider_subject) > 0),
    email varchar(255),
    linked_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_subject),
    UNIQUE (user_id, provider)
);

CREATE TABLE phone_verification_challenges (
    id uuid PRIMARY KEY,
    phone_e164 varchar(16) NOT NULL
        CHECK (phone_e164 ~ '^\+[1-9][0-9]{1,14}$'),
    purpose varchar(24) NOT NULL
        CHECK (purpose IN ('signup', 'link_phone', 'reset_password', 'change_phone')),
    code_hash text NOT NULL CHECK (length(code_hash) > 0),
    attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    invalidated_at timestamptz,
    CHECK (expires_at > created_at),
    CHECK (consumed_at IS NULL OR consumed_at >= created_at),
    CHECK (invalidated_at IS NULL OR invalidated_at >= created_at),
    CHECK (consumed_at IS NULL OR invalidated_at IS NULL)
);

CREATE INDEX phone_challenges_recent_idx
    ON phone_verification_challenges (phone_e164, purpose, created_at DESC);

CREATE TABLE auth_sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash text NOT NULL UNIQUE
        CHECK (length(refresh_token_hash) > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    CHECK (expires_at > created_at),
    CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX auth_sessions_user_expiry_idx
    ON auth_sessions (user_id, expires_at);

CREATE TABLE policy_document_versions (
    id uuid PRIMARY KEY,
    document_type varchar(24) NOT NULL
        CHECK (document_type IN ('terms', 'privacy', 'marketing')),
    version varchar(40) NOT NULL CHECK (length(version) > 0),
    body text NOT NULL CHECK (length(body) > 0),
    effective_at timestamptz NOT NULL,
    requires_reconsent boolean NOT NULL DEFAULT false,
    published_at timestamptz,
    UNIQUE (document_type, version)
);

CREATE INDEX policy_documents_effective_idx
    ON policy_document_versions (document_type, effective_at DESC)
    WHERE published_at IS NOT NULL;

CREATE TABLE consent_records (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_version_id uuid NOT NULL
        REFERENCES policy_document_versions(id) ON DELETE RESTRICT,
    granted boolean NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX consent_records_latest_idx
    ON consent_records (user_id, document_version_id, recorded_at DESC);

CREATE TABLE admin_accounts (
    id uuid PRIMARY KEY,
    login_id varchar(50) NOT NULL
        CHECK (login_id ~ '^[A-Za-z0-9_]{3,50}$'),
    email varchar(255) NOT NULL
        CHECK (email = lower(btrim(email)) AND position('@' IN email) > 1),
    password_hash text NOT NULL CHECK (length(password_hash) > 0),
    status varchar(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'disabled')),
    failed_attempt_count smallint NOT NULL DEFAULT 0
        CHECK (failed_attempt_count BETWEEN 0 AND 5),
    locked_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX admin_accounts_login_id_ci_uq
    ON admin_accounts (lower(login_id));
CREATE UNIQUE INDEX admin_accounts_email_uq
    ON admin_accounts (email);

CREATE TABLE admin_sessions (
    id uuid PRIMARY KEY,
    admin_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
    refresh_token_hash text NOT NULL UNIQUE
        CHECK (length(refresh_token_hash) > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    CHECK (expires_at > created_at),
    CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX admin_sessions_admin_expiry_idx
    ON admin_sessions (admin_id, expires_at);

CREATE TABLE account_actions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    action_type varchar(20) NOT NULL
        CHECK (action_type IN ('warning', 'restriction')),
    reason text NOT NULL CHECK (length(btrim(reason)) > 0),
    starts_at timestamptz NOT NULL,
    ends_at timestamptz,
    lifted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (
        (action_type = 'warning' AND ends_at IS NULL)
        OR (action_type = 'restriction' AND ends_at IS NOT NULL
            AND ends_at > starts_at)
    ),
    CHECK (lifted_at IS NULL OR lifted_at >= starts_at)
);

CREATE INDEX account_actions_user_period_idx
    ON account_actions (user_id, starts_at DESC);

CREATE TABLE account_withdrawal_requests (
    id uuid PRIMARY KEY,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    status varchar(24) NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'cancelled', 'on_hold', 'processing', 'completed')),
    requested_at timestamptz NOT NULL DEFAULT now(),
    reviewed_by uuid REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    reviewed_at timestamptz,
    reason text,
    completed_at timestamptz,
    CHECK (user_id IS NOT NULL OR status = 'completed'),
    CHECK (completed_at IS NULL OR status = 'completed'),
    CHECK (status <> 'completed' OR completed_at IS NOT NULL),
    CHECK (reviewed_at IS NULL OR reviewed_by IS NOT NULL)
);

CREATE UNIQUE INDEX account_withdrawal_one_open_uq
    ON account_withdrawal_requests (user_id)
    WHERE status IN ('requested', 'on_hold', 'processing');

CREATE INDEX account_withdrawal_queue_idx
    ON account_withdrawal_requests (status, requested_at);

CREATE TABLE admin_audit_logs (
    id uuid PRIMARY KEY,
    admin_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action varchar(80) NOT NULL,
    result varchar(20) NOT NULL CHECK (result IN ('success', 'failure')),
    reason text,
    before_value jsonb,
    after_value jsonb,
    recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_actor_time_idx
    ON admin_audit_logs (admin_id, recorded_at DESC);
CREATE INDEX admin_audit_target_time_idx
    ON admin_audit_logs (target_user_id, recorded_at DESC)
    WHERE target_user_id IS NOT NULL;

-- 탈퇴 시 식별 정보 제거, R2·도메인 데이터는 서비스가 먼저 정리
CREATE FUNCTION scrub_user_account_logs() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE account_withdrawal_requests
       SET reason = NULL
     WHERE user_id = OLD.id;

    UPDATE admin_audit_logs
       SET reason = NULL,
           before_value = NULL,
           after_value = NULL
     WHERE target_user_id = OLD.id;

    RETURN OLD;
END;
$$;

CREATE TRIGGER users_scrub_account_logs_before_delete
BEFORE DELETE ON users
FOR EACH ROW EXECUTE FUNCTION scrub_user_account_logs();

COMMIT;
