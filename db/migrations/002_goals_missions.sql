-- 목표, 미션 원형, 날짜별 실행 미션

BEGIN;

CREATE TABLE goal_categories (
    id uuid PRIMARY KEY,
    code varchar(40) NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]*$'),
    name varchar(80) NOT NULL UNIQUE CHECK (length(btrim(name)) > 0),
    display_order integer NOT NULL CHECK (display_order >= 0),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX goal_categories_visible_idx
    ON goal_categories (is_active, display_order, id);

CREATE TABLE difficulty_levels (
    id uuid PRIMARY KEY,
    code varchar(40) NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]*$'),
    name varchar(80) NOT NULL UNIQUE CHECK (length(btrim(name)) > 0),
    display_order integer NOT NULL CHECK (display_order >= 0),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX difficulty_levels_visible_idx
    ON difficulty_levels (is_active, display_order, id);

CREATE TABLE goals (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES goal_categories(id) ON DELETE RESTRICT,
    difficulty_id uuid NOT NULL REFERENCES difficulty_levels(id) ON DELETE RESTRICT,
    title varchar(200) NOT NULL CHECK (length(btrim(title)) > 0),
    description text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    target_frequency smallint CHECK (target_frequency BETWEEN 1 AND 7),
    status varchar(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'completed')),
    completed_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, user_id),
    CHECK (end_date >= start_date),
    CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);

