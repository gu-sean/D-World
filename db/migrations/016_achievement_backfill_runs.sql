-- 업적 공개 후 과거 활동 소급 평가 요청 (M77·M78이 등록, 정기 작업이 사용자 id 순 배치로 처리)
BEGIN;

CREATE TABLE achievement_backfill_runs (
    id uuid PRIMARY KEY,
    achievement_id uuid NOT NULL
        REFERENCES achievement_definitions(id) ON DELETE RESTRICT,
    version_id uuid NOT NULL,
    requested_by_admin_id uuid NOT NULL
        REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    cursor_user_id uuid,
    processed_users integer NOT NULL DEFAULT 0 CHECK (processed_users >= 0),
    earned_count integer NOT NULL DEFAULT 0 CHECK (earned_count >= 0),
    requested_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    UNIQUE (version_id),
    FOREIGN KEY (version_id, achievement_id)
        REFERENCES achievement_versions(id, achievement_id) ON DELETE RESTRICT,
    CHECK (completed_at IS NULL OR completed_at >= requested_at)
);

CREATE INDEX achievement_backfill_runs_pending_idx
    ON achievement_backfill_runs (requested_at) WHERE completed_at IS NULL;
CREATE INDEX achievement_backfill_runs_achievement_idx
    ON achievement_backfill_runs (achievement_id);
CREATE INDEX achievement_backfill_runs_admin_idx
    ON achievement_backfill_runs (requested_by_admin_id);

COMMIT;
