--  ai 재생성 리포트, 재조정 전 계획, 생성 미션을 가리키는 추천
BEGIN;

-- 1. 재생성: 완료된 실행을 한 번 대체하고 generation_no를 올림, 기간당 현재 실행은 하나
ALTER TABLE ai_analysis_runs
    ADD COLUMN generation_no integer NOT NULL DEFAULT 1 CHECK (generation_no > 0),
    ADD COLUMN superseded_at timestamptz,
    ADD CONSTRAINT ai_runs_superseded_needs_completion
        CHECK (superseded_at IS NULL
               OR (status = 'completed' AND superseded_at >= completed_at));

-- 대체된 실행은 현재 실행 유일성에서 제외, 세대 번호는 실패하지 않은 실행끼리만 고유
DROP INDEX ai_runs_one_live_period_uq;
CREATE UNIQUE INDEX ai_runs_one_current_period_uq
    ON ai_analysis_runs (user_id, run_type, period_start)
    WHERE period_start IS NOT NULL AND status <> 'failed' AND superseded_at IS NULL;
CREATE UNIQUE INDEX ai_runs_generation_uq
    ON ai_analysis_runs (user_id, run_type, period_start, generation_no)
    WHERE period_start IS NOT NULL AND status <> 'failed';

CREATE OR REPLACE FUNCTION guard_ai_run_update() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    has_result boolean;
BEGIN
    IF ROW(OLD.user_id, OLD.run_type, OLD.period_start, OLD.period_end,
           OLD.requested_at, OLD.generation_no)
       IS DISTINCT FROM
       ROW(NEW.user_id, NEW.run_type, NEW.period_start, NEW.period_end,
           NEW.requested_at, NEW.generation_no) THEN
        RAISE EXCEPTION 'analysis run identity is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.status <> 'requested' AND
       ROW(OLD.status, OLD.engine_version, OLD.ingest_key, OLD.failure_reason,
           OLD.completed_at)
       IS DISTINCT FROM
       ROW(NEW.status, NEW.engine_version, NEW.ingest_key, NEW.failure_reason,
           NEW.completed_at) THEN
        RAISE EXCEPTION 'finished analysis run cannot change' USING ERRCODE = '23514';
    END IF;
    IF OLD.superseded_at IS NOT NULL AND
       NEW.superseded_at IS DISTINCT FROM OLD.superseded_at THEN
        RAISE EXCEPTION 'supersession is recorded once' USING ERRCODE = '23514';
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

-- 2. 재조정: 이전 계획과 사유, decided_at은 적용 시각
ALTER TABLE plan_adjustment_proposals
    ADD COLUMN before_plan jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(before_plan) = 'object'),
    ADD COLUMN reason text;
ALTER TABLE plan_adjustment_proposals ALTER COLUMN before_plan DROP DEFAULT;
-- 3. 리포트: 피드백·다음 목표 
ALTER TABLE ai_reports
    ADD COLUMN feedback text,
    ADD COLUMN next_goals jsonb
        CHECK (next_goals IS NULL OR jsonb_typeof(next_goals) IN ('object', 'array'));

CREATE OR REPLACE FUNCTION guard_ai_report_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF to_jsonb(OLD) - 'read_at' IS DISTINCT FROM to_jsonb(NEW) - 'read_at'
       OR (OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at) THEN
        RAISE EXCEPTION 'report content is immutable; read time is set once'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

-- 4. 추천은 생성된 미션을 가리킬 수 있다
ALTER TABLE ai_mission_recommendations
    ADD COLUMN mission_id uuid,
    ADD CONSTRAINT ai_recommendation_mission_fk
        FOREIGN KEY (mission_id, user_id)
        REFERENCES missions(id, user_id) ON DELETE CASCADE,
    DROP CONSTRAINT ai_mission_recommendations_check;

ALTER TABLE ai_mission_recommendations
    ADD CONSTRAINT ai_recommendation_has_target
        CHECK (mission_id IS NOT NULL OR mission_definition_id IS NOT NULL
               OR suggestion_text IS NOT NULL);

CREATE INDEX ai_mission_recommendations_mission_idx
    ON ai_mission_recommendations (mission_id) WHERE mission_id IS NOT NULL;

COMMIT;
