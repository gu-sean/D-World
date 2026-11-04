-- 포인트 보상, 지갑, 추가 전용 원장, 월간 한도
-- 지갑·한도·원장은 앱이 지갑 행 잠금 아래 한 트랜잭션으로 갱신

BEGIN;

ALTER TABLE mission_definitions
    ADD COLUMN base_points integer NOT NULL DEFAULT 0 CHECK (base_points >= 0);

CREATE TABLE mission_reward_rate_versions (
    id uuid PRIMARY KEY,
    category_id uuid NOT NULL REFERENCES goal_categories(id) ON DELETE RESTRICT,
    difficulty_id uuid NOT NULL REFERENCES difficulty_levels(id) ON DELETE RESTRICT,
    version_no integer NOT NULL CHECK (version_no > 0),
    points integer NOT NULL CHECK (points >= 0),
    effective_at timestamptz NOT NULL,
    created_by_admin_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (category_id, difficulty_id, version_no),
    UNIQUE (id, category_id, difficulty_id)
);

CREATE INDEX mission_reward_rates_effective_idx
    ON mission_reward_rate_versions
    (category_id, difficulty_id, effective_at DESC);

CREATE FUNCTION protect_mission_reward_rate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'published reward rates are immutable'
        USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER mission_reward_rates_no_change
BEFORE UPDATE OR DELETE ON mission_reward_rate_versions
FOR EACH ROW EXECUTE FUNCTION protect_mission_reward_rate();

ALTER TABLE missions
    ADD COLUMN reward_points integer NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
    ADD COLUMN reward_rate_version_id uuid,
    ADD CONSTRAINT missions_reward_rate_matches_category_difficulty
        FOREIGN KEY (reward_rate_version_id, category_id, difficulty_id)
        REFERENCES mission_reward_rate_versions(id, category_id, difficulty_id)
        ON DELETE RESTRICT;

CREATE FUNCTION validate_mission_reward() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    definition_origin varchar(20);
    definition_points integer;
    rate_points integer;
    rate_effective_at timestamptz;
BEGIN
    IF NEW.source_type = 'template' THEN
        SELECT origin, base_points
          INTO definition_origin, definition_points
          FROM mission_definitions WHERE id = NEW.definition_id;
        IF definition_origin = 'admin' THEN
            IF definition_points IS DISTINCT FROM NEW.reward_points OR
               NEW.reward_rate_version_id IS NOT NULL THEN
                RAISE EXCEPTION 'template reward must match administrator definition'
                    USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END IF;
    END IF;

    IF NEW.reward_rate_version_id IS NOT NULL THEN
        SELECT points, effective_at INTO rate_points, rate_effective_at
          FROM mission_reward_rate_versions
         WHERE id = NEW.reward_rate_version_id;
        IF rate_points IS DISTINCT FROM NEW.reward_points OR
           rate_effective_at > NEW.created_at THEN
            RAISE EXCEPTION 'mission reward must match effective rate version'
                USING ERRCODE = '23514';
        END IF;
    ELSIF NEW.reward_points <> 0 THEN
        RAISE EXCEPTION 'positive mission reward requires a rate version'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER missions_validate_reward_before_insert
BEFORE INSERT ON missions
FOR EACH ROW EXECUTE FUNCTION validate_mission_reward();

CREATE FUNCTION lock_mission_reward() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(OLD.reward_points, OLD.reward_rate_version_id)
       IS DISTINCT FROM ROW(NEW.reward_points, NEW.reward_rate_version_id) THEN
        RAISE EXCEPTION 'mission reward is fixed at creation'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER missions_lock_reward_before_update
BEFORE UPDATE ON missions
FOR EACH ROW EXECUTE FUNCTION lock_mission_reward();

CREATE TABLE point_monthly_cap_policies (
    id uuid PRIMARY KEY,
    effective_month date NOT NULL UNIQUE,
    monthly_limit_points integer NOT NULL CHECK (monthly_limit_points >= 0),
    created_by_admin_id uuid REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (EXTRACT(DAY FROM effective_month) = 1),
    CHECK (created_by_admin_id IS NOT NULL OR
        id = '00000000-0000-0000-0000-000000000004'::uuid)
);

CREATE FUNCTION guard_point_cap_policy() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.created_by_admin_id IS NOT NULL AND
       NEW.effective_month <= date_trunc('month',
           NEW.created_at AT TIME ZONE 'Asia/Seoul')::date THEN
        RAISE EXCEPTION 'new cap policy must start next month or later'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER point_cap_policy_guard_before_insert