CREATE INDEX goals_user_list_idx
    ON goals (user_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE goal_steps (
    id uuid PRIMARY KEY,
    goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    step_no integer NOT NULL CHECK (step_no > 0),
    title varchar(200) NOT NULL CHECK (length(btrim(title)) > 0),
    description text,
    due_date date NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed')),
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (goal_id, step_no),
    UNIQUE (id, goal_id),
    CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);

CREATE TABLE mission_definitions (
    id uuid PRIMARY KEY,
    origin varchar(20) NOT NULL CHECK (origin IN ('admin', 'user')),
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    title varchar(200) NOT NULL CHECK (length(btrim(title)) > 0),
    description text,
    category_id uuid NOT NULL REFERENCES goal_categories(id) ON DELETE RESTRICT,
    difficulty_id uuid NOT NULL REFERENCES difficulty_levels(id) ON DELETE RESTRICT,
    estimated_duration_seconds integer
        CHECK (estimated_duration_seconds > 0),
    target_value numeric(10,2) CHECK (target_value > 0),
    target_unit varchar(20),
    verification_method varchar(30) NOT NULL
        CHECK (verification_method IN ('camera', 'sensor')),
    publication_status varchar(24) NOT NULL
        CHECK (publication_status IN
            ('draft', 'private', 'review_pending', 'public', 'rejected', 'hidden')),
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((target_value IS NULL) = (target_unit IS NULL)),
    CHECK (target_unit IS NULL OR length(btrim(target_unit)) > 0),
    CHECK (origin <> 'admin' OR created_by_user_id IS NULL),
    CHECK (origin <> 'user' OR publication_status <> 'draft'),
    CHECK (origin <> 'user' OR created_by_user_id IS NOT NULL
        OR publication_status = 'public')
);

CREATE INDEX mission_definitions_public_list_idx
    ON mission_definitions
    (publication_status, category_id, difficulty_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX mission_definitions_owner_idx
    ON mission_definitions (created_by_user_id, created_at DESC)
    WHERE created_by_user_id IS NOT NULL;

CREATE TABLE mission_publication_reviews (
    id uuid PRIMARY KEY,
    definition_id uuid NOT NULL REFERENCES mission_definitions(id) ON DELETE CASCADE,
    requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by_admin_id uuid REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    decision varchar(20) NOT NULL
        CHECK (decision IN ('submitted', 'approved', 'rejected', 'hidden')),
    reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (
        (decision = 'submitted' AND reviewed_by_admin_id IS NULL)
        OR (decision <> 'submitted' AND reviewed_by_admin_id IS NOT NULL)
    ),
    CHECK (decision NOT IN ('rejected', 'hidden')
        OR (reason IS NOT NULL AND length(btrim(reason)) > 0))
);

CREATE INDEX mission_publication_reviews_definition_idx
    ON mission_publication_reviews (definition_id, created_at DESC);

CREATE TABLE ai_plan_proposals (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id uuid NOT NULL,
    generation_no integer NOT NULL CHECK (generation_no > 0),
    status varchar(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'accepted', 'rejected', 'expired')),
    proposal_json jsonb NOT NULL
        CHECK (jsonb_typeof(proposal_json) = 'object'),
    accepted_plan_json jsonb
        CHECK (accepted_plan_json IS NULL
            OR jsonb_typeof(accepted_plan_json) = 'object'),
    generated_at timestamptz NOT NULL DEFAULT now(),
    accepted_at timestamptz,
    UNIQUE (id, user_id),
    UNIQUE (goal_id, generation_no),
    FOREIGN KEY (goal_id, user_id)
        REFERENCES goals(id, user_id) ON DELETE CASCADE,
    CHECK (
        (status = 'accepted') =
        (accepted_at IS NOT NULL AND accepted_plan_json IS NOT NULL)
    )
);

CREATE INDEX ai_plan_proposals_goal_idx
    ON ai_plan_proposals (goal_id, generated_at DESC);

CREATE TABLE missions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id uuid,
    goal_step_id uuid,
    definition_id uuid REFERENCES mission_definitions(id) ON DELETE RESTRICT,
    source_proposal_id uuid,
    source_type varchar(20) NOT NULL
        CHECK (source_type IN ('user', 'template', 'ai')),
    title varchar(200) NOT NULL CHECK (length(btrim(title)) > 0),
    description text,
    category_id uuid NOT NULL REFERENCES goal_categories(id) ON DELETE RESTRICT,
    difficulty_id uuid NOT NULL REFERENCES difficulty_levels(id) ON DELETE RESTRICT,
    target_value numeric(10,2) CHECK (target_value > 0),
    target_unit varchar(20),
    estimated_duration_seconds integer
        CHECK (estimated_duration_seconds > 0),
    verification_method varchar(30) NOT NULL
        CHECK (verification_method IN ('camera', 'sensor')),
    scheduled_date date NOT NULL,
    due_at timestamptz,
    is_required boolean NOT NULL DEFAULT true,
    status varchar(20) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN
            ('scheduled', 'in_progress', 'submitted', 'completed', 'failed', 'cancelled')),
    memo text,
    cancel_reason varchar(30),
    cancelled_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (goal_id, user_id)
        REFERENCES goals(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (goal_step_id, goal_id)
        REFERENCES goal_steps(id, goal_id) ON DELETE CASCADE,
    FOREIGN KEY (source_proposal_id, user_id)
        REFERENCES ai_plan_proposals(id, user_id)
        DEFERRABLE INITIALLY DEFERRED,
    CHECK (goal_step_id IS NULL OR goal_id IS NOT NULL),
    CHECK ((target_value IS NULL) = (target_unit IS NULL)),
    CHECK (target_unit IS NULL OR length(btrim(target_unit)) > 0),
    CHECK (
        (source_type = 'ai' AND source_proposal_id IS NOT NULL)
        OR (source_type <> 'ai' AND source_proposal_id IS NULL)
    ),
    CHECK (source_type <> 'template' OR definition_id IS NOT NULL),
    CHECK (
        (status = 'cancelled' AND cancelled_at IS NOT NULL
            AND cancel_reason IS NOT NULL)
        OR (status <> 'cancelled' AND cancelled_at IS NULL
            AND cancel_reason IS NULL)
    ),
    CHECK (cancel_reason IS NULL OR length(btrim(cancel_reason)) > 0)
);

CREATE INDEX missions_user_day_idx
    ON missions (user_id, scheduled_date, status)
    WHERE deleted_at IS NULL;

CREATE INDEX missions_goal_status_idx
    ON missions (goal_id, status)
    WHERE goal_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX missions_step_required_idx
    ON missions (goal_step_id, is_required, status)
    WHERE goal_step_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX missions_definition_idx
    ON missions (definition_id)
    WHERE definition_id IS NOT NULL;

