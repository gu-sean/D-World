-- 수행 회차, 인증 판정, 이의 제기, R2 파일 메타데이터

BEGIN;

-- 복합 키로 증빙·회차가 미션 소유자와 같은 사용자임을 보장한다
ALTER TABLE missions
    ADD CONSTRAINT missions_id_user_id_uq UNIQUE (id, user_id);

CREATE TABLE mission_records (
    id short_id PRIMARY KEY,
    mission_id short_id NOT NULL,
    user_id short_id NOT NULL,
    attempt_no integer NOT NULL CHECK (attempt_no > 0),
    submission_no smallint CHECK (submission_no BETWEEN 1 AND 4),
    status varchar(24) NOT NULL DEFAULT 'recording'
        CHECK (status IN ('recording', 'uploading', 'submitted',
            'review_required', 'approved', 'rejected', 'superseded', 'aborted')),
    evidence_kind varchar(20)
        CHECK (evidence_kind IN
            ('camera_media', 'sensor_raw', 'sensor_summary')),
    started_at timestamptz NOT NULL DEFAULT now(),
    submitted_at timestamptz,
    completed_at timestamptz,
    metrics jsonb CHECK (metrics IS NULL OR jsonb_typeof(metrics) = 'object'),
    UNIQUE (id, user_id),
    UNIQUE (id, mission_id),
    UNIQUE (mission_id, attempt_no),
    UNIQUE (mission_id, submission_no),
    FOREIGN KEY (mission_id, user_id)
        REFERENCES missions(id, user_id) ON DELETE CASCADE,
    CHECK ((submission_no IS NULL) = (submitted_at IS NULL)),
    CHECK (
        (status IN ('recording', 'uploading', 'aborted')
            AND submission_no IS NULL)
        OR (status IN ('submitted', 'review_required', 'approved',
            'rejected', 'superseded')
            AND submission_no IS NOT NULL AND evidence_kind IS NOT NULL)
    ),
    CHECK (submitted_at IS NULL OR submitted_at >= started_at),
    CHECK (completed_at IS NULL OR completed_at >= started_at),
    CHECK (status NOT IN ('approved', 'rejected', 'superseded')
        OR completed_at IS NOT NULL)
);

CREATE INDEX mission_records_mission_recent_idx
    ON mission_records (mission_id, attempt_no DESC);

CREATE INDEX mission_records_review_queue_idx
    ON mission_records (submitted_at)
    WHERE status = 'review_required';

-- 회차 시작·제출 번호 배정 중에는 미션 행을 잠근다
CREATE FUNCTION guard_mission_record_write() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    mission_status varchar(20);
    mission_method varchar(30);
    mission_deleted_at timestamptz;
BEGIN
    SELECT status, verification_method, deleted_at
      INTO mission_status, mission_method, mission_deleted_at
      FROM missions
     WHERE id = NEW.mission_id AND user_id = NEW.user_id
     FOR UPDATE;

    IF mission_status IS NULL THEN
        RAISE EXCEPTION 'mission does not belong to this user'
            USING ERRCODE = '23503';
    END IF;

    IF (mission_status IN ('completed', 'cancelled')
        OR mission_deleted_at IS NOT NULL) AND
       (TG_OP = 'INSERT' OR
        (OLD.submission_no IS NULL AND NEW.submission_no IS NOT NULL)) THEN
        RAISE EXCEPTION 'closed mission cannot accept another attempt'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' AND
       ROW(OLD.mission_id, OLD.user_id, OLD.attempt_no, OLD.started_at)
       IS DISTINCT FROM
       ROW(NEW.mission_id, NEW.user_id, NEW.attempt_no, NEW.started_at) THEN
        RAISE EXCEPTION 'attempt identity is immutable'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.submission_no IS NOT NULL AND
       NEW.evidence_kind IS DISTINCT FROM OLD.evidence_kind THEN
        RAISE EXCEPTION 'submitted evidence kind is immutable'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.submission_no IS NOT NULL AND
       NEW.submission_no IS DISTINCT FROM OLD.submission_no THEN
        RAISE EXCEPTION 'submission number is immutable'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.submission_no IS NOT NULL AND
       (TG_OP = 'INSERT' OR OLD.submission_no IS NULL) THEN
        IF (mission_method = 'camera' AND
                NEW.evidence_kind IS DISTINCT FROM 'camera_media')
           OR (mission_method = 'sensor' AND
                NEW.evidence_kind NOT IN ('sensor_raw', 'sensor_summary')) THEN
            RAISE EXCEPTION 'evidence kind does not match mission method'
                USING ERRCODE = '23514';
        END IF;

        IF NEW.evidence_kind IN ('camera_media', 'sensor_raw') AND
           NOT EXISTS (
               SELECT 1 FROM media_files
                WHERE record_id = NEW.id AND upload_status = 'uploaded'
                  AND ((NEW.evidence_kind = 'camera_media' AND
                        media_kind IN ('camera_photo', 'camera_video'))
                    OR (NEW.evidence_kind = 'sensor_raw' AND
                        media_kind = 'sensor_raw'))
           ) THEN
            RAISE EXCEPTION 'verified R2 evidence is required before submission'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER mission_records_guard_before_write