BEFORE INSERT ON point_monthly_cap_policies
FOR EACH ROW EXECUTE FUNCTION guard_point_cap_policy();

CREATE TRIGGER point_cap_policies_no_change
BEFORE UPDATE OR DELETE ON point_monthly_cap_policies
FOR EACH ROW EXECUTE FUNCTION protect_mission_reward_rate();

INSERT INTO point_monthly_cap_policies
    (id, effective_month, monthly_limit_points)
VALUES
    ('00000000-0000-0000-0000-000000000004',
     date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date,
     100000);

CREATE TABLE point_wallets (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    available_points bigint NOT NULL DEFAULT 0 CHECK (available_points >= 0),
    outstanding_recovery_points bigint NOT NULL DEFAULT 0
        CHECK (outstanding_recovery_points >= 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE point_monthly_usage (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_start_date date NOT NULL,
    gross_auto_awarded_points bigint NOT NULL DEFAULT 0
        CHECK (gross_auto_awarded_points >= 0),
    same_month_recovered_points bigint NOT NULL DEFAULT 0
        CHECK (same_month_recovered_points >= 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, month_start_date),
    CHECK (EXTRACT(DAY FROM month_start_date) = 1),
    CHECK (same_month_recovered_points <= gross_auto_awarded_points)
);

CREATE TABLE mission_point_awards (
    mission_id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    first_approved_result_id uuid NOT NULL REFERENCES verification_results(id)
        ON DELETE CASCADE,
    original_points integer NOT NULL CHECK (original_points >= 0),
    paid_points integer NOT NULL CHECK (paid_points >= 0),
    status varchar(16) NOT NULL CHECK (status IN ('active', 'revoked')),
    awarded_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (mission_id, user_id),
    FOREIGN KEY (mission_id, user_id)
        REFERENCES missions(id, user_id) ON DELETE CASCADE,
    CHECK (paid_points <= original_points)
);

CREATE INDEX mission_point_awards_user_idx
    ON mission_point_awards (user_id, awarded_at DESC);

CREATE FUNCTION guard_mission_point_award() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    expected_points integer;
    result_mission_id uuid;
    result_decision varchar(20);
    result_is_current boolean;
BEGIN
    SELECT reward_points INTO expected_points
      FROM missions WHERE id = NEW.mission_id AND user_id = NEW.user_id;
    SELECT mr.mission_id, vr.decision, vr.is_current
      INTO result_mission_id, result_decision, result_is_current
      FROM verification_results vr
      JOIN mission_records mr ON mr.id = vr.record_id
     WHERE vr.id = NEW.first_approved_result_id;
    IF expected_points IS NULL OR expected_points <> NEW.original_points OR
       result_mission_id IS DISTINCT FROM NEW.mission_id OR
       result_decision IS DISTINCT FROM 'approved' OR
       result_is_current IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'mission award requires its own approved result and fixed reward'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER mission_point_awards_guard_before_insert
BEFORE INSERT ON mission_point_awards
FOR EACH ROW EXECUTE FUNCTION guard_mission_point_award();

CREATE FUNCTION lock_mission_point_award_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(OLD.mission_id, OLD.user_id, OLD.first_approved_result_id,
           OLD.original_points, OLD.paid_points, OLD.awarded_at)
       IS DISTINCT FROM
       ROW(NEW.mission_id, NEW.user_id, NEW.first_approved_result_id,
           NEW.original_points, NEW.paid_points, NEW.awarded_at) THEN
        RAISE EXCEPTION 'mission award identity and original amount are immutable'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER mission_point_awards_lock_before_update
BEFORE UPDATE ON mission_point_awards
FOR EACH ROW EXECUTE FUNCTION lock_mission_point_award_identity();

CREATE TABLE point_recovery_claims (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mission_id uuid NOT NULL,
    original_award_transaction_id uuid NOT NULL,
    target_points bigint NOT NULL CHECK (target_points > 0),
    outstanding_points bigint NOT NULL CHECK (outstanding_points >= 0),
    settled_points bigint NOT NULL DEFAULT 0 CHECK (settled_points >= 0),
    is_cancelled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    cancelled_at timestamptz,
    FOREIGN KEY (mission_id, user_id)
        REFERENCES mission_point_awards(mission_id, user_id) ON DELETE CASCADE,
    CHECK (outstanding_points + settled_points <= target_points),
    CHECK (is_cancelled = (cancelled_at IS NOT NULL))
);

CREATE INDEX point_recovery_claims_pending_idx
    ON point_recovery_claims (user_id, created_at, id)
    WHERE outstanding_points > 0 AND NOT is_cancelled;

CREATE TABLE point_transactions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind varchar(32) NOT NULL CHECK (kind IN
        ('auto_award', 'award_offset', 'spend', 'refund', 'refund_offset',
         'recovery', 'recovery_claim', 'recovery_settlement',
         'recovery_cancel', 'reinstatement', 'manual_grant',
         'manual_recovery')),
    available_delta bigint NOT NULL DEFAULT 0,
    outstanding_delta bigint NOT NULL DEFAULT 0,
    balance_after bigint NOT NULL CHECK (balance_after >= 0),
    outstanding_after bigint NOT NULL CHECK (outstanding_after >= 0),
    source_type varchar(32) NOT NULL CHECK (source_type IN
        ('mission', 'streak', 'achievement', 'challenge',
         'shop_order', 'admin_adjustment')),
    source_id uuid NOT NULL,
    original_transaction_id uuid,
    recovery_claim_id uuid,
    cap_month date,
    cap_delta bigint NOT NULL DEFAULT 0,
    idempotency_key text NOT NULL UNIQUE CHECK (length(btrim(idempotency_key)) > 0),
    created_by_admin_id uuid REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    reason text,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, user_id),
    FOREIGN KEY (original_transaction_id, user_id)
        REFERENCES point_transactions(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (recovery_claim_id)
        REFERENCES point_recovery_claims(id) ON DELETE CASCADE,
    CHECK (available_delta <> 0 OR outstanding_delta <> 0 OR cap_delta <> 0),
    CHECK ((cap_month IS NULL AND cap_delta = 0) OR
        (cap_month IS NOT NULL AND cap_delta <> 0 AND
         EXTRACT(DAY FROM cap_month) = 1)),
    CHECK (source_type <> 'admin_adjustment' OR
        (created_by_admin_id IS NOT NULL AND reason IS NOT NULL AND
         length(btrim(reason)) > 0))
);

ALTER TABLE point_recovery_claims
    ADD CONSTRAINT point_recovery_original_award_owner_fk
    FOREIGN KEY (original_award_transaction_id, user_id)
    REFERENCES point_transactions(id, user_id) ON DELETE CASCADE;

CREATE INDEX point_transactions_user_recent_idx
    ON point_transactions (user_id, occurred_at DESC, id DESC);

CREATE INDEX point_transactions_source_idx
    ON point_transactions (source_type, source_id);

CREATE FUNCTION guard_point_transaction() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    wallet_available bigint;
    wallet_outstanding bigint;
    claim_user_id uuid;
BEGIN
    -- 지갑 행 잠금으로 사용자별 거래를 직렬화, 스냅샷은 잠근 뒤 값과 일치해야 함
    SELECT available_points, outstanding_recovery_points
      INTO wallet_available, wallet_outstanding
      FROM point_wallets WHERE user_id = NEW.user_id FOR UPDATE;
    IF wallet_available IS NULL OR
       wallet_available <> NEW.balance_after OR
       wallet_outstanding <> NEW.outstanding_after THEN
        RAISE EXCEPTION 'point transaction snapshot must match locked wallet'
            USING ERRCODE = '23514';
    END IF;
    IF NEW.recovery_claim_id IS NOT NULL THEN
        SELECT user_id INTO claim_user_id FROM point_recovery_claims
         WHERE id = NEW.recovery_claim_id;
        IF claim_user_id IS DISTINCT FROM NEW.user_id THEN
            RAISE EXCEPTION 'recovery claim belongs to another user'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER point_transactions_guard_before_insert
BEFORE INSERT ON point_transactions
FOR EACH ROW EXECUTE FUNCTION guard_point_transaction();

CREATE FUNCTION protect_point_transaction() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' AND NOT EXISTS (
        SELECT 1 FROM users WHERE id = OLD.user_id
    ) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'point transactions are append-only'
        USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER point_transactions_no_change
BEFORE UPDATE OR DELETE ON point_transactions
FOR EACH ROW EXECUTE FUNCTION protect_point_transaction();

-- 부모 행(판정·회수 청구)이 연쇄로 지워질 때 자식 테이블 전체 스캔 방지
CREATE INDEX mission_point_awards_first_result_idx
    ON mission_point_awards (first_approved_result_id);
CREATE INDEX point_transactions_recovery_claim_idx
    ON point_transactions (recovery_claim_id)
    WHERE recovery_claim_id IS NOT NULL;

COMMIT;
