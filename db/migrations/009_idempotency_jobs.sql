-- 멱등·재시도 상태: AI 수신 키, 관리자 요청 키, 보상 지급 시도
BEGIN;

-- 재전송된 AI 결과는 새 result_no가 아니라 기존 행에 대응
-- 관리자 판정·기존 행 때문에 nullable, AI 결과는 백엔드가 반드시 채움
ALTER TABLE verification_results
    ADD COLUMN ingest_key text
        CHECK (ingest_key IS NULL OR length(btrim(ingest_key)) > 0),
    ADD COLUMN raw_result jsonb
        CHECK (raw_result IS NULL OR jsonb_typeof(raw_result) = 'object'),
    ADD CONSTRAINT verification_results_ingest_key_ai_only
        CHECK (ingest_key IS NULL OR source = 'ai');

CREATE UNIQUE INDEX verification_results_ingest_key_uq
    ON verification_results (ingest_key) WHERE ingest_key IS NOT NULL;

CREATE OR REPLACE FUNCTION protect_verification_result() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(OLD.record_id, OLD.result_no, OLD.source, OLD.decision,
           OLD.criteria_version_id, OLD.engine_version, OLD.confidence,
           OLD.metrics, OLD.reason, OLD.reviewed_by_admin_id, OLD.decided_at,
           OLD.ingest_key, OLD.raw_result)
       IS DISTINCT FROM
       ROW(NEW.record_id, NEW.result_no, NEW.source, NEW.decision,
           NEW.criteria_version_id, NEW.engine_version, NEW.confidence,
           NEW.metrics, NEW.reason, NEW.reviewed_by_admin_id, NEW.decided_at,
           NEW.ingest_key, NEW.raw_result)
       OR (OLD.is_current = false AND NEW.is_current = true)
       OR (OLD.notified_at IS NOT NULL AND
           NEW.notified_at IS DISTINCT FROM OLD.notified_at) THEN
        RAISE EXCEPTION 'verification result history is immutable'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

-- 같은 Idempotency-Key + 같은 request_hash는 저장된 응답 재생, 다르면 오류
CREATE TABLE admin_idempotency_keys (
    id short_id PRIMARY KEY,
    admin_id short_id NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    idempotency_key text NOT NULL
        CHECK (length(btrim(idempotency_key)) > 0),
    operation varchar(80) NOT NULL CHECK (length(btrim(operation)) > 0),
    request_hash text NOT NULL CHECK (length(request_hash) > 0),
    status varchar(12) NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed', 'failed')),
    response_status smallint CHECK (response_status BETWEEN 100 AND 599),
    response_body jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    UNIQUE (admin_id, idempotency_key),
    CHECK ((status = 'in_progress' AND completed_at IS NULL
                AND response_status IS NULL)
        OR (status <> 'in_progress' AND completed_at IS NOT NULL
                AND completed_at >= created_at))
);

CREATE INDEX admin_idempotency_keys_created_idx
    ON admin_idempotency_keys (created_at);

CREATE FUNCTION guard_admin_idempotency_key() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(OLD.admin_id, OLD.idempotency_key, OLD.operation,
           OLD.request_hash, OLD.created_at)
       IS DISTINCT FROM
       ROW(NEW.admin_id, NEW.idempotency_key, NEW.operation,
           NEW.request_hash, NEW.created_at) THEN
        RAISE EXCEPTION 'idempotency request identity is immutable'
            USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
        RAISE EXCEPTION 'completed idempotency key cannot reopen'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER admin_idempotency_keys_guard_before_update
BEFORE UPDATE ON admin_idempotency_keys
FOR EACH ROW EXECUTE FUNCTION guard_admin_idempotency_key();

-- 앱 API 멱등 키 (admin_idempotency_keys와 같은 규칙)
-- 같은 user_id + idempotency_key + 같은 request_hash는 저장된 응답 재생, 다르면 오류
CREATE TABLE user_idempotency_keys (
    id short_id PRIMARY KEY,
    user_id short_id NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idempotency_key text NOT NULL
        CHECK (length(btrim(idempotency_key)) > 0),
    operation varchar(80) NOT NULL CHECK (length(btrim(operation)) > 0),
    request_hash text NOT NULL CHECK (length(request_hash) > 0),
    status varchar(12) NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed', 'failed')),
    response_status smallint CHECK (response_status BETWEEN 100 AND 599),
    response_body jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    UNIQUE (user_id, idempotency_key),
    CHECK ((status = 'in_progress' AND completed_at IS NULL
                AND response_status IS NULL)
        OR (status <> 'in_progress' AND completed_at IS NOT NULL
                AND completed_at >= created_at))
);

CREATE INDEX user_idempotency_keys_created_idx
    ON user_idempotency_keys (created_at);

CREATE FUNCTION guard_user_idempotency_key() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(OLD.user_id, OLD.idempotency_key, OLD.operation,
           OLD.request_hash, OLD.created_at)
       IS DISTINCT FROM
       ROW(NEW.user_id, NEW.idempotency_key, NEW.operation,
           NEW.request_hash, NEW.created_at) THEN
        RAISE EXCEPTION 'idempotency request identity is immutable'
            USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
        RAISE EXCEPTION 'completed idempotency key cannot reopen'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER user_idempotency_keys_guard_before_update
BEFORE UPDATE ON user_idempotency_keys
FOR EACH ROW EXECUTE FUNCTION guard_user_idempotency_key();

-- 지급 재시도 상태, 워커는 locked_until로 행을 임대
-- 지급 멱등성은 challenge_reward_grants와 원장 키가 보장
CREATE TABLE challenge_reward_payment_attempts (
    run_id short_id NOT NULL,
    participation_id short_id NOT NULL,
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    last_error text,
    last_attempt_at timestamptz,
    next_retry_at timestamptz,
    locked_until timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (run_id, participation_id),
    FOREIGN KEY (run_id, participation_id)
        REFERENCES challenge_settlement_entries(run_id, participation_id)
        ON DELETE CASCADE,
    CHECK (attempt_count = 0 OR last_attempt_at IS NOT NULL)
);

CREATE INDEX challenge_reward_payment_attempts_due_idx
    ON challenge_reward_payment_attempts (next_retry_at)
    WHERE next_retry_at IS NOT NULL;

COMMIT;
