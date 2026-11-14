-- 게시한 공지·챌린지 수정 허용 (관리자 웹 "게시 후에도 수정")
--   공지: 게시·예약 뒤에도 제목·본문·분류·이동 화면은 고칠 수 있다.
--         받는 회원·목록 노출·푸시·연결 약관은 이미 알림이 나갔으므로 그대로 잠근다.
--   챌린지: 참가자가 생긴 뒤에도 제목·설명은 고칠 수 있다. 기간·목표·완주 조건 등 규칙은 그대로 잠근다.
BEGIN;

CREATE OR REPLACE FUNCTION guard_notice_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status <> 'draft' AND
       ROW(OLD.audience_type, OLD.show_in_list, OLD.send_push, OLD.policy_document_version_id,
           OLD.created_by_admin_id, OLD.created_at)
       IS DISTINCT FROM
       ROW(NEW.audience_type, NEW.show_in_list, NEW.send_push, NEW.policy_document_version_id,
           NEW.created_by_admin_id, NEW.created_at) THEN
        RAISE EXCEPTION 'notice audience and delivery are frozen after scheduling'
            USING ERRCODE = '23514';
    END IF;
    -- 정책 공지는 연결한 약관과 분류가 함께 움직여야 하므로 게시 뒤 분류를 바꾸지 않는다
    IF OLD.status <> 'draft' AND OLD.category IS DISTINCT FROM NEW.category AND
       'policy' IN (OLD.category, NEW.category) THEN
        RAISE EXCEPTION 'policy notice category is frozen after scheduling'
            USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'cancelled' AND
       ROW(OLD.category, OLD.title, OLD.body, OLD.link_screen)
       IS DISTINCT FROM ROW(NEW.category, NEW.title, NEW.body, NEW.link_screen) THEN
        RAISE EXCEPTION 'cancelled notice cannot change' USING ERRCODE = '23514';
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status AND NOT (
        (OLD.status = 'draft' AND NEW.status IN ('scheduled', 'published', 'cancelled')) OR
        (OLD.status = 'scheduled' AND NEW.status IN ('published', 'cancelled'))) THEN
        RAISE EXCEPTION 'invalid notice status transition' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'draft' AND NEW.status IN ('scheduled', 'published') AND
       NEW.audience_type = 'users' AND NOT EXISTS (
           SELECT 1 FROM notice_recipients WHERE notice_id = NEW.id) THEN
        RAISE EXCEPTION 'targeted notice needs recipients' USING ERRCODE = '23514';
    END IF;
    IF OLD.status IN ('published', 'cancelled') AND
       ROW(OLD.status, OLD.scheduled_at, OLD.published_at, OLD.cancelled_at)
       IS DISTINCT FROM
       ROW(NEW.status, NEW.scheduled_at, NEW.published_at, NEW.cancelled_at) THEN
        RAISE EXCEPTION 'finished notice cannot change' USING ERRCODE = '23514';
    END IF;
    IF OLD.fanout_completed_at IS NOT NULL AND
       NEW.fanout_completed_at IS DISTINCT FROM OLD.fanout_completed_at THEN
        RAISE EXCEPTION 'fan-out completion is recorded once' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION guard_challenge() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP='INSERT' THEN
        IF NEW.publication_status='public' AND NEW.start_date<=(now() AT TIME ZONE 'Asia/Seoul')::date THEN
            RAISE EXCEPTION 'challenge must publish before start day' USING ERRCODE='23514';
        END IF;
    ELSE
        IF OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at THEN
            RAISE EXCEPTION 'challenge publication time is immutable' USING ERRCODE='23514';
        END IF;
        IF OLD.publication_status='public' AND NEW.publication_status<>'public'
           AND NEW.publication_status NOT IN ('hidden','cancelled') THEN
            RAISE EXCEPTION 'published challenge cannot return to draft' USING ERRCODE='23514';
        END IF;
        IF OLD.published_at IS NULL AND NEW.published_at IS NOT NULL
           AND NEW.start_date<=(now() AT TIME ZONE 'Asia/Seoul')::date THEN
            RAISE EXCEPTION 'challenge must publish before start day' USING ERRCODE='23514';
        END IF;
        -- 제목·설명은 참가자가 있어도 고칠 수 있다 (015). 참가 조건이 되는 규칙만 잠근다.
        IF EXISTS(SELECT 1 FROM challenge_participations WHERE challenge_id=OLD.id) AND
           ROW(OLD.origin,OLD.category_id,OLD.difficulty_id,
               OLD.verification_method,OLD.target_value,OLD.target_unit,
               OLD.estimated_duration_seconds,OLD.start_date,OLD.end_date,
               OLD.required_success_days,OLD.max_participants)
           IS DISTINCT FROM ROW(NEW.origin,NEW.category_id,NEW.difficulty_id,
               NEW.verification_method,NEW.target_value,NEW.target_unit,
               NEW.estimated_duration_seconds,NEW.start_date,NEW.end_date,
               NEW.required_success_days,NEW.max_participants) THEN
            RAISE EXCEPTION 'challenge rules locked after first enrollment' USING ERRCODE='23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;

COMMIT;
