-- 문의·신고 통합 티켓, 대상은 신고만 가지며 증거 첨부는 없음
BEGIN;

CREATE TABLE support_tickets (
    id uuid PRIMARY KEY,
    ticket_type varchar(10) NOT NULL CHECK (ticket_type IN ('inquiry', 'report')),
    category varchar(30) NOT NULL,
    reporter_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    subject varchar(120) NOT NULL CHECK (length(btrim(subject)) > 0),
    body text NOT NULL CHECK (length(btrim(body)) > 0),
    target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    target_mission_definition_id uuid
        REFERENCES mission_definitions(id) ON DELETE SET NULL,
    target_challenge_id uuid REFERENCES challenges(id) ON DELETE SET NULL,
    -- 대상 행이 사라진 뒤에도 유지된다
    target_kind varchar(20)
        CHECK (target_kind IN ('user', 'mission_definition', 'challenge')),
    status varchar(12) NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'in_review', 'completed')),
    assigned_admin_id uuid REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    received_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    UNIQUE (id, ticket_type),
    CHECK (
        (ticket_type = 'inquiry' AND category IN
            ('account', 'mission', 'verification', 'points', 'challenge', 'other')
            AND target_kind IS NULL AND target_user_id IS NULL
            AND target_mission_definition_id IS NULL AND target_challenge_id IS NULL)
        OR (ticket_type = 'report' AND category IN
            ('abuse', 'inappropriate_content', 'cheating', 'impersonation', 'other')
            AND target_kind IS NOT NULL)
    ),
    -- 대상이 있으면 target_kind와 일치하는 참조 하나만 허용한다
    CHECK (
        target_kind IS NULL
        OR (target_kind = 'user' AND target_mission_definition_id IS NULL
            AND target_challenge_id IS NULL)
        OR (target_kind = 'mission_definition' AND target_user_id IS NULL
            AND target_challenge_id IS NULL)
        OR (target_kind = 'challenge' AND target_user_id IS NULL
            AND target_mission_definition_id IS NULL)
    ),
    CHECK (target_user_id IS NULL OR target_user_id IS DISTINCT FROM reporter_user_id),
    CHECK ((status = 'received' AND assigned_admin_id IS NULL AND completed_at IS NULL)
        OR (status = 'in_review' AND assigned_admin_id IS NOT NULL
            AND completed_at IS NULL)
        OR (status = 'completed' AND assigned_admin_id IS NOT NULL
            AND completed_at IS NOT NULL AND completed_at >= received_at))
);

CREATE INDEX support_tickets_queue_idx
    ON support_tickets (status, received_at, id) WHERE status <> 'completed';
CREATE INDEX support_tickets_reporter_idx
    ON support_tickets (reporter_user_id, received_at DESC)
    WHERE reporter_user_id IS NOT NULL;
CREATE INDEX support_tickets_target_user_idx
    ON support_tickets (target_user_id) WHERE target_user_id IS NOT NULL;

-- 신고자·대상당 미완료 신고는 하나
CREATE UNIQUE INDEX support_open_report_user_uq
    ON support_tickets (reporter_user_id, target_user_id)
    WHERE ticket_type = 'report' AND status <> 'completed'
      AND reporter_user_id IS NOT NULL AND target_user_id IS NOT NULL;
CREATE UNIQUE INDEX support_open_report_mission_uq
    ON support_tickets (reporter_user_id, target_mission_definition_id)
    WHERE ticket_type = 'report' AND status <> 'completed'
      AND reporter_user_id IS NOT NULL AND target_mission_definition_id IS NOT NULL;
CREATE UNIQUE INDEX support_open_report_challenge_uq
    ON support_tickets (reporter_user_id, target_challenge_id)
    WHERE ticket_type = 'report' AND status <> 'completed'
      AND reporter_user_id IS NOT NULL AND target_challenge_id IS NOT NULL;

