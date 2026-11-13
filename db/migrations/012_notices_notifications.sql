-- 관리자 공지와 회원별 알림
BEGIN;

CREATE TABLE notices (
    id short_id PRIMARY KEY,
    category varchar(12) NOT NULL
        CHECK (category IN ('service', 'event', 'policy', 'marketing')),
    title varchar(120) NOT NULL CHECK (length(btrim(title)) > 0),
    body text NOT NULL CHECK (length(btrim(body)) > 0),
    link_screen varchar(80) CHECK (link_screen ~ '^[a-z][A-Za-z0-9_/.-]*$'),
    audience_type varchar(8) NOT NULL DEFAULT 'all'
        CHECK (audience_type IN ('all', 'users')),
    show_in_list boolean NOT NULL DEFAULT true,
    send_push boolean NOT NULL DEFAULT false,
    policy_document_version_id short_id
        REFERENCES policy_document_versions(id) ON DELETE RESTRICT,
    status varchar(12) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'scheduled', 'published', 'cancelled')),
    scheduled_at timestamptz,
    published_at timestamptz,
    fanout_completed_at timestamptz,
    cancelled_at timestamptz,
    created_by_admin_id short_id NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, audience_type),
    CHECK (show_in_list OR send_push),
    CHECK ((category = 'policy') = (policy_document_version_id IS NOT NULL)),
    CHECK (
        (status = 'draft' AND published_at IS NULL AND cancelled_at IS NULL
            AND fanout_completed_at IS NULL)
        OR (status = 'scheduled' AND scheduled_at IS NOT NULL
            AND published_at IS NULL AND cancelled_at IS NULL
            AND fanout_completed_at IS NULL)
        OR (status = 'published' AND published_at IS NOT NULL
            AND cancelled_at IS NULL
            AND (fanout_completed_at IS NULL OR fanout_completed_at >= published_at))
        OR (status = 'cancelled' AND cancelled_at IS NOT NULL
            AND published_at IS NULL AND fanout_completed_at IS NULL)
    )
);

CREATE INDEX notices_due_idx ON notices (scheduled_at) WHERE status = 'scheduled';
CREATE INDEX notices_published_idx
    ON notices (published_at DESC, id DESC) WHERE status = 'published';
CREATE INDEX notices_fanout_pending_idx
    ON notices (published_at) WHERE status = 'published' AND fanout_completed_at IS NULL;

CREATE TABLE notice_recipients (
    notice_id short_id NOT NULL,
    audience_type varchar(8) NOT NULL DEFAULT 'users' CHECK (audience_type = 'users'),
    user_id short_id NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (notice_id, user_id),
    FOREIGN KEY (notice_id, audience_type)
        REFERENCES notices(id, audience_type) ON DELETE CASCADE
);

CREATE INDEX notice_recipients_user_idx ON notice_recipients (user_id);

-- 초안만 수정·삭제할 수 있다
CREATE FUNCTION guard_notice_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status <> 'draft' AND
       ROW(OLD.category, OLD.title, OLD.body, OLD.link_screen, OLD.audience_type,
           OLD.show_in_list, OLD.send_push, OLD.policy_document_version_id,
           OLD.created_by_admin_id, OLD.created_at)
       IS DISTINCT FROM
       ROW(NEW.category, NEW.title, NEW.body, NEW.link_screen, NEW.audience_type,
           NEW.show_in_list, NEW.send_push, NEW.policy_document_version_id,
           NEW.created_by_admin_id, NEW.created_at) THEN
        RAISE EXCEPTION 'notice content is frozen after scheduling'
            USING ERRCODE = '23514';
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

CREATE TRIGGER notices_guard_before_update
BEFORE UPDATE ON notices
FOR EACH ROW EXECUTE FUNCTION guard_notice_update();

CREATE FUNCTION guard_notice_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status <> 'draft' THEN
        RAISE EXCEPTION 'only draft notices can be deleted' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER notices_guard_before_delete
BEFORE DELETE ON notices
FOR EACH ROW EXECUTE FUNCTION guard_notice_delete();

-- 수신자는 초안에서만 변경, 회원·초안 삭제에 따른 연쇄 삭제는 통과
CREATE FUNCTION guard_notice_recipients() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    notice_status varchar(12);
    member_exists boolean;
    notice_exists boolean;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT status INTO notice_status FROM notices WHERE id = NEW.notice_id;
        IF notice_status IS DISTINCT FROM 'draft' THEN
            RAISE EXCEPTION 'recipients change only while the notice is a draft'
                USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;
    SELECT status INTO notice_status FROM notices WHERE id = OLD.notice_id;
    notice_exists := FOUND;
    SELECT EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) INTO member_exists;
    IF NOT notice_exists OR NOT member_exists OR notice_status = 'draft' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'recipients change only while the notice is a draft'
        USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER notice_recipients_guard_before_write
