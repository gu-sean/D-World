-- 일별 스트릭 판정과 1회성 마일스톤 보상
-- 일수·요약·자격·원장은 앱이 원자적으로 재계산한다

BEGIN;

CREATE TABLE streak_days (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    streak_date date NOT NULL,
    status varchar(12) NOT NULL
        CHECK (status IN ('pending', 'success', 'failed')),
    qualifying_mission_id uuid,
    qualifying_record_id uuid,
    qualifying_result_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, streak_date),
    FOREIGN KEY (qualifying_mission_id, user_id)
        REFERENCES missions(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (qualifying_record_id, qualifying_mission_id)
        REFERENCES mission_records(id, mission_id) ON DELETE CASCADE,
    FOREIGN KEY (qualifying_result_id, qualifying_record_id)
        REFERENCES verification_results(id, record_id) ON DELETE CASCADE,
    CHECK (
        (status = 'success' AND qualifying_mission_id IS NOT NULL
            AND qualifying_record_id IS NOT NULL
            AND qualifying_result_id IS NOT NULL)
        OR (status <> 'success' AND qualifying_mission_id IS NULL
            AND qualifying_record_id IS NULL
            AND qualifying_result_id IS NULL)
    )
);

CREATE INDEX streak_days_user_recent_idx
    ON streak_days (user_id, streak_date DESC);

CREATE INDEX streak_days_pending_idx
    ON streak_days (streak_date) WHERE status = 'pending';

CREATE FUNCTION validate_streak_success() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    mission_date date;
    mission_status varchar(20);
    submitted_at timestamptz;
    result_decision varchar(20);
    result_is_current boolean;
BEGIN
    IF NEW.status <> 'success' THEN
        RETURN NEW;
    END IF;

    SELECT m.scheduled_date, m.status, mr.submitted_at,
           vr.decision, vr.is_current
      INTO mission_date, mission_status, submitted_at,
           result_decision, result_is_current
      FROM missions m
      JOIN mission_records mr ON mr.mission_id = m.id
      JOIN verification_results vr ON vr.record_id = mr.id
     WHERE m.id = NEW.qualifying_mission_id
       AND m.user_id = NEW.user_id
       AND mr.id = NEW.qualifying_record_id
       AND vr.id = NEW.qualifying_result_id;

    IF mission_date IS DISTINCT FROM NEW.streak_date
       OR mission_status IS DISTINCT FROM 'completed'
       OR submitted_at IS NULL
       OR (submitted_at AT TIME ZONE 'Asia/Seoul')::date
            IS DISTINCT FROM NEW.streak_date
       OR result_decision IS DISTINCT FROM 'approved'
       OR result_is_current IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'streak success requires a same-day submitted approved mission'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER streak_days_validate_success_before_write
BEFORE INSERT OR UPDATE OF status, qualifying_mission_id,
    qualifying_record_id, qualifying_result_id, streak_date
ON streak_days
FOR EACH ROW EXECUTE FUNCTION validate_streak_success();

CREATE TABLE streak_states (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_success_days integer NOT NULL DEFAULT 0
        CHECK (current_success_days >= 0),
    longest_success_days integer NOT NULL DEFAULT 0
        CHECK (longest_success_days >= current_success_days),
    last_success_date date,
    has_pending_days boolean NOT NULL DEFAULT false,
    last_recalculated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (current_success_days = 0 OR last_success_date IS NOT NULL)
);

CREATE TABLE streak_milestone_policy_versions (
    id uuid PRIMARY KEY,
    target_success_days integer NOT NULL
        CHECK (target_success_days IN (7, 30, 100)),
    version_no integer NOT NULL CHECK (version_no > 0),
    points integer NOT NULL CHECK (points >= 0),
    effective_at timestamptz NOT NULL,
    created_by_admin_id uuid NOT NULL
        REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (target_success_days, version_no),
    UNIQUE (id, target_success_days)
);

CREATE INDEX streak_milestone_policies_effective_idx
    ON streak_milestone_policy_versions
    (target_success_days, effective_at DESC);

CREATE FUNCTION protect_streak_milestone_policy() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'published streak milestone policies are immutable'
        USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER streak_milestone_policies_no_change
BEFORE UPDATE OR DELETE ON streak_milestone_policy_versions
FOR EACH ROW EXECUTE FUNCTION protect_streak_milestone_policy();

