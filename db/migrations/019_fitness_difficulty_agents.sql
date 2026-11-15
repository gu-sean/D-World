BEGIN;

ALTER TABLE profiles
    ADD COLUMN age smallint CHECK (age BETWEEN 13 AND 100),
    ADD COLUMN height_cm numeric(5,2) CHECK (height_cm BETWEEN 100 AND 250),
    ADD COLUMN weight_kg numeric(5,2) CHECK (weight_kg BETWEEN 30 AND 300),
    ADD COLUMN recommended_difficulty_id short_id REFERENCES difficulty_levels(id) ON DELETE SET NULL,
    ADD COLUMN difficulty_reason text,
    ADD COLUMN difficulty_reviewed_at timestamptz;

CREATE TABLE difficulty_recommendation_runs (
    id short_id PRIMARY KEY,
    user_id short_id NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_mode varchar(24) NOT NULL
        CHECK (source_mode IN ('signup', 'ai_recommendation', 'manual')),
    requested_difficulty_code varchar(16)
        CHECK (requested_difficulty_code IN ('easy', 'normal', 'hard')),
    candidate_difficulty_code varchar(16) NOT NULL
        CHECK (candidate_difficulty_code IN ('easy', 'normal', 'hard')),
    final_difficulty_id short_id NOT NULL REFERENCES difficulty_levels(id) ON DELETE RESTRICT,
    profile_agent_output jsonb NOT NULL,
    performance_agent_output jsonb NOT NULL,
    safety_agent_output jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX difficulty_recommendation_runs_user_time_idx
    ON difficulty_recommendation_runs (user_id, created_at DESC);
CREATE INDEX profiles_recommended_difficulty_idx
    ON profiles (recommended_difficulty_id)
    WHERE recommended_difficulty_id IS NOT NULL;

COMMIT;
