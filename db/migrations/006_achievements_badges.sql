-- 버전형 업적, R2 배지 이미지, 사용자 획득 기록
-- 조건 평가와 획득·대표 배지·원장 갱신은 앱이 한 트랜잭션으로 처리한다

BEGIN;

CREATE TABLE achievement_definitions (
    id uuid PRIMARY KEY,
    code varchar(80) NOT NULL UNIQUE
        CHECK (code ~ '^[a-z][a-z0-9_]*$'),
    status varchar(16) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'public', 'hidden')),
    created_by_admin_id uuid NOT NULL
        REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE achievement_badge_images (
    id uuid PRIMARY KEY,
    achievement_id uuid NOT NULL
        REFERENCES achievement_definitions(id) ON DELETE RESTRICT,
    version_no integer NOT NULL CHECK (version_no > 0),
    r2_object_key text NOT NULL UNIQUE
        CHECK (length(btrim(r2_object_key)) > 0),
    mime_type varchar(40) NOT NULL
        CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
    size_bytes bigint NOT NULL CHECK (size_bytes > 0),
    uploaded_at timestamptz NOT NULL,
    created_by_admin_id uuid NOT NULL
        REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (achievement_id, version_no),
    UNIQUE (id, achievement_id)
);

CREATE FUNCTION protect_badge_image() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'confirmed badge image metadata is immutable'
            USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER achievement_badge_images_no_update
BEFORE UPDATE ON achievement_badge_images
FOR EACH ROW EXECUTE FUNCTION protect_badge_image();

CREATE TABLE achievement_versions (
    id uuid PRIMARY KEY,
    achievement_id uuid NOT NULL
        REFERENCES achievement_definitions(id) ON DELETE RESTRICT,
    version_no integer NOT NULL CHECK (version_no > 0),
    title varchar(160) NOT NULL CHECK (length(btrim(title)) > 0),
    description text NOT NULL CHECK (length(btrim(description)) > 0),
    rarity varchar(16) NOT NULL
        CHECK (rarity IN ('common', 'rare', 'legendary')),
    condition_type varchar(40) NOT NULL
        CHECK (condition_type IN
            ('first_goal_completed', 'approved_mission_count',
             'category_approved_mission_count', 'streak_milestone')),
    target_count integer NOT NULL CHECK (target_count > 0),
    category_id uuid REFERENCES goal_categories(id) ON DELETE RESTRICT,
    reward_points integer NOT NULL CHECK (reward_points >= 0),
    badge_image_id uuid NOT NULL,
    effective_at timestamptz NOT NULL,
    created_by_admin_id uuid NOT NULL
        REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (achievement_id, version_no),
    UNIQUE (id, achievement_id),
    FOREIGN KEY (badge_image_id, achievement_id)
        REFERENCES achievement_badge_images(id, achievement_id)
        ON DELETE RESTRICT,
    CHECK (
        (condition_type = 'first_goal_completed'
            AND target_count = 1 AND category_id IS NULL)
        OR (condition_type = 'approved_mission_count'
            AND category_id IS NULL)
        OR (condition_type = 'category_approved_mission_count'
            AND category_id IS NOT NULL)
        OR (condition_type = 'streak_milestone'
            AND target_count IN (7, 30, 100)
            AND category_id IS NULL AND reward_points = 0)
    )
);

CREATE INDEX achievement_versions_effective_idx
    ON achievement_versions (achievement_id, effective_at DESC);

CREATE FUNCTION protect_achievement_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'published achievement versions are immutable'
        USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER achievement_versions_no_change
BEFORE UPDATE OR DELETE ON achievement_versions
FOR EACH ROW EXECUTE FUNCTION protect_achievement_version();