CREATE TABLE streak_milestone_awards (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_success_days integer NOT NULL
        CHECK (target_success_days IN (7, 30, 100)),
    policy_version_id uuid NOT NULL,
    awarded_points integer NOT NULL CHECK (awarded_points >= 0),
    paid_points integer NOT NULL CHECK (paid_points >= 0),
    first_achieved_date date NOT NULL,
    status varchar(12) NOT NULL
        CHECK (status IN ('active', 'revoked')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, target_success_days),
    UNIQUE (id, user_id),
    FOREIGN KEY (policy_version_id, target_success_days)
        REFERENCES streak_milestone_policy_versions(id, target_success_days)
        ON DELETE RESTRICT,
    FOREIGN KEY (user_id, first_achieved_date)
        REFERENCES streak_days(user_id, streak_date)
        DEFERRABLE INITIALLY DEFERRED,
    CHECK (paid_points <= awarded_points)
);

CREATE INDEX streak_milestone_awards_user_idx
    ON streak_milestone_awards (user_id, first_achieved_date DESC);

CREATE FUNCTION guard_streak_milestone_award() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    policy_points integer;
    policy_effective_at timestamptz;
    day_status varchar(12);
    last_failed_date date;
    successful_days integer;
    pending_days integer;
BEGIN
    SELECT points, effective_at
      INTO policy_points, policy_effective_at
      FROM streak_milestone_policy_versions
     WHERE id = NEW.policy_version_id
       AND target_success_days = NEW.target_success_days;

    SELECT status INTO day_status FROM streak_days
     WHERE user_id = NEW.user_id
       AND streak_date = NEW.first_achieved_date;

    SELECT max(streak_date) INTO last_failed_date
      FROM streak_days
     WHERE user_id = NEW.user_id
       AND streak_date <= NEW.first_achieved_date
       AND status = 'failed';

    SELECT count(*) FILTER (WHERE status = 'success'),
           count(*) FILTER (WHERE status = 'pending')
      INTO successful_days, pending_days
      FROM streak_days
     WHERE user_id = NEW.user_id
       AND streak_date > COALESCE(last_failed_date, '-infinity'::date)
       AND streak_date <= NEW.first_achieved_date;

    IF policy_points IS DISTINCT FROM NEW.awarded_points
       OR policy_effective_at IS NULL
       OR (policy_effective_at AT TIME ZONE 'Asia/Seoul')::date
            > NEW.first_achieved_date
       OR day_status IS DISTINCT FROM 'success'
       OR successful_days <> NEW.target_success_days
       OR pending_days <> 0 THEN
        RAISE EXCEPTION 'milestone award requires its first confirmed threshold day'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER streak_milestone_awards_guard_before_insert
BEFORE INSERT ON streak_milestone_awards
FOR EACH ROW EXECUTE FUNCTION guard_streak_milestone_award();

CREATE FUNCTION lock_streak_milestone_award_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(OLD.id, OLD.user_id, OLD.target_success_days,
           OLD.policy_version_id, OLD.awarded_points, OLD.paid_points,
           OLD.first_achieved_date, OLD.created_at)
       IS DISTINCT FROM
       ROW(NEW.id, NEW.user_id, NEW.target_success_days,
           NEW.policy_version_id, NEW.awarded_points, NEW.paid_points,
           NEW.first_achieved_date, NEW.created_at) THEN
        RAISE EXCEPTION 'streak award identity and original amount are immutable'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER streak_milestone_awards_lock_before_update
BEFORE UPDATE ON streak_milestone_awards
FOR EACH ROW EXECUTE FUNCTION lock_streak_milestone_award_identity();

CREATE FUNCTION protect_streak_milestone_award_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
        RAISE EXCEPTION 'streak award history cannot be deleted'
            USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER streak_milestone_awards_no_direct_delete
BEFORE DELETE ON streak_milestone_awards
FOR EACH ROW EXECUTE FUNCTION protect_streak_milestone_award_delete();

-- 스트릭 원장 소스의 소유자 검증
CREATE FUNCTION guard_streak_point_source() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.source_type = 'streak' AND NOT EXISTS (
        SELECT 1 FROM streak_milestone_awards
         WHERE id = NEW.source_id AND user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'streak point source does not belong to user'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER point_transactions_streak_source_before_insert
BEFORE INSERT ON point_transactions
FOR EACH ROW EXECUTE FUNCTION guard_streak_point_source();

-- 부모 행(회차·판정)이 연쇄로 지워질 때 자식 테이블 전체 스캔 방지
CREATE INDEX streak_days_qualifying_record_idx
    ON streak_days (qualifying_record_id)
    WHERE qualifying_record_id IS NOT NULL;
CREATE INDEX streak_days_qualifying_result_idx
    ON streak_days (qualifying_result_id)
    WHERE qualifying_result_id IS NOT NULL;

COMMIT;