BEFORE INSERT OR DELETE ON notice_recipients
FOR EACH ROW EXECUTE FUNCTION guard_notice_recipients();

CREATE TABLE user_notifications (
    id short_id PRIMARY KEY,
    user_id short_id NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind varchar(8) NOT NULL CHECK (kind IN ('notice', 'system')),
    notice_id short_id REFERENCES notices(id) ON DELETE RESTRICT,
    event_key text CHECK (event_key IS NULL OR length(btrim(event_key)) > 0),
    title varchar(120) NOT NULL CHECK (length(btrim(title)) > 0),
    body text NOT NULL CHECK (length(btrim(body)) > 0),
    link_screen varchar(80) CHECK (link_screen ~ '^[a-z][A-Za-z0-9_/.-]*$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    read_at timestamptz,
    push_status varchar(8) NOT NULL DEFAULT 'none'
        CHECK (push_status IN ('none', 'pending', 'sent', 'failed', 'skipped')),
    push_sent_at timestamptz,
    push_attempts integer NOT NULL DEFAULT 0 CHECK (push_attempts >= 0),
    push_last_error text,
    UNIQUE (user_id, notice_id),
    UNIQUE (user_id, event_key),
    CHECK ((kind = 'notice' AND notice_id IS NOT NULL AND event_key IS NULL)
        OR (kind = 'system' AND notice_id IS NULL AND event_key IS NOT NULL)),
    CHECK ((push_status = 'sent') = (push_sent_at IS NOT NULL)),
    CHECK (read_at IS NULL OR read_at >= created_at)
);

CREATE INDEX user_notifications_inbox_idx
    ON user_notifications (user_id, created_at DESC, id DESC);
CREATE INDEX user_notifications_unread_idx
    ON user_notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX user_notifications_push_pending_idx
    ON user_notifications (created_at) WHERE push_status = 'pending';
CREATE INDEX user_notifications_notice_idx
    ON user_notifications (notice_id) WHERE notice_id IS NOT NULL;

CREATE FUNCTION guard_user_notification_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    notice_row notices%ROWTYPE;
BEGIN
    IF NEW.kind <> 'notice' THEN
        RETURN NEW;
    END IF;
    SELECT * INTO notice_row FROM notices WHERE id = NEW.notice_id;
    IF notice_row.status IS DISTINCT FROM 'published' THEN
        RAISE EXCEPTION 'notification needs a published notice' USING ERRCODE = '23514';
    END IF;
    IF notice_row.audience_type = 'users' AND NOT EXISTS (
        SELECT 1 FROM notice_recipients
         WHERE notice_id = NEW.notice_id AND user_id = NEW.user_id) THEN
        RAISE EXCEPTION 'member is not a recipient of this notice'
            USING ERRCODE = '23514';
    END IF;
    IF NOT notice_row.send_push AND NEW.push_status <> 'none' THEN
        RAISE EXCEPTION 'notice without push cannot carry a push status'
            USING ERRCODE = '23514';
    END IF;
    IF NEW.title <> notice_row.title OR NEW.body <> notice_row.body THEN
        RAISE EXCEPTION 'notification must copy the published notice'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER user_notifications_guard_before_insert
BEFORE INSERT ON user_notifications
FOR EACH ROW EXECUTE FUNCTION guard_user_notification_insert();

-- 내용은 스냅샷, 바뀌는 것은 읽음 상태와 푸시 결과뿐
CREATE FUNCTION guard_user_notification_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(OLD.user_id, OLD.kind, OLD.notice_id, OLD.event_key, OLD.title,
           OLD.body, OLD.link_screen, OLD.created_at)
       IS DISTINCT FROM
       ROW(NEW.user_id, NEW.kind, NEW.notice_id, NEW.event_key, NEW.title,
           NEW.body, NEW.link_screen, NEW.created_at) THEN
        RAISE EXCEPTION 'notification content is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at THEN
        RAISE EXCEPTION 'read time is recorded once' USING ERRCODE = '23514';
    END IF;
    IF OLD.push_status IN ('sent', 'skipped', 'none') AND
       NEW.push_status IS DISTINCT FROM OLD.push_status THEN
        RAISE EXCEPTION 'push result is final' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER user_notifications_guard_before_update
BEFORE UPDATE ON user_notifications
FOR EACH ROW EXECUTE FUNCTION guard_user_notification_update();

CREATE TABLE push_devices (
    id short_id PRIMARY KEY,
    user_id short_id NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform varchar(8) NOT NULL CHECK (platform IN ('android', 'ios')),
    token text NOT NULL UNIQUE CHECK (length(btrim(token)) > 0),
    is_active boolean NOT NULL DEFAULT true,
    registered_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    CHECK (last_seen_at >= registered_at)
);

CREATE INDEX push_devices_user_active_idx
    ON push_devices (user_id) WHERE is_active;

COMMIT;