CREATE TABLE user_achievements (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id uuid NOT NULL,
    achievement_version_id uuid NOT NULL,
    badge_image_id uuid NOT NULL,
    status varchar(12) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked')),
    source_type varchar(12) NOT NULL
        CHECK (source_type IN ('goal', 'mission', 'streak')),
    source_id uuid NOT NULL,
    first_achieved_at timestamptz NOT NULL,
    awarded_at timestamptz NOT NULL DEFAULT now(),
    awarded_points integer NOT NULL CHECK (awarded_points >= 0),
    paid_points integer NOT NULL CHECK (paid_points >= 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, achievement_id),
    UNIQUE (id, user_id),
    FOREIGN KEY (achievement_id)
        REFERENCES achievement_definitions(id) ON DELETE RESTRICT,
    FOREIGN KEY (achievement_version_id, achievement_id)
        REFERENCES achievement_versions(id, achievement_id)
        ON DELETE RESTRICT,
    FOREIGN KEY (badge_image_id, achievement_id)
        REFERENCES achievement_badge_images(id, achievement_id)
        ON DELETE RESTRICT,
    CHECK (first_achieved_at <= awarded_at),
    CHECK (paid_points <= awarded_points)
);

CREATE INDEX user_achievements_owner_status_idx
    ON user_achievements (user_id, status, awarded_at DESC);

CREATE FUNCTION guard_user_achievement() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    definition_status varchar(16);
    version_condition varchar(40);
    version_target integer;
    version_category uuid;
    version_points integer;
    version_image_id uuid;
    version_effective_at timestamptz;
    current_version_id uuid;
    source_goal_status varchar(20);
    source_mission_status varchar(20);
    source_mission_category uuid;
    source_streak_target integer;
    source_streak_status varchar(12);
    qualifying_count integer;
BEGIN
    SELECT status INTO definition_status
      FROM achievement_definitions WHERE id = NEW.achievement_id;
    SELECT condition_type, target_count, category_id, reward_points,
           badge_image_id, effective_at
      INTO version_condition, version_target, version_category,
           version_points, version_image_id, version_effective_at
      FROM achievement_versions
     WHERE id = NEW.achievement_version_id
       AND achievement_id = NEW.achievement_id;

    SELECT id INTO current_version_id
      FROM achievement_versions
     WHERE achievement_id = NEW.achievement_id
       AND effective_at <= NEW.awarded_at
     ORDER BY effective_at DESC, version_no DESC
     LIMIT 1;

    IF definition_status IS DISTINCT FROM 'public'
       OR current_version_id IS DISTINCT FROM NEW.achievement_version_id
       OR version_points IS DISTINCT FROM NEW.awarded_points
       OR version_image_id IS DISTINCT FROM NEW.badge_image_id
       OR version_effective_at > NEW.awarded_at
       OR NEW.status <> 'active' THEN
        RAISE EXCEPTION 'achievement grant requires current public definition and version'
            USING ERRCODE = '23514';
    END IF;

    IF version_condition = 'first_goal_completed' THEN
        IF NEW.source_type <> 'goal' THEN
            RAISE EXCEPTION 'first goal achievement requires a goal source'
                USING ERRCODE = '23514';
        END IF;
        SELECT status INTO source_goal_status FROM goals
         WHERE id = NEW.source_id AND user_id = NEW.user_id;
        IF source_goal_status IS DISTINCT FROM 'completed' THEN
            RAISE EXCEPTION 'goal source is not completed'
                USING ERRCODE = '23514';
        END IF;
    ELSIF version_condition IN
        ('approved_mission_count', 'category_approved_mission_count') THEN
        IF NEW.source_type <> 'mission' THEN
            RAISE EXCEPTION 'mission count achievement requires mission source'
                USING ERRCODE = '23514';
        END IF;
        SELECT status, category_id
          INTO source_mission_status, source_mission_category
          FROM missions
         WHERE id = NEW.source_id AND user_id = NEW.user_id;
        IF source_mission_status IS DISTINCT FROM 'completed'
           OR (version_condition = 'category_approved_mission_count'
               AND source_mission_category IS DISTINCT FROM version_category)
           OR NOT EXISTS (
               SELECT 1 FROM mission_records mr
               JOIN verification_results vr ON vr.record_id = mr.id
               WHERE mr.mission_id = NEW.source_id
                 AND vr.decision = 'approved' AND vr.is_current
           )
        THEN
            RAISE EXCEPTION 'mission source is not an approved completed mission'
                USING ERRCODE = '23514';
        END IF;
        SELECT count(DISTINCT m.id) INTO qualifying_count
          FROM missions m
         WHERE m.user_id = NEW.user_id
           AND m.status = 'completed'
           AND (version_category IS NULL OR m.category_id = version_category)
           AND EXISTS (
               SELECT 1 FROM mission_records mr
               JOIN verification_results vr ON vr.record_id = mr.id
               WHERE mr.mission_id = m.id
                 AND vr.decision = 'approved' AND vr.is_current
           );
        IF qualifying_count < version_target THEN
            RAISE EXCEPTION 'approved mission count is below achievement target'
                USING ERRCODE = '23514';
        END IF;
    ELSIF version_condition = 'streak_milestone' THEN
        IF NEW.source_type <> 'streak' THEN
            RAISE EXCEPTION 'streak achievement requires milestone source'
                USING ERRCODE = '23514';
        END IF;
        SELECT target_success_days, status
          INTO source_streak_target, source_streak_status
          FROM streak_milestone_awards
         WHERE id = NEW.source_id AND user_id = NEW.user_id;
        IF source_streak_target IS DISTINCT FROM version_target
           OR source_streak_status IS DISTINCT FROM 'active' THEN
            RAISE EXCEPTION 'streak milestone does not match achievement'
                USING ERRCODE = '23514';
        END IF;
    ELSE
        RAISE EXCEPTION 'unsupported achievement condition'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER user_achievements_guard_before_insert
