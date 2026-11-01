-- 추천 문구와 AI 분석 결과 저장
BEGIN;

CREATE TABLE recommendation_messages (
    id uuid PRIMARY KEY,
    message varchar(200) NOT NULL CHECK (length(btrim(message)) > 0),
    condition_type varchar(20) NOT NULL CHECK (condition_type IN
        ('always', 'no_mission_today', 'streak_at_risk', 'inactive_days', 'time_slot')),
    condition_params jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(condition_params) = 'object'),
    category_id uuid REFERENCES goal_categories(id) ON DELETE RESTRICT,
    priority smallint NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
    starts_at timestamptz,
    ends_at timestamptz,
    is_active boolean NOT NULL DEFAULT true,
    created_by_admin_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    updated_by_admin_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at),
    CHECK (
        (condition_type IN ('always', 'no_mission_today', 'streak_at_risk')
            AND condition_params = '{}'::jsonb)
        OR (condition_type = 'inactive_days'
            AND condition_params ? 'days'
            AND (condition_params - 'days') = '{}'::jsonb
            AND CASE WHEN condition_params->>'days' ~ '^[0-9]{1,3}$'
                     THEN (condition_params->>'days')::int BETWEEN 1 AND 365
                     ELSE false END)
        OR (condition_type = 'time_slot'
            AND condition_params ?& ARRAY['start_hour', 'end_hour']
            AND (condition_params - 'start_hour' - 'end_hour') = '{}'::jsonb
            AND CASE WHEN condition_params->>'start_hour' ~ '^[0-9]{1,2}$'
                      AND condition_params->>'end_hour' ~ '^[0-9]{1,2}$'
                     THEN (condition_params->>'start_hour')::int BETWEEN 0 AND 23
                      AND (condition_params->>'end_hour')::int BETWEEN 0 AND 23
                      AND (condition_params->>'start_hour')
                          <> (condition_params->>'end_hour')
                     ELSE false END)
    )
);

CREATE INDEX recommendation_messages_active_idx
    ON recommendation_messages (priority DESC, id) WHERE is_active;

CREATE TABLE ai_analysis_runs (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    run_type varchar(28) NOT NULL CHECK (run_type IN
        ('plan_adjustment', 'situational_recommendation',
         'weekly_report', 'monthly_report')),
    period_start date,
    period_end date,
    status varchar(10) NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'completed', 'failed')),
    engine_version varchar(80) CHECK (engine_version IS NULL OR length(btrim(engine_version)) > 0),
    ingest_key text UNIQUE CHECK (ingest_key IS NULL OR length(btrim(ingest_key)) > 0),
    failure_reason text,
    requested_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    UNIQUE (id, user_id),
    UNIQUE (id, run_type),
    CHECK (
        (run_type = 'situational_recommendation'
            AND period_start IS NULL AND period_end IS NULL)
        OR (run_type = 'plan_adjustment'
            AND period_start IS NOT NULL AND period_end >= period_start)
        OR (run_type = 'weekly_report' AND period_start IS NOT NULL
            AND EXTRACT(ISODOW FROM period_start) = 1
            AND period_end = period_start + 6)
        OR (run_type = 'monthly_report' AND period_start IS NOT NULL
            AND EXTRACT(DAY FROM period_start) = 1
            AND period_end = ((period_start + interval '1 month')::date - 1))
    ),
    CHECK (
        (status = 'requested' AND completed_at IS NULL AND failure_reason IS NULL)
        OR (status = 'completed' AND completed_at IS NOT NULL
            AND engine_version IS NOT NULL AND failure_reason IS NULL)
        OR (status = 'failed' AND completed_at IS NOT NULL
            AND failure_reason IS NOT NULL AND length(btrim(failure_reason)) > 0)
    )
);

CREATE UNIQUE INDEX ai_runs_one_live_period_uq
    ON ai_analysis_runs (user_id, run_type, period_start)
    WHERE period_start IS NOT NULL AND status <> 'failed';
CREATE INDEX ai_runs_user_recent_idx
    ON ai_analysis_runs (user_id, run_type, requested_at DESC);
CREATE INDEX ai_runs_pending_idx
    ON ai_analysis_runs (requested_at) WHERE status = 'requested';