BEFORE INSERT OR UPDATE ON mission_records
FOR EACH ROW EXECUTE FUNCTION guard_mission_record_write();

CREATE TABLE verification_criteria_versions (
    id short_id PRIMARY KEY,
    category_id short_id NOT NULL
        REFERENCES goal_categories(id) ON DELETE RESTRICT,
    verification_method varchar(30) NOT NULL
        CHECK (verification_method IN ('camera', 'sensor')),
    version_no integer NOT NULL CHECK (version_no > 0),
    rules_json jsonb NOT NULL CHECK (jsonb_typeof(rules_json) = 'object'),
    effective_at timestamptz NOT NULL,
    created_by_admin_id short_id NOT NULL
        REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (category_id, verification_method, version_no)
);

CREATE INDEX verification_criteria_current_idx
    ON verification_criteria_versions
    (category_id, verification_method, effective_at DESC);

CREATE FUNCTION protect_verification_criteria_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'published verification criteria are immutable'
        USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER verification_criteria_no_change
BEFORE UPDATE OR DELETE ON verification_criteria_versions
FOR EACH ROW EXECUTE FUNCTION protect_verification_criteria_version();

CREATE TABLE verification_results (
    id short_id PRIMARY KEY,
    record_id short_id NOT NULL
        REFERENCES mission_records(id) ON DELETE CASCADE,
    result_no integer NOT NULL CHECK (result_no > 0),
    source varchar(20) NOT NULL CHECK (source IN ('ai', 'admin')),
    decision varchar(20) NOT NULL
        CHECK (decision IN ('approved', 'rejected', 'review_required')),
    criteria_version_id short_id NOT NULL
        REFERENCES verification_criteria_versions(id) ON DELETE RESTRICT,
    engine_version varchar(80),
    confidence numeric(5,4) CHECK (confidence BETWEEN 0 AND 1),
    metrics jsonb CHECK (metrics IS NULL OR jsonb_typeof(metrics) = 'object'),
    reason text,
    reviewed_by_admin_id short_id
        REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    is_current boolean NOT NULL DEFAULT true,
    decided_at timestamptz NOT NULL DEFAULT now(),
    notified_at timestamptz,
    UNIQUE (id, record_id),
    UNIQUE (record_id, result_no),
    CHECK (
        (source = 'ai' AND reviewed_by_admin_id IS NULL
            AND engine_version IS NOT NULL
            AND length(btrim(engine_version)) > 0)
        OR (source = 'admin' AND reviewed_by_admin_id IS NOT NULL)
    ),
    CHECK (decision <> 'review_required' OR
        (source = 'ai' AND notified_at IS NULL)),
    CHECK (source <> 'admin' OR
        (reason IS NOT NULL AND length(btrim(reason)) > 0)),
    CHECK (notified_at IS NULL OR notified_at >= decided_at)
);