CREATE TABLE support_ticket_events (
    id uuid PRIMARY KEY,
    ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    admin_id uuid REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    event_type varchar(20) NOT NULL
        CHECK (event_type IN ('received', 'assigned', 'status_changed', 'reply', 'note')),
    visibility varchar(10) NOT NULL DEFAULT 'internal'
        CHECK (visibility IN ('user', 'internal')),
    body text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (event_type NOT IN ('reply', 'note') OR
           (body IS NOT NULL AND length(btrim(body)) > 0)),
    CHECK (event_type NOT IN ('reply', 'note', 'assigned') OR admin_id IS NOT NULL),
    CHECK (event_type <> 'note' OR visibility = 'internal')
);

CREATE INDEX support_ticket_events_ticket_idx
    ON support_ticket_events (ticket_id, created_at, id);

CREATE TABLE support_ticket_resolutions (
    ticket_id uuid PRIMARY KEY,
    ticket_type varchar(10) NOT NULL,
    outcome varchar(16) NOT NULL CHECK (outcome IN
        ('no_action', 'reply_only', 'account_action', 'content_action', 'both')),
    user_reply text,
    -- 경고받은 회원이 탈퇴해 조치 행이 삭제되면 SET NULL
    account_action_id uuid REFERENCES account_actions(id) ON DELETE SET NULL,
    content_action varchar(10) CHECK (content_action IN ('hidden', 'deleted')),
    resolved_by_admin_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    resolved_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (ticket_id, ticket_type)
        REFERENCES support_tickets(id, ticket_type) ON DELETE CASCADE,
    CHECK (ticket_type = 'report' OR outcome = 'reply_only'),
    CHECK (outcome <> 'reply_only' OR
           (user_reply IS NOT NULL AND length(btrim(user_reply)) > 0)),
    CHECK (user_reply IS NULL OR length(btrim(user_reply)) > 0),
    CHECK (
        (outcome IN ('no_action', 'reply_only')
            AND account_action_id IS NULL AND content_action IS NULL)
        OR (outcome = 'account_action' AND content_action IS NULL)
        OR (outcome = 'content_action'
            AND account_action_id IS NULL AND content_action IS NOT NULL)
        OR (outcome = 'both' AND content_action IS NOT NULL)
    )
);

ALTER TABLE account_actions
    ADD COLUMN source_ticket_id uuid REFERENCES support_tickets(id) ON DELETE SET NULL;

CREATE INDEX account_actions_source_ticket_idx
    ON account_actions (source_ticket_id) WHERE source_ticket_id IS NOT NULL;

-- 상태는 앞으로만 진행하고, 접수 후 내용은 고정한다
CREATE FUNCTION guard_support_ticket_update() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    resolution_exists boolean;
BEGIN
    IF ROW(OLD.ticket_type, OLD.category, OLD.subject, OLD.body, OLD.received_at,
           OLD.target_kind)
       IS DISTINCT FROM
       ROW(NEW.ticket_type, NEW.category, NEW.subject, NEW.body, NEW.received_at,
           NEW.target_kind) THEN
        RAISE EXCEPTION 'ticket content is immutable after receipt'
            USING ERRCODE = '23514';
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status AND NOT (
        (OLD.status = 'received' AND NEW.status = 'in_review') OR
        (OLD.status = 'in_review' AND NEW.status = 'completed')) THEN
        RAISE EXCEPTION 'ticket status can only move forward'
            USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'completed' AND
       ROW(OLD.assigned_admin_id, OLD.completed_at)
       IS DISTINCT FROM ROW(NEW.assigned_admin_id, NEW.completed_at) THEN
        RAISE EXCEPTION 'completed ticket cannot change' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
        SELECT EXISTS (SELECT 1 FROM support_ticket_resolutions
                        WHERE ticket_id = NEW.id) INTO resolution_exists;
        IF NOT resolution_exists THEN
            RAISE EXCEPTION 'a resolution is required before completing a ticket'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER support_tickets_guard_before_update