-- 수행이 시작되면 실행·판정에 영향을 주는 필드는 고정한다
CREATE FUNCTION lock_started_mission_rules() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status <> 'scheduled' OR NEW.status <> 'scheduled' THEN
        IF ROW(OLD.user_id, OLD.goal_id, OLD.goal_step_id,
               OLD.source_proposal_id, OLD.source_type, OLD.title, OLD.description,
               OLD.category_id, OLD.difficulty_id, OLD.target_value,
               OLD.target_unit, OLD.estimated_duration_seconds,
               OLD.verification_method, OLD.scheduled_date, OLD.due_at,
               OLD.is_required)
           IS DISTINCT FROM
           ROW(NEW.user_id, NEW.goal_id, NEW.goal_step_id,
               NEW.source_proposal_id, NEW.source_type, NEW.title, NEW.description,
               NEW.category_id, NEW.difficulty_id, NEW.target_value,
               NEW.target_unit, NEW.estimated_duration_seconds,
               NEW.verification_method, NEW.scheduled_date, NEW.due_at,
               NEW.is_required) THEN
            RAISE EXCEPTION 'mission rules cannot change after execution starts';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER missions_lock_rules_before_update
BEFORE UPDATE ON missions
FOR EACH ROW EXECUTE FUNCTION lock_started_mission_rules();

-- 작성자 본인 또는 공개 승인 후에만 사용할 수 있다
-- AI 미션은 수락된 제안에서만 만들 수 있다
CREATE FUNCTION validate_mission_source() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    definition_owner uuid;
    definition_status varchar(24);
    proposal_status varchar(20);
BEGIN
    IF NEW.definition_id IS NOT NULL THEN
        SELECT created_by_user_id, publication_status
          INTO definition_owner, definition_status
          FROM mission_definitions
         WHERE id = NEW.definition_id;

        IF definition_status IS NULL
           OR definition_status = 'hidden'
           OR (definition_status <> 'public'
               AND definition_owner IS DISTINCT FROM NEW.user_id) THEN
            RAISE EXCEPTION 'mission definition is not available to this user'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF NEW.source_proposal_id IS NOT NULL THEN
        SELECT status INTO proposal_status
          FROM ai_plan_proposals
         WHERE id = NEW.source_proposal_id AND user_id = NEW.user_id;

        IF proposal_status IS DISTINCT FROM 'accepted' THEN
            RAISE EXCEPTION 'AI proposal must be accepted before creating missions'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER missions_validate_source_before_write
BEFORE INSERT OR UPDATE OF definition_id, source_proposal_id, source_type, user_id
ON missions
FOR EACH ROW EXECUTE FUNCTION validate_mission_source();

-- 목표를 소프트 삭제하면 시작 전 미션은 사용자 계획에서 제외한다
CREATE FUNCTION cancel_unstarted_missions_for_deleted_goal() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        UPDATE missions
           SET status = 'cancelled',
               cancel_reason = 'goal_deleted',
               cancelled_at = NEW.deleted_at,
               deleted_at = NEW.deleted_at,
               updated_at = now()
         WHERE goal_id = NEW.id
           AND status = 'scheduled'
           AND deleted_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER goals_cancel_unstarted_missions_after_delete_mark
AFTER UPDATE OF deleted_at ON goals
FOR EACH ROW EXECUTE FUNCTION cancel_unstarted_missions_for_deleted_goal();

-- 탈퇴 시 검수 사유 삭제, 공개 작성자 FK만 끊겨 익명으로 남음
CREATE FUNCTION scrub_user_mission_reviews() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE mission_publication_reviews
       SET reason = NULL
     WHERE requested_by_user_id = OLD.id;
    RETURN OLD;
END;
$$;

CREATE TRIGGER users_scrub_mission_reviews_before_delete
BEFORE DELETE ON users
FOR EACH ROW EXECUTE FUNCTION scrub_user_mission_reviews();

COMMIT;