-- 회차당 현재 판정은 하나, 재판정은 is_current만 내리고 새 행 추가
CREATE UNIQUE INDEX verification_results_one_current_uq
    ON verification_results (record_id) WHERE is_current;

CREATE INDEX verification_results_record_recent_idx
    ON verification_results (record_id, result_no DESC);

CREATE FUNCTION validate_verification_result_criteria() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    mission_category_id short_id;
    mission_method varchar(30);
    criteria_category_id short_id;
    criteria_method varchar(30);
    criteria_effective_at timestamptz;
BEGIN
    SELECT m.category_id, m.verification_method
      INTO mission_category_id, mission_method
      FROM mission_records mr
      JOIN missions m ON m.id = mr.mission_id
     WHERE mr.id = NEW.record_id;

    SELECT category_id, verification_method, effective_at
      INTO criteria_category_id, criteria_method, criteria_effective_at
      FROM verification_criteria_versions
     WHERE id = NEW.criteria_version_id;

    IF mission_category_id IS DISTINCT FROM criteria_category_id
       OR mission_method IS DISTINCT FROM criteria_method
       OR criteria_effective_at > NEW.decided_at THEN
        RAISE EXCEPTION 'criteria version does not apply to this mission'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER verification_results_validate_criteria_before_insert
BEFORE INSERT ON verification_results
FOR EACH ROW EXECUTE FUNCTION validate_verification_result_criteria();

-- 추가 전용, 수정 가능한 것은 is_current와 notified_at(1회)뿐
CREATE FUNCTION protect_verification_result() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(OLD.record_id, OLD.result_no, OLD.source, OLD.decision,
           OLD.criteria_version_id, OLD.engine_version, OLD.confidence,
           OLD.metrics, OLD.reason, OLD.reviewed_by_admin_id, OLD.decided_at)
       IS DISTINCT FROM
       ROW(NEW.record_id, NEW.result_no, NEW.source, NEW.decision,
           NEW.criteria_version_id, NEW.engine_version, NEW.confidence,
           NEW.metrics, NEW.reason, NEW.reviewed_by_admin_id, NEW.decided_at)
       OR (OLD.is_current = false AND NEW.is_current = true)
       OR (OLD.notified_at IS NOT NULL AND
           NEW.notified_at IS DISTINCT FROM OLD.notified_at) THEN
        RAISE EXCEPTION 'verification result history is immutable'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER verification_results_protect_before_update
BEFORE UPDATE ON verification_results
FOR EACH ROW EXECUTE FUNCTION protect_verification_result();

CREATE TABLE verification_appeals (
    id short_id PRIMARY KEY,
    record_id short_id NOT NULL,
    filed_by_user_id short_id NOT NULL,
    original_result_id short_id NOT NULL,
    reason text NOT NULL CHECK (length(btrim(reason)) > 0),
    status varchar(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'accepted', 'rejected')),
    filed_at timestamptz NOT NULL DEFAULT now(),
    reviewed_by_admin_id short_id
        REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    resolution_result_id short_id,
    resolved_at timestamptz,
    UNIQUE (original_result_id),
    FOREIGN KEY (record_id, filed_by_user_id)
        REFERENCES mission_records(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (original_result_id, record_id)
        REFERENCES verification_results(id, record_id) ON DELETE CASCADE,
    FOREIGN KEY (resolution_result_id, record_id)
        REFERENCES verification_results(id, record_id) ON DELETE CASCADE,
    CHECK (
        (status = 'open' AND reviewed_by_admin_id IS NULL
            AND resolution_result_id IS NULL AND resolved_at IS NULL)
        OR (status <> 'open' AND reviewed_by_admin_id IS NOT NULL
            AND resolution_result_id IS NOT NULL AND resolved_at IS NOT NULL)
    ),
    CHECK (resolved_at IS NULL OR resolved_at >= filed_at)
);

CREATE INDEX verification_appeals_queue_idx
    ON verification_appeals (filed_at) WHERE status = 'open';