CREATE TABLE plan_adjustment_proposals (
    id uuid PRIMARY KEY,
    run_id uuid NOT NULL,
    run_type varchar(28) NOT NULL DEFAULT 'plan_adjustment'
        CHECK (run_type = 'plan_adjustment'),
    user_id uuid NOT NULL,
    goal_id uuid NOT NULL,
    status varchar(10) NOT NULL DEFAULT 'proposed'
        CHECK (status IN ('proposed', 'accepted', 'rejected', 'expired')),
    proposal_json jsonb NOT NULL CHECK (jsonb_typeof(proposal_json) = 'object'),
    accepted_plan_json jsonb
        CHECK (accepted_plan_json IS NULL OR jsonb_typeof(accepted_plan_json) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    decided_at timestamptz,
    UNIQUE (run_id, goal_id),
    FOREIGN KEY (run_id, user_id) REFERENCES ai_analysis_runs(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (run_id, run_type) REFERENCES ai_analysis_runs(id, run_type) ON DELETE CASCADE,
    FOREIGN KEY (goal_id, user_id) REFERENCES goals(id, user_id) ON DELETE CASCADE,
    CHECK (expires_at IS NULL OR expires_at > created_at),
    CHECK (
        (status = 'proposed' AND decided_at IS NULL AND accepted_plan_json IS NULL)
        OR (status = 'accepted' AND decided_at IS NOT NULL
            AND accepted_plan_json IS NOT NULL)
        OR (status IN ('rejected', 'expired') AND decided_at IS NOT NULL
            AND accepted_plan_json IS NULL)
    )
);

CREATE INDEX plan_adjustment_goal_idx
    ON plan_adjustment_proposals (goal_id, created_at DESC);
CREATE INDEX plan_adjustment_open_idx
    ON plan_adjustment_proposals (user_id, created_at DESC) WHERE status = 'proposed';

CREATE TABLE ai_reports (
    run_id uuid PRIMARY KEY,
    run_type varchar(28) NOT NULL CHECK (run_type IN ('weekly_report', 'monthly_report')),
    user_id uuid NOT NULL,
    title varchar(160) NOT NULL CHECK (length(btrim(title)) > 0),
    summary text NOT NULL CHECK (length(btrim(summary)) > 0),
    content_json jsonb NOT NULL CHECK (jsonb_typeof(content_json) = 'object'),
    generated_at timestamptz NOT NULL DEFAULT now(),
    read_at timestamptz,
    FOREIGN KEY (run_id, user_id) REFERENCES ai_analysis_runs(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (run_id, run_type) REFERENCES ai_analysis_runs(id, run_type) ON DELETE CASCADE,
    CHECK (read_at IS NULL OR read_at >= generated_at)
);

CREATE INDEX ai_reports_user_recent_idx ON ai_reports (user_id, generated_at DESC);

CREATE TABLE ai_mission_recommendations (
    id uuid PRIMARY KEY,
    run_id uuid NOT NULL,
    run_type varchar(28) NOT NULL DEFAULT 'situational_recommendation'
        CHECK (run_type = 'situational_recommendation'),
    user_id uuid NOT NULL,
    rank_no smallint NOT NULL CHECK (rank_no BETWEEN 1 AND 20),
    mission_definition_id uuid REFERENCES mission_definitions(id) ON DELETE CASCADE,
    suggestion_text varchar(200)
        CHECK (suggestion_text IS NULL OR length(btrim(suggestion_text)) > 0),
    reason text,
    context jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(context) = 'object'
               AND NOT (context ?| ARRAY['latitude', 'longitude', 'lat', 'lng', 'lon'])),
    status varchar(10) NOT NULL DEFAULT 'shown'
        CHECK (status IN ('shown', 'accepted', 'dismissed', 'expired')),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    decided_at timestamptz,
    UNIQUE (run_id, rank_no),
    FOREIGN KEY (run_id, user_id) REFERENCES ai_analysis_runs(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (run_id, run_type) REFERENCES ai_analysis_runs(id, run_type) ON DELETE CASCADE,
    CHECK (mission_definition_id IS NOT NULL OR suggestion_text IS NOT NULL),
    CHECK (expires_at IS NULL OR expires_at > created_at),
    CHECK ((status = 'shown') = (decided_at IS NULL))
);

CREATE INDEX ai_mission_recommendations_user_idx
    ON ai_mission_recommendations (user_id, created_at DESC) WHERE status = 'shown';

-- 결과는 열린 실행에만 붙일 수 있다
CREATE FUNCTION guard_ai_result_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    run_status varchar(10);
BEGIN
    SELECT status INTO run_status FROM ai_analysis_runs WHERE id = NEW.run_id;
    IF run_status IS DISTINCT FROM 'requested' THEN
        RAISE EXCEPTION 'results attach only to an open analysis run'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER plan_adjustment_guard_before_insert BEFORE INSERT ON plan_adjustment_proposals
FOR EACH ROW EXECUTE FUNCTION guard_ai_result_insert();
CREATE TRIGGER ai_reports_guard_before_insert BEFORE INSERT ON ai_reports
FOR EACH ROW EXECUTE FUNCTION guard_ai_result_insert();
CREATE TRIGGER ai_recommendations_guard_before_insert BEFORE INSERT ON ai_mission_recommendations
FOR EACH ROW EXECUTE FUNCTION guard_ai_result_insert();

-- requested → completed/failed는 한 번만, 완료하려면 결과가 있어야 함
CREATE FUNCTION guard_ai_run_update() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    has_result boolean;
BEGIN
    IF ROW(OLD.user_id, OLD.run_type, OLD.period_start, OLD.period_end, OLD.requested_at)
       IS DISTINCT FROM
       ROW(NEW.user_id, NEW.run_type, NEW.period_start, NEW.period_end, NEW.requested_at) THEN
        RAISE EXCEPTION 'analysis run identity is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.status <> 'requested' AND
       ROW(OLD.status, OLD.engine_version, OLD.ingest_key, OLD.failure_reason, OLD.completed_at)
       IS DISTINCT FROM
       ROW(NEW.status, NEW.engine_version, NEW.ingest_key, NEW.failure_reason, NEW.completed_at) THEN
        RAISE EXCEPTION 'finished analysis run cannot change' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'requested' AND NEW.status = 'completed' THEN
        has_result := CASE NEW.run_type
            WHEN 'plan_adjustment' THEN EXISTS (SELECT 1 FROM plan_adjustment_proposals WHERE run_id = NEW.id)
            WHEN 'situational_recommendation' THEN EXISTS (SELECT 1 FROM ai_mission_recommendations WHERE run_id = NEW.id)
            ELSE EXISTS (SELECT 1 FROM ai_reports WHERE run_id = NEW.id)
        END;
        IF NOT has_result THEN
            RAISE EXCEPTION 'a completed run needs its result' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER ai_runs_guard_before_update BEFORE UPDATE ON ai_analysis_runs
FOR EACH ROW EXECUTE FUNCTION guard_ai_run_update();

-- 리포트: read_at만 한 번 바꿀 수 있다
CREATE FUNCTION guard_ai_report_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(OLD.run_id, OLD.run_type, OLD.user_id, OLD.title, OLD.summary,
           OLD.content_json, OLD.generated_at)
       IS DISTINCT FROM
       ROW(NEW.run_id, NEW.run_type, NEW.user_id, NEW.title, NEW.summary,
           NEW.content_json, NEW.generated_at)
       OR (OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at) THEN
        RAISE EXCEPTION 'report content is immutable; read time is set once'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER ai_reports_guard_before_update BEFORE UPDATE ON ai_reports
FOR EACH ROW EXECUTE FUNCTION guard_ai_report_update();

-- 제안·추천: 내용은 고정하고 결정은 한 번만 내린다
CREATE FUNCTION guard_ai_decision_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF to_jsonb(OLD) - 'status' - 'decided_at' - 'accepted_plan_json'
       IS DISTINCT FROM
       to_jsonb(NEW) - 'status' - 'decided_at' - 'accepted_plan_json' THEN
        RAISE EXCEPTION 'AI result content is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.status <> NEW.status AND OLD.status NOT IN ('proposed', 'shown') THEN
        RAISE EXCEPTION 'decision is final' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER plan_adjustment_guard_before_update BEFORE UPDATE ON plan_adjustment_proposals
FOR EACH ROW EXECUTE FUNCTION guard_ai_decision_update();
CREATE TRIGGER ai_recommendations_guard_before_update BEFORE UPDATE ON ai_mission_recommendations
FOR EACH ROW EXECUTE FUNCTION guard_ai_decision_update();

COMMIT;