BEFORE UPDATE ON support_tickets
FOR EACH ROW EXECUTE FUNCTION guard_support_ticket_update();

-- 인용한 계정 조치는 신고된 회원 대상이어야 한다
CREATE FUNCTION guard_support_resolution() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    ticket_status varchar(12);
    ticket_target uuid;
    action_user uuid;
BEGIN
    SELECT status, target_user_id INTO ticket_status, ticket_target
      FROM support_tickets WHERE id = NEW.ticket_id;
    IF ticket_status IS DISTINCT FROM 'in_review' THEN
        RAISE EXCEPTION 'resolution requires a ticket in review'
            USING ERRCODE = '23514';
    END IF;
    IF NEW.outcome IN ('account_action', 'both') AND NEW.account_action_id IS NULL THEN
        RAISE EXCEPTION 'this outcome needs an account action'
            USING ERRCODE = '23514';
    END IF;
    IF NEW.account_action_id IS NOT NULL AND ticket_target IS NOT NULL THEN
        SELECT user_id INTO action_user FROM account_actions
         WHERE id = NEW.account_action_id;
        IF action_user IS DISTINCT FROM ticket_target THEN
            RAISE EXCEPTION 'account action must target the reported member'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER support_resolutions_guard_before_insert
BEFORE INSERT ON support_ticket_resolutions
FOR EACH ROW EXECUTE FUNCTION guard_support_resolution();

CREATE FUNCTION protect_support_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    -- 티켓 삭제로 인한 연쇄 삭제는 통과 (부모가 이미 없음)
    IF TG_OP = 'DELETE' AND NOT EXISTS (
        SELECT 1 FROM support_tickets WHERE id = OLD.ticket_id
    ) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'support history is append-only' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER support_ticket_events_no_change
BEFORE UPDATE OR DELETE ON support_ticket_events
FOR EACH ROW EXECUTE FUNCTION protect_support_history();
CREATE TRIGGER support_resolutions_no_delete
BEFORE DELETE ON support_ticket_resolutions
FOR EACH ROW EXECUTE FUNCTION protect_support_history();

-- 허용하는 유일한 수정: 조치 행 삭제 후 FK가 연결을 비움
CREATE FUNCTION guard_support_resolution_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF to_jsonb(OLD) - 'account_action_id' = to_jsonb(NEW) - 'account_action_id'
       AND OLD.account_action_id IS NOT NULL AND NEW.account_action_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM account_actions WHERE id = OLD.account_action_id) THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'support history is append-only' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER support_resolutions_guard_before_update
BEFORE UPDATE ON support_ticket_resolutions
FOR EACH ROW EXECUTE FUNCTION guard_support_resolution_update();

-- 탈퇴 시 신고자의 문의는 삭제, 신고는 신고자 참조만 NULL
CREATE FUNCTION delete_user_inquiries() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM support_tickets
     WHERE reporter_user_id = OLD.id AND ticket_type = 'inquiry';
    RETURN OLD;
END;
$$;

CREATE TRIGGER users_delete_inquiries_before_delete
BEFORE DELETE ON users
FOR EACH ROW EXECUTE FUNCTION delete_user_inquiries();

-- 부모 행(챌린지·미션 원형·계정 조치)이 지워질 때 자식 테이블 전체 스캔 방지
CREATE INDEX support_tickets_target_challenge_idx
    ON support_tickets (target_challenge_id)
    WHERE target_challenge_id IS NOT NULL;
CREATE INDEX support_tickets_target_mission_definition_idx
    ON support_tickets (target_mission_definition_id)
    WHERE target_mission_definition_id IS NOT NULL;
CREATE INDEX support_ticket_resolutions_account_action_idx
    ON support_ticket_resolutions (account_action_id)
    WHERE account_action_id IS NOT NULL;

COMMIT;