CREATE FUNCTION guard_verification_appeal() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    original_decision varchar(20);
    original_notified_at timestamptz;
    resolution_source varchar(20);
    resolution_decision varchar(20);
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT decision, notified_at
          INTO original_decision, original_notified_at
          FROM verification_results
         WHERE id = NEW.original_result_id AND record_id = NEW.record_id;

        IF original_decision IS DISTINCT FROM 'rejected'
           OR original_notified_at IS NULL
           OR now() > original_notified_at + interval '7 days' THEN
            RAISE EXCEPTION 'appeal requires a rejected result notified within 7 days'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF NEW.status <> 'open' THEN
        SELECT source, decision
          INTO resolution_source, resolution_decision
          FROM verification_results
         WHERE id = NEW.resolution_result_id AND record_id = NEW.record_id;

        IF resolution_source IS DISTINCT FROM 'admin'
           OR (NEW.status = 'accepted' AND
               resolution_decision IS DISTINCT FROM 'approved')
           OR (NEW.status = 'rejected' AND
               resolution_decision IS DISTINCT FROM 'rejected') THEN
            RAISE EXCEPTION 'appeal outcome requires matching administrator result'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER verification_appeals_guard_before_write
BEFORE INSERT OR UPDATE OF status, resolution_result_id ON verification_appeals
FOR EACH ROW EXECUTE FUNCTION guard_verification_appeal();

CREATE TABLE media_files (
    id short_id PRIMARY KEY,
    user_id short_id NOT NULL,
    record_id short_id NOT NULL,
    object_key text NOT NULL UNIQUE CHECK (length(object_key) > 0),
    media_kind varchar(24) NOT NULL
        CHECK (media_kind IN ('camera_photo', 'camera_video', 'sensor_raw')),
    mime_type varchar(100) NOT NULL CHECK (length(btrim(mime_type)) > 0),
    expected_size_bytes bigint NOT NULL CHECK (expected_size_bytes > 0),
    actual_size_bytes bigint CHECK (actual_size_bytes > 0),
    checksum_sha256 char(64)
        CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
    upload_status varchar(20) NOT NULL DEFAULT 'pending'
        CHECK (upload_status IN
            ('pending', 'uploaded', 'failed', 'deleting', 'deleted')),
    upload_url_expires_at timestamptz NOT NULL,
    uploaded_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (record_id, user_id)
        REFERENCES mission_records(id, user_id) ON DELETE CASCADE,
    CHECK (upload_url_expires_at > created_at),
    CHECK (
        (upload_status IN ('pending', 'failed')
            AND uploaded_at IS NULL AND deleted_at IS NULL)
        OR (upload_status IN ('uploaded', 'deleting')
            AND uploaded_at IS NOT NULL AND actual_size_bytes IS NOT NULL
            AND deleted_at IS NULL)
        OR (upload_status = 'deleted' AND deleted_at IS NOT NULL)
    )
);

CREATE INDEX media_files_record_idx ON media_files (record_id);
CREATE INDEX media_files_owner_status_idx ON media_files (user_id, upload_status);

-- R2 객체가 모두 삭제되기 전에는 사용자 삭제 차단
CREATE FUNCTION require_r2_cleanup_before_user_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM media_files
         WHERE user_id = OLD.id AND upload_status <> 'deleted'
    ) THEN
        RAISE EXCEPTION 'R2 objects must be cleaned before deleting user'
            USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER users_require_r2_cleanup_before_delete
BEFORE DELETE ON users
FOR EACH ROW EXECUTE FUNCTION require_r2_cleanup_before_user_delete();

-- 부모 행(회차·판정)이 연쇄로 지워질 때 자식 테이블 전체 스캔 방지
CREATE INDEX verification_appeals_record_idx
    ON verification_appeals (record_id, filed_by_user_id);
CREATE INDEX verification_appeals_resolution_result_idx
    ON verification_appeals (resolution_result_id)
    WHERE resolution_result_id IS NOT NULL;

COMMIT;