BEFORE INSERT ON user_achievements
FOR EACH ROW EXECUTE FUNCTION guard_user_achievement();

-- paid_points는 지급 시점 월 한도에 따라 awarded_points보다 작을 수 있는데, 지급 행과 포인트 지급이
-- 서로의 id를 참조해야 해서 실제 지급액은 지급 행을 만든 뒤에만 안다. 그래서 불변 목록에서 빼고
-- 사후 보정을 허용한다. 범위는 CHECK(paid_points <= awarded_points)가 지키고,
-- 보정 시점 제한(활성 지급이고 회수 청구가 없을 때만)은 008의 트리거가 지킨다.
CREATE FUNCTION lock_user_achievement_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(OLD.id, OLD.user_id, OLD.achievement_id,
           OLD.achievement_version_id, OLD.badge_image_id,
           OLD.source_type, OLD.source_id, OLD.first_achieved_at,
           OLD.awarded_at, OLD.awarded_points)
       IS DISTINCT FROM
       ROW(NEW.id, NEW.user_id, NEW.achievement_id,
           NEW.achievement_version_id, NEW.badge_image_id,
           NEW.source_type, NEW.source_id, NEW.first_achieved_at,
           NEW.awarded_at, NEW.awarded_points) THEN
        RAISE EXCEPTION 'achievement grant identity and original reward are immutable'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER user_achievements_lock_before_update
BEFORE UPDATE ON user_achievements
FOR EACH ROW EXECUTE FUNCTION lock_user_achievement_identity();

CREATE FUNCTION protect_user_achievement_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
        RAISE EXCEPTION 'earned achievement history cannot be deleted'
            USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER user_achievements_no_direct_delete
BEFORE DELETE ON user_achievements
FOR EACH ROW EXECUTE FUNCTION protect_user_achievement_delete();

CREATE TABLE user_achievement_events (
    id uuid PRIMARY KEY,
    user_achievement_id uuid NOT NULL,
    user_id uuid NOT NULL,
    event_type varchar(16) NOT NULL
        CHECK (event_type IN ('earned', 'revoked', 'reinstated')),
    source_type varchar(12) NOT NULL
        CHECK (source_type IN ('goal', 'mission', 'streak')),
    source_id uuid NOT NULL,
    reason text,
    idempotency_key text NOT NULL UNIQUE
        CHECK (length(btrim(idempotency_key)) > 0),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (user_achievement_id, user_id)
        REFERENCES user_achievements(id, user_id) ON DELETE CASCADE,
    CHECK (event_type <> 'revoked' OR
        (reason IS NOT NULL AND length(btrim(reason)) > 0))
);

