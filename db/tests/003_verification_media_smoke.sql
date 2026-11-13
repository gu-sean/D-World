-- smoke 003, 샘플 데이터는 롤백
BEGIN;

INSERT INTO users (id) VALUES
    ('00000101'),
    ('00000102');

INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES
    ('00000103',
     'owner03', 'owner03@example.com', 'test-hash');

INSERT INTO goal_categories (id, code, name, display_order) VALUES
    ('00000104', 'fitness', '운동', 1);

INSERT INTO difficulty_levels (id, code, name, display_order) VALUES
    ('00000105', 'basic', '기본', 1);

INSERT INTO missions
    (id, user_id, source_type, title, category_id, difficulty_id,
     verification_method, scheduled_date)
VALUES
    ('00000106',
     '00000101',
     'user', '스쿼트',
     '00000104',
     '00000105',
     'camera', DATE '2026-10-28');

INSERT INTO mission_records
    (id, mission_id, user_id, attempt_no)
VALUES
    ('00000107',
     '00000106',
     '00000101', 1);

DO $$
BEGIN
    BEGIN
        UPDATE mission_records
           SET submission_no = 1, status = 'submitted',
               evidence_kind = 'camera_media', submitted_at = now()
         WHERE id = '00000107';
        RAISE EXCEPTION 'camera submission without uploaded media was accepted';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END;
$$;

DO $$
BEGIN
    BEGIN
        INSERT INTO mission_records
            (id, mission_id, user_id, attempt_no)
        VALUES
            ('00000108',
             '00000106',
             '00000102', 2);
        RAISE EXCEPTION 'another user was allowed to start the mission';
    EXCEPTION WHEN foreign_key_violation THEN
        NULL;
    END;
END;
$$;

INSERT INTO media_files
    (id, user_id, record_id, object_key, media_kind, mime_type,
     expected_size_bytes, upload_url_expires_at)
VALUES
    ('00000109',
     '00000101',
     '00000107',
     'verification/record-107/video', 'camera_video', 'video/mp4',
     1024, now() + interval '5 minutes');

DO $$
BEGIN
    BEGIN
        DELETE FROM users
        WHERE id = '00000101';
        RAISE EXCEPTION 'user was deleted before R2 cleanup';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO media_files
            (id, user_id, record_id, object_key, media_kind, mime_type,
             expected_size_bytes, upload_url_expires_at)
        VALUES
            ('00000110',
             '00000102',
             '00000107',
             'verification/invalid', 'camera_video', 'video/mp4',
             1024, now() + interval '5 minutes');
        RAISE EXCEPTION 'media ownership mismatch was allowed';
    EXCEPTION WHEN foreign_key_violation THEN
        NULL;
    END;
END;
$$;

UPDATE media_files
SET upload_status = 'uploaded', actual_size_bytes = 1024,
    uploaded_at = now()
WHERE id = '00000109';

UPDATE missions SET status = 'in_progress'
WHERE id = '00000106';

DO $$
BEGIN
    BEGIN
        UPDATE mission_records
           SET submission_no = 1, status = 'submitted',
               evidence_kind = 'sensor_summary', submitted_at = now()
         WHERE id = '00000107';
        RAISE EXCEPTION 'camera mission accepted sensor evidence';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END;
$$;

UPDATE mission_records
SET submission_no = 1, status = 'submitted',
    evidence_kind = 'camera_media', submitted_at = now()
WHERE id = '00000107';

INSERT INTO verification_criteria_versions
    (id, category_id, verification_method, version_no,
     rules_json, effective_at, created_by_admin_id)
VALUES
    ('00000111',
     '00000104',
     'camera', 1, '{}'::jsonb, now() - interval '1 day',
     '00000103');

INSERT INTO verification_results
    (id, record_id, result_no, source, decision, criteria_version_id,
     engine_version, reason, notified_at)
VALUES
    ('00000112',
     '00000107', 1, 'ai', 'rejected',
     '00000111',
     'model-v1', '횟수 부족', now());

INSERT INTO verification_appeals
    (id, record_id, filed_by_user_id, original_result_id, reason)
VALUES
    ('00000113',
     '00000107',
     '00000101',
     '00000112',
     '후반 동작을 다시 확인해 주세요');

DO $$
BEGIN
    BEGIN
        INSERT INTO verification_results
            (id, record_id, result_no, source, decision,
             criteria_version_id, engine_version)
        VALUES
            ('00000114',
             '00000107', 2,
             'ai', 'approved',
             '00000111', 'model-v1');
        RAISE EXCEPTION 'two current results were allowed';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;
END;
$$;

UPDATE verification_results SET is_current = false
WHERE id = '00000112';