CREATE INDEX user_achievement_events_recent_idx
    ON user_achievement_events (user_achievement_id, occurred_at DESC);

CREATE UNIQUE INDEX user_achievement_events_first_earned_uq
    ON user_achievement_events (user_achievement_id)
    WHERE event_type = 'earned';

CREATE FUNCTION guard_user_achievement_event() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    grant_status varchar(12);
    source_owned boolean;
BEGIN
    SELECT status INTO grant_status FROM user_achievements
     WHERE id = NEW.user_achievement_id AND user_id = NEW.user_id;
    IF (NEW.event_type = 'revoked' AND grant_status IS DISTINCT FROM 'revoked')
       OR (NEW.event_type <> 'revoked' AND grant_status IS DISTINCT FROM 'active')
    THEN
        RAISE EXCEPTION 'achievement event does not match grant status'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.source_type = 'goal' THEN
        SELECT EXISTS (SELECT 1 FROM goals
                       WHERE id = NEW.source_id AND user_id = NEW.user_id)
          INTO source_owned;
    ELSIF NEW.source_type = 'mission' THEN
        SELECT EXISTS (SELECT 1 FROM missions
                       WHERE id = NEW.source_id AND user_id = NEW.user_id)
          INTO source_owned;
    ELSE
        SELECT EXISTS (SELECT 1 FROM streak_milestone_awards
                       WHERE id = NEW.source_id AND user_id = NEW.user_id)
          INTO source_owned;
    END IF;
    IF NOT source_owned THEN
        RAISE EXCEPTION 'achievement event source does not belong to user'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER user_achievement_events_guard_before_insert
BEFORE INSERT ON user_achievement_events
FOR EACH ROW EXECUTE FUNCTION guard_user_achievement_event();

CREATE FUNCTION protect_user_achievement_event() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' AND NOT EXISTS (
        SELECT 1 FROM users WHERE id = OLD.user_id
    ) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'achievement events are append-only'
        USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER user_achievement_events_no_change
BEFORE UPDATE OR DELETE ON user_achievement_events
FOR EACH ROW EXECUTE FUNCTION protect_user_achievement_event();

ALTER TABLE profiles
    ADD COLUMN representative_achievement_id uuid,
    ADD CONSTRAINT profiles_representative_achievement_owner_fk
        FOREIGN KEY (representative_achievement_id, user_id)
        REFERENCES user_achievements(id, user_id)
        DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION guard_representative_badge() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.representative_achievement_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM user_achievements
         WHERE id = NEW.representative_achievement_id
           AND user_id = NEW.user_id AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'representative badge must be an active owned achievement'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_guard_representative_badge_before_write
BEFORE INSERT OR UPDATE OF representative_achievement_id ON profiles
FOR EACH ROW EXECUTE FUNCTION guard_representative_badge();

CREATE FUNCTION clear_revoked_representative_badge() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status = 'active' AND NEW.status = 'revoked' THEN
        UPDATE profiles SET representative_achievement_id = NULL
         WHERE user_id = NEW.user_id
           AND representative_achievement_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER user_achievements_clear_representative_after_revoke
AFTER UPDATE OF status ON user_achievements
FOR EACH ROW EXECUTE FUNCTION clear_revoked_representative_badge();

CREATE FUNCTION guard_achievement_point_source() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.source_type = 'achievement' AND NOT EXISTS (
        SELECT 1 FROM user_achievements
         WHERE id = NEW.source_id AND user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'achievement point source does not belong to user'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER point_transactions_achievement_source_before_insert
BEFORE INSERT ON point_transactions
FOR EACH ROW EXECUTE FUNCTION guard_achievement_point_source();

COMMIT;