INSERT INTO verification_results
    (id, record_id, result_no, source, decision, criteria_version_id,
     reviewed_by_admin_id, reason)
VALUES
    ('00000115',
     '00000107', 2,
     'admin', 'approved',
     '00000111',
     '00000103',
     '후반 동작 확인');

DO $$
BEGIN
    BEGIN
        UPDATE verification_appeals
           SET status = 'rejected',
               reviewed_by_admin_id = '00000103',
               resolution_result_id = '00000115',
               resolved_at = now()
         WHERE id = '00000113';
        RAISE EXCEPTION 'appeal rejection used an approval result';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END;
$$;

UPDATE verification_appeals
SET status = 'accepted',
    reviewed_by_admin_id = '00000103',
    resolution_result_id = '00000115',
    resolved_at = now()
WHERE id = '00000113';

UPDATE mission_records SET status = 'approved', completed_at = now()
WHERE id = '00000107';

UPDATE missions SET status = 'completed'
WHERE id = '00000106';

DO $$
BEGIN
    BEGIN
        INSERT INTO mission_records
            (id, mission_id, user_id, attempt_no)
        VALUES
            ('00000116',
             '00000106',
             '00000101', 2);
        RAISE EXCEPTION 'completed mission accepted another attempt';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END;
$$;

UPDATE media_files SET upload_status = 'deleting'
WHERE id = '00000109';

UPDATE media_files
SET upload_status = 'deleted', deleted_at = now()
WHERE id = '00000109';

DELETE FROM users
WHERE id = '00000101';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM media_files
        WHERE user_id = '00000101'
    ) THEN
        RAISE EXCEPTION 'media metadata survived account deletion';
    END IF;
END;
$$;

INSERT INTO missions
    (id, user_id, source_type, title, category_id, difficulty_id,
     verification_method, scheduled_date)
VALUES
    ('00000117',
     '00000102',
     'user', '센서 미션',
     '00000104',
     '00000105',
     'sensor', DATE '2026-10-28');

INSERT INTO mission_records
    (id, mission_id, user_id, attempt_no, submission_no, status,
     evidence_kind, submitted_at)
SELECT
    ('00' || lpad(n::text, 6, '0'))::short_id,
    '00000117'::short_id,
    '00000102'::short_id,
    n - 116, n - 116, 'submitted', 'sensor_summary', now()
FROM generate_series(117, 120) AS n;

DO $$
BEGIN
    BEGIN
        INSERT INTO mission_records
            (id, mission_id, user_id, attempt_no, submission_no,
             status, evidence_kind, submitted_at)
        VALUES
            ('00000121',
             '00000117',
             '00000102',
             5, 5, 'submitted', 'sensor_summary', now());
        RAISE EXCEPTION 'fifth submission was accepted';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END;
$$;

INSERT INTO verification_criteria_versions
    (id, category_id, verification_method, version_no,
     rules_json, effective_at, created_by_admin_id)
VALUES
    ('00000122',
     '00000104',
     'sensor', 1, '{}'::jsonb, now() - interval '10 days',
     '00000103');

DO $$
BEGIN
    BEGIN
        UPDATE verification_criteria_versions SET rules_json = '{"changed":true}'::jsonb
        WHERE id = '00000122';
        RAISE EXCEPTION 'published criteria were updated';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        DELETE FROM verification_criteria_versions
        WHERE id = '00000122';
        RAISE EXCEPTION 'published criteria were deleted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO verification_results
            (id, record_id, result_no, source, decision,
             criteria_version_id, reviewed_by_admin_id)
        VALUES
            ('00000126',
             '00000117',
             1, 'admin', 'rejected',
             '00000122',
             '00000103');
        RAISE EXCEPTION 'administrator decision without reason was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;

DO $$
BEGIN
    BEGIN
        INSERT INTO verification_results
            (id, record_id, result_no, source, decision,
             criteria_version_id, engine_version)
        VALUES
            ('00000125',
             '00000117',
             1, 'ai', 'approved',
             '00000111', 'model-v1');
        RAISE EXCEPTION 'sensor mission used camera criteria';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END;
$$;

INSERT INTO verification_results
    (id, record_id, result_no, source, decision, criteria_version_id,
     engine_version, decided_at, notified_at)
VALUES
    ('00000123',
     '00000117',
     1, 'ai', 'rejected',
     '00000122',
     'model-v1', now() - interval '8 days', now() - interval '8 days');

DO $$
BEGIN
    BEGIN
        INSERT INTO verification_appeals
            (id, record_id, filed_by_user_id, original_result_id, reason)
        VALUES
            ('00000124',
             '00000117',
             '00000102',
             '00000123',
             '기한을 지난 이의 제기');
        RAISE EXCEPTION 'appeal after 7 days was accepted';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END;
$$;

ROLLBACK;
