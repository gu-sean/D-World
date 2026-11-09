-- 사용자·펫 XP, 불변 레벨 정책, 펫, XP 원장
-- 기존 보상 행은 XP 0으로 채우며 과거 소급은 하지 않는다
BEGIN;

ALTER TABLE mission_definitions
    ADD COLUMN base_user_xp integer NOT NULL DEFAULT 0 CHECK (base_user_xp >= 0),
    ADD COLUMN base_pet_xp integer NOT NULL DEFAULT 0 CHECK (base_pet_xp >= 0);
ALTER TABLE mission_reward_rate_versions
    ADD COLUMN user_xp integer NOT NULL DEFAULT 0 CHECK (user_xp >= 0),
    ADD COLUMN pet_xp integer NOT NULL DEFAULT 0 CHECK (pet_xp >= 0);
ALTER TABLE missions
    ADD COLUMN reward_user_xp integer NOT NULL DEFAULT 0 CHECK (reward_user_xp >= 0),
    ADD COLUMN reward_pet_xp integer NOT NULL DEFAULT 0 CHECK (reward_pet_xp >= 0);
ALTER TABLE achievement_versions
    ADD COLUMN reward_user_xp integer NOT NULL DEFAULT 0 CHECK (reward_user_xp >= 0),
    ADD COLUMN reward_pet_xp integer NOT NULL DEFAULT 0 CHECK (reward_pet_xp >= 0),
    ADD CONSTRAINT streak_achievement_xp_zero CHECK
        (condition_type <> 'streak_milestone' OR
         (reward_user_xp = 0 AND reward_pet_xp = 0));
ALTER TABLE streak_milestone_policy_versions
    ADD COLUMN user_xp integer NOT NULL DEFAULT 0 CHECK (user_xp >= 0),
    ADD COLUMN pet_xp integer NOT NULL DEFAULT 0 CHECK (pet_xp >= 0);

CREATE FUNCTION validate_mission_xp() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE def_origin text; def_user_xp integer; def_pet_xp integer;
        rate_user_xp integer; rate_pet_xp integer;
BEGIN
    IF NEW.source_type = 'template' THEN
        SELECT origin, base_user_xp, base_pet_xp
          INTO def_origin, def_user_xp, def_pet_xp
          FROM mission_definitions WHERE id = NEW.definition_id;
        IF def_origin = 'admin' THEN
            IF ROW(NEW.reward_user_xp, NEW.reward_pet_xp)
               IS DISTINCT FROM ROW(def_user_xp, def_pet_xp) THEN
                RAISE EXCEPTION 'template XP must match definition' USING ERRCODE='23514';
            END IF;
            RETURN NEW;
        END IF;
    END IF;
    IF NEW.reward_rate_version_id IS NOT NULL THEN
        SELECT user_xp, pet_xp INTO rate_user_xp, rate_pet_xp
          FROM mission_reward_rate_versions WHERE id=NEW.reward_rate_version_id;
        IF ROW(NEW.reward_user_xp, NEW.reward_pet_xp)
           IS DISTINCT FROM ROW(rate_user_xp, rate_pet_xp) THEN
            RAISE EXCEPTION 'mission XP must match reward rate' USING ERRCODE='23514';
        END IF;
    ELSIF NEW.reward_user_xp <> 0 OR NEW.reward_pet_xp <> 0 THEN
        RAISE EXCEPTION 'positive mission XP requires reward rate' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER missions_validate_xp_before_insert BEFORE INSERT ON missions
FOR EACH ROW EXECUTE FUNCTION validate_mission_xp();
CREATE FUNCTION lock_mission_xp() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(OLD.reward_user_xp, OLD.reward_pet_xp)
       IS DISTINCT FROM ROW(NEW.reward_user_xp, NEW.reward_pet_xp) THEN
        RAISE EXCEPTION 'mission XP is fixed at creation' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER missions_lock_xp_before_update BEFORE UPDATE ON missions
FOR EACH ROW EXECUTE FUNCTION lock_mission_xp();

CREATE TABLE user_level_policy_versions (
    id uuid PRIMARY KEY, version_no integer NOT NULL UNIQUE CHECK (version_no > 0),
    effective_at timestamptz NOT NULL,
    created_by_admin_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE user_level_thresholds (
    policy_version_id uuid NOT NULL REFERENCES user_level_policy_versions(id) ON DELETE RESTRICT,
    level_no integer NOT NULL CHECK (level_no > 0),
    min_total_xp bigint NOT NULL CHECK (min_total_xp >= 0),
    PRIMARY KEY(policy_version_id,level_no), UNIQUE(policy_version_id,min_total_xp),
    CHECK (level_no <> 1 OR min_total_xp=0)
);
CREATE TABLE pet_level_policy_versions (
    id uuid PRIMARY KEY, version_no integer NOT NULL UNIQUE CHECK (version_no > 0),
    effective_at timestamptz NOT NULL,
    created_by_admin_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE pet_level_thresholds (
    policy_version_id uuid NOT NULL REFERENCES pet_level_policy_versions(id) ON DELETE RESTRICT,
    level_no integer NOT NULL CHECK (level_no > 0),
    min_total_xp bigint NOT NULL CHECK (min_total_xp >= 0),
    PRIMARY KEY(policy_version_id,level_no), UNIQUE(policy_version_id,min_total_xp),
    CHECK (level_no <> 1 OR min_total_xp=0)
);

CREATE FUNCTION check_xp_threshold_sequence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior_xp bigint;
BEGIN
    IF NEW.level_no=1 THEN RETURN NEW; END IF;
    EXECUTE format('SELECT min_total_xp FROM %I WHERE policy_version_id=$1 AND level_no=$2', TG_TABLE_NAME)
       INTO prior_xp USING NEW.policy_version_id, NEW.level_no-1;
    IF prior_xp IS NULL OR NEW.min_total_xp <= prior_xp THEN
        RAISE EXCEPTION 'XP thresholds require contiguous, increasing levels' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER user_threshold_sequence BEFORE INSERT ON user_level_thresholds
FOR EACH ROW EXECUTE FUNCTION check_xp_threshold_sequence();
CREATE TRIGGER pet_threshold_sequence BEFORE INSERT ON pet_level_thresholds
FOR EACH ROW EXECUTE FUNCTION check_xp_threshold_sequence();
CREATE FUNCTION protect_xp_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'XP policy is immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER user_level_policy_no_change BEFORE UPDATE OR DELETE ON user_level_policy_versions
FOR EACH ROW EXECUTE FUNCTION protect_xp_policy();
CREATE TRIGGER user_threshold_no_change BEFORE UPDATE OR DELETE ON user_level_thresholds
FOR EACH ROW EXECUTE FUNCTION protect_xp_policy();
CREATE TRIGGER pet_level_policy_no_change BEFORE UPDATE OR DELETE ON pet_level_policy_versions
FOR EACH ROW EXECUTE FUNCTION protect_xp_policy();
CREATE TRIGGER pet_threshold_no_change BEFORE UPDATE OR DELETE ON pet_level_thresholds
FOR EACH ROW EXECUTE FUNCTION protect_xp_policy();

CREATE TABLE user_experience (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    level_policy_version_id uuid NOT NULL REFERENCES user_level_policy_versions(id) ON DELETE RESTRICT,
    total_xp bigint NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
    level_no integer NOT NULL DEFAULT 1 CHECK (level_no > 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION guard_user_experience() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE calculated integer;
BEGIN
    IF TG_OP='UPDATE' AND OLD.level_policy_version_id IS DISTINCT FROM NEW.level_policy_version_id THEN
        RAISE EXCEPTION 'user level policy cannot change' USING ERRCODE='23514';
    END IF;
    SELECT max(level_no) INTO calculated FROM user_level_thresholds
     WHERE policy_version_id=NEW.level_policy_version_id AND min_total_xp<=NEW.total_xp;
    IF calculated IS NULL OR calculated<>NEW.level_no THEN
        RAISE EXCEPTION 'user level does not match XP policy' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER user_experience_guard BEFORE INSERT OR UPDATE ON user_experience
FOR EACH ROW EXECUTE FUNCTION guard_user_experience();

CREATE TABLE pet_species (
    id uuid PRIMARY KEY, code varchar(80) NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]*$'),
    name varchar(80) NOT NULL CHECK (length(btrim(name))>0),
    description text, status varchar(12) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','public','hidden')),
    created_by_admin_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE pet_stage_images (
    id uuid PRIMARY KEY, species_id uuid NOT NULL REFERENCES pet_species(id) ON DELETE RESTRICT,
    r2_object_key text NOT NULL UNIQUE CHECK (length(btrim(r2_object_key))>0),
    mime_type varchar(40) NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp')),
    size_bytes bigint NOT NULL CHECK (size_bytes>0), uploaded_at timestamptz NOT NULL,
    created_by_admin_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,species_id)
);
CREATE TRIGGER pet_stage_images_no_change BEFORE UPDATE OR DELETE ON pet_stage_images
FOR EACH ROW EXECUTE FUNCTION protect_xp_policy();
CREATE TABLE pet_species_versions (
    id uuid PRIMARY KEY, species_id uuid NOT NULL REFERENCES pet_species(id) ON DELETE RESTRICT,
    version_no integer NOT NULL CHECK (version_no>0),
    name varchar(80) NOT NULL CHECK (length(btrim(name))>0),
    description text, personality text, world_text text,
    category_id uuid NOT NULL REFERENCES goal_categories(id) ON DELETE RESTRICT,
    unlock_condition_type varchar(40) NOT NULL CHECK (unlock_condition_type IN
        ('none','approved_mission_count','category_approved_mission_count',
         'streak_milestone','achievement_earned')),
    unlock_target_count integer, unlock_category_id uuid REFERENCES goal_categories(id) ON DELETE RESTRICT,
    unlock_achievement_id uuid REFERENCES achievement_definitions(id) ON DELETE RESTRICT,
    hatch_mission_count integer NOT NULL CHECK (hatch_mission_count>=0),
    effective_at timestamptz NOT NULL,
    created_by_admin_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(species_id,version_no), UNIQUE(id,species_id),
    CHECK (
      (unlock_condition_type='none' AND unlock_target_count IS NULL AND unlock_category_id IS NULL AND unlock_achievement_id IS NULL)
      OR (unlock_condition_type='approved_mission_count' AND unlock_target_count>0 AND unlock_category_id IS NULL AND unlock_achievement_id IS NULL)
      OR (unlock_condition_type='category_approved_mission_count' AND unlock_target_count>0 AND unlock_category_id IS NOT NULL AND unlock_achievement_id IS NULL)
      OR (unlock_condition_type='streak_milestone' AND unlock_target_count IN (7,30,100) AND unlock_category_id IS NULL AND unlock_achievement_id IS NULL)
      OR (unlock_condition_type='achievement_earned' AND unlock_target_count IS NULL AND unlock_category_id IS NULL AND unlock_achievement_id IS NOT NULL)
    )
);
CREATE TRIGGER pet_species_versions_no_change BEFORE UPDATE OR DELETE ON pet_species_versions
FOR EACH ROW EXECUTE FUNCTION protect_xp_policy();
CREATE TABLE pet_stage_versions (
    species_version_id uuid NOT NULL, species_id uuid NOT NULL,
    stage_no smallint NOT NULL CHECK (stage_no BETWEEN 1 AND 3),
    stage_code varchar(8) NOT NULL CHECK (stage_code IN ('egg','baby','adult')),
    min_total_xp bigint NOT NULL CHECK (min_total_xp>=0),
    bonus_basis_points integer NOT NULL CHECK (bonus_basis_points BETWEEN 0 AND 2000),
    image_id uuid NOT NULL, PRIMARY KEY(species_version_id,stage_no),
    FOREIGN KEY(species_version_id,species_id) REFERENCES pet_species_versions(id,species_id) ON DELETE RESTRICT,
    FOREIGN KEY(image_id,species_id) REFERENCES pet_stage_images(id,species_id) ON DELETE RESTRICT,
    CHECK ((stage_no=1 AND stage_code='egg' AND min_total_xp=0) OR
           (stage_no=2 AND stage_code='baby' AND min_total_xp>0) OR
           (stage_no=3 AND stage_code='adult' AND min_total_xp>0))
);
CREATE FUNCTION check_pet_stage_sequence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous_xp bigint;
BEGIN
    IF NEW.stage_no=1 THEN RETURN NEW; END IF;
    SELECT min_total_xp INTO previous_xp FROM pet_stage_versions
     WHERE species_version_id=NEW.species_version_id AND stage_no=NEW.stage_no-1;
    IF previous_xp IS NULL OR NEW.min_total_xp<=previous_xp THEN
        RAISE EXCEPTION 'pet stages require contiguous, increasing XP' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER pet_stage_sequence BEFORE INSERT ON pet_stage_versions
FOR EACH ROW EXECUTE FUNCTION check_pet_stage_sequence();
CREATE TRIGGER pet_stage_versions_no_change BEFORE UPDATE OR DELETE ON pet_stage_versions
FOR EACH ROW EXECUTE FUNCTION protect_xp_policy();
CREATE TABLE pet_stage_dialogues (
    species_version_id uuid NOT NULL, stage_no smallint NOT NULL,
    dialogue_no integer NOT NULL CHECK (dialogue_no>0),
    text_content text NOT NULL CHECK (length(btrim(text_content))>0),
    time_of_day varchar(12) CHECK (time_of_day IN ('morning','afternoon','evening','night')),
    situation_code varchar(40), display_order integer NOT NULL CHECK (display_order>0),
    PRIMARY KEY(species_version_id,stage_no,dialogue_no),
    FOREIGN KEY(species_version_id,stage_no) REFERENCES pet_stage_versions(species_version_id,stage_no) ON DELETE RESTRICT
);
CREATE TRIGGER pet_stage_dialogues_no_change BEFORE UPDATE OR DELETE ON pet_stage_dialogues
FOR EACH ROW EXECUTE FUNCTION protect_xp_policy();

CREATE TABLE user_pets (
    id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    species_id uuid NOT NULL, species_version_id uuid NOT NULL,
    level_policy_version_id uuid NOT NULL REFERENCES pet_level_policy_versions(id) ON DELETE RESTRICT,
    nickname varchar(10) NOT NULL CHECK (nickname ~ '^[가-힣A-Za-z]{2,10}$'),
    total_xp bigint NOT NULL DEFAULT 0 CHECK (total_xp>=0),
    level_no integer NOT NULL DEFAULT 1 CHECK (level_no>0),
    stage_no smallint NOT NULL DEFAULT 1 CHECK (stage_no BETWEEN 1 AND 3),
    selected_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id,species_id), UNIQUE(id,user_id),
    FOREIGN KEY(species_version_id,species_id) REFERENCES pet_species_versions(id,species_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX user_pets_nickname_ci_uq ON user_pets(user_id,lower(nickname));
CREATE FUNCTION guard_user_pet() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE calculated integer; spec_effective timestamptz; level_effective timestamptz;
        unlock_type text; unlock_target integer; unlock_category uuid; unlock_achievement uuid;
        actual_count integer; baby_xp bigint; adult_xp bigint; hatch_required integer;
        expected_stage smallint;
BEGIN
    IF TG_OP='INSERT' THEN
        SELECT effective_at, unlock_condition_type, unlock_target_count,
               unlock_category_id, unlock_achievement_id
          INTO spec_effective, unlock_type, unlock_target, unlock_category, unlock_achievement
          FROM pet_species_versions WHERE id=NEW.species_version_id;
        SELECT effective_at INTO level_effective FROM pet_level_policy_versions WHERE id=NEW.level_policy_version_id;
        IF spec_effective>NEW.selected_at OR level_effective>NEW.selected_at OR
           NOT EXISTS(SELECT 1 FROM pet_species WHERE id=NEW.species_id AND status='public') OR
           (SELECT count(*) FROM pet_stage_versions WHERE species_version_id=NEW.species_version_id)<>3 THEN
            RAISE EXCEPTION 'pet policies must be published and complete at selection' USING ERRCODE='23514';
        END IF;
        IF unlock_type='approved_mission_count' OR unlock_type='category_approved_mission_count' THEN
            SELECT count(DISTINCT m.id) INTO actual_count FROM missions m
            JOIN mission_records mr ON mr.mission_id=m.id
            JOIN verification_results vr ON vr.record_id=mr.id
            WHERE m.user_id=NEW.user_id AND m.status='completed'
              AND vr.decision='approved' AND vr.is_current
              AND (unlock_type='approved_mission_count' OR m.category_id=unlock_category);
            IF actual_count<unlock_target THEN RAISE EXCEPTION 'pet unlock condition unmet' USING ERRCODE='23514'; END IF;
        ELSIF unlock_type='streak_milestone' THEN
            IF NOT EXISTS (SELECT 1 FROM streak_milestone_awards
                WHERE user_id=NEW.user_id AND target_success_days=unlock_target AND status='active') THEN
                RAISE EXCEPTION 'pet unlock condition unmet' USING ERRCODE='23514'; END IF;
        ELSIF unlock_type='achievement_earned' THEN
            IF NOT EXISTS (SELECT 1 FROM user_achievements
                WHERE user_id=NEW.user_id AND achievement_id=unlock_achievement AND status='active') THEN
                RAISE EXCEPTION 'pet unlock condition unmet' USING ERRCODE='23514'; END IF;
        END IF;
    ELSE
        IF ROW(OLD.user_id,OLD.species_id,OLD.species_version_id,OLD.level_policy_version_id,OLD.selected_at)
           IS DISTINCT FROM ROW(NEW.user_id,NEW.species_id,NEW.species_version_id,NEW.level_policy_version_id,NEW.selected_at) THEN
            RAISE EXCEPTION 'pet identity and policies cannot change' USING ERRCODE='23514';
        END IF;
    END IF;
    SELECT max(level_no) INTO calculated FROM pet_level_thresholds
     WHERE policy_version_id=NEW.level_policy_version_id AND min_total_xp<=NEW.total_xp;
    IF calculated IS NULL OR calculated<>NEW.level_no THEN
        RAISE EXCEPTION 'pet level does not match XP policy' USING ERRCODE='23514';
    END IF;
    SELECT min_total_xp INTO baby_xp FROM pet_stage_versions
     WHERE species_version_id=NEW.species_version_id AND stage_no=2;
    SELECT min_total_xp INTO adult_xp FROM pet_stage_versions
     WHERE species_version_id=NEW.species_version_id AND stage_no=3;
    SELECT hatch_mission_count INTO hatch_required FROM pet_species_versions
     WHERE id=NEW.species_version_id;
    SELECT count(DISTINCT m.id) INTO actual_count FROM missions m
    JOIN mission_records mr ON mr.mission_id=m.id
    JOIN verification_results vr ON vr.record_id=mr.id
    JOIN pet_species_versions psv ON psv.id=NEW.species_version_id
    WHERE m.user_id=NEW.user_id AND m.category_id=psv.category_id
      AND m.status='completed' AND mr.started_at>=NEW.selected_at
      AND vr.decision='approved' AND vr.is_current;
    expected_stage:=CASE WHEN NEW.total_xp<baby_xp OR actual_count<hatch_required THEN 1
                         WHEN NEW.total_xp<adult_xp THEN 2 ELSE 3 END;
    IF NEW.stage_no<>expected_stage THEN
        RAISE EXCEPTION 'pet stage does not match XP and hatch conditions' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER user_pets_guard BEFORE INSERT OR UPDATE ON user_pets
FOR EACH ROW EXECUTE FUNCTION guard_user_pet();
CREATE FUNCTION protect_user_pet_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS(SELECT 1 FROM users WHERE id=OLD.user_id) THEN
        RAISE EXCEPTION 'pet cannot be deleted before account withdrawal' USING ERRCODE='23514';
    END IF;
    RETURN OLD;
END $$;
CREATE TRIGGER user_pets_no_direct_delete BEFORE DELETE ON user_pets
FOR EACH ROW EXECUTE FUNCTION protect_user_pet_delete();
ALTER TABLE profiles ADD COLUMN representative_pet_id uuid;
ALTER TABLE profiles ADD CONSTRAINT profiles_representative_pet_owner_fk
    FOREIGN KEY(representative_pet_id,user_id) REFERENCES user_pets(id,user_id)
    ON DELETE SET NULL (representative_pet_id);
CREATE TABLE pet_evolution_events (
    id uuid PRIMARY KEY, user_pet_id uuid NOT NULL REFERENCES user_pets(id) ON DELETE CASCADE,
    from_stage_no smallint NOT NULL CHECK(from_stage_no BETWEEN 1 AND 3),
    to_stage_no smallint NOT NULL CHECK(to_stage_no BETWEEN 1 AND 3),
    total_xp_after bigint NOT NULL CHECK(total_xp_after>=0),
    reason varchar(24) NOT NULL CHECK(reason IN ('growth','reversal','reinstatement')),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    CHECK(abs(to_stage_no-from_stage_no)=1)
);

ALTER TABLE mission_records ADD COLUMN reward_pet_id uuid,
    ADD COLUMN reward_pet_stage_no smallint CHECK(reward_pet_stage_no BETWEEN 1 AND 3),
    ADD COLUMN reward_pet_bonus_basis_points integer NOT NULL DEFAULT 0
        CHECK(reward_pet_bonus_basis_points BETWEEN 0 AND 2000),
    ADD CONSTRAINT mission_records_reward_pet_owner_fk
        FOREIGN KEY(reward_pet_id,user_id) REFERENCES user_pets(id,user_id) ON DELETE RESTRICT,
    ADD CONSTRAINT mission_records_pet_snapshot_check CHECK
        ((reward_pet_id IS NULL AND reward_pet_stage_no IS NULL AND reward_pet_bonus_basis_points=0)
         OR (reward_pet_id IS NOT NULL AND reward_pet_stage_no IS NOT NULL));
CREATE FUNCTION snapshot_mission_pet() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE selected_pet uuid; selected_stage smallint; selected_bonus integer;
        pet_category uuid; mission_category uuid;
BEGIN
    IF TG_OP='UPDATE' THEN
        IF ROW(OLD.reward_pet_id,OLD.reward_pet_stage_no,OLD.reward_pet_bonus_basis_points)
           IS DISTINCT FROM ROW(NEW.reward_pet_id,NEW.reward_pet_stage_no,NEW.reward_pet_bonus_basis_points) THEN
            RAISE EXCEPTION 'mission pet reward snapshot is immutable' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
    END IF;
    NEW.reward_pet_id:=NULL;
    NEW.reward_pet_stage_no:=NULL;
    NEW.reward_pet_bonus_basis_points:=0;
    SELECT p.representative_pet_id, up.stage_no, psv.category_id, m.category_id
      INTO selected_pet, selected_stage, pet_category, mission_category
      FROM profiles p JOIN missions m ON m.user_id=p.user_id
      LEFT JOIN user_pets up ON up.id=p.representative_pet_id
      LEFT JOIN pet_species_versions psv ON psv.id=up.species_version_id
     WHERE m.id=NEW.mission_id AND p.user_id=NEW.user_id;
    IF selected_pet IS NOT NULL THEN
        SELECT bonus_basis_points INTO selected_bonus FROM pet_stage_versions
         WHERE species_version_id=(SELECT species_version_id FROM user_pets WHERE id=selected_pet)
           AND stage_no=selected_stage;
        NEW.reward_pet_id:=selected_pet;
        NEW.reward_pet_stage_no:=selected_stage;
        NEW.reward_pet_bonus_basis_points:=CASE WHEN pet_category=mission_category THEN selected_bonus ELSE 0 END;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER mission_records_pet_snapshot BEFORE INSERT OR UPDATE ON mission_records
FOR EACH ROW EXECUTE FUNCTION snapshot_mission_pet();

CREATE TABLE experience_awards (
    id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type varchar(16) NOT NULL CHECK(source_type IN ('mission','achievement','streak')),
    source_id uuid NOT NULL, recipient_pet_id uuid,
    base_user_xp integer NOT NULL CHECK(base_user_xp>=0),
    base_pet_xp integer NOT NULL CHECK(base_pet_xp>=0),
    bonus_pet_xp integer NOT NULL DEFAULT 0 CHECK(bonus_pet_xp>=0),
    pet_species_version_id uuid REFERENCES pet_species_versions(id) ON DELETE RESTRICT,
    pet_stage_no smallint CHECK(pet_stage_no BETWEEN 1 AND 3),
    bonus_basis_points integer NOT NULL DEFAULT 0 CHECK(bonus_basis_points BETWEEN 0 AND 2000),
    status varchar(12) NOT NULL CHECK(status IN ('active','revoked')),
    first_awarded_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id,source_type,source_id), UNIQUE(id,user_id),
    FOREIGN KEY(recipient_pet_id,user_id) REFERENCES user_pets(id,user_id) ON DELETE RESTRICT,
    CHECK(bonus_pet_xp=(base_pet_xp::bigint*bonus_basis_points/10000)::integer),
    CHECK((recipient_pet_id IS NULL AND bonus_pet_xp=0 AND bonus_basis_points=0 AND pet_stage_no IS NULL AND pet_species_version_id IS NULL)
       OR (recipient_pet_id IS NOT NULL AND pet_stage_no IS NOT NULL AND pet_species_version_id IS NOT NULL)),
    CHECK(source_type='mission' OR (bonus_pet_xp=0 AND bonus_basis_points=0))
);
CREATE FUNCTION guard_experience_award() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_user_xp integer; expected_pet_xp integer;
        source_status text; source_user uuid; snapshot_pet uuid;
        snapshot_stage smallint; snapshot_bonus integer;
        snapshot_species_version uuid;
BEGIN
    IF TG_OP='UPDATE' THEN
        IF ROW(OLD.user_id,OLD.source_type,OLD.source_id,OLD.base_user_xp,OLD.base_pet_xp,
               OLD.bonus_pet_xp,OLD.pet_species_version_id,OLD.pet_stage_no,OLD.bonus_basis_points)
           IS DISTINCT FROM ROW(NEW.user_id,NEW.source_type,NEW.source_id,NEW.base_user_xp,NEW.base_pet_xp,
               NEW.bonus_pet_xp,NEW.pet_species_version_id,NEW.pet_stage_no,NEW.bonus_basis_points)
           OR (OLD.recipient_pet_id IS NOT NULL AND OLD.recipient_pet_id IS DISTINCT FROM NEW.recipient_pet_id) THEN
            RAISE EXCEPTION 'XP award source and amount are fixed' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.source_type='mission' THEN
        SELECT user_id,status,reward_user_xp,reward_pet_xp
          INTO source_user,source_status,expected_user_xp,expected_pet_xp
          FROM missions WHERE id=NEW.source_id;
        SELECT mr.reward_pet_id,mr.reward_pet_stage_no,mr.reward_pet_bonus_basis_points,
               up.species_version_id
          INTO snapshot_pet,snapshot_stage,snapshot_bonus,snapshot_species_version
          FROM mission_records mr
          JOIN verification_results vr ON vr.record_id=mr.id
          LEFT JOIN user_pets up ON up.id=mr.reward_pet_id
         WHERE mr.mission_id=NEW.source_id AND vr.decision='approved' AND vr.is_current
         ORDER BY mr.submitted_at DESC LIMIT 1;
        IF snapshot_pet IS DISTINCT FROM NEW.recipient_pet_id OR
           snapshot_stage IS DISTINCT FROM NEW.pet_stage_no OR
           snapshot_species_version IS DISTINCT FROM NEW.pet_species_version_id OR
           COALESCE(snapshot_bonus,0) IS DISTINCT FROM NEW.bonus_basis_points THEN
            RAISE EXCEPTION 'XP award must use mission start pet snapshot' USING ERRCODE='23514';
        END IF;
    ELSIF NEW.source_type='achievement' THEN
        SELECT ua.user_id,ua.status,av.reward_user_xp,av.reward_pet_xp
          INTO source_user,source_status,expected_user_xp,expected_pet_xp
          FROM user_achievements ua JOIN achievement_versions av ON av.id=ua.achievement_version_id
         WHERE ua.id=NEW.source_id;
    ELSE
        SELECT sma.user_id,sma.status,sp.user_xp,sp.pet_xp
          INTO source_user,source_status,expected_user_xp,expected_pet_xp
          FROM streak_milestone_awards sma
          JOIN streak_milestone_policy_versions sp ON sp.id=sma.policy_version_id
         WHERE sma.id=NEW.source_id;
    END IF;
    IF source_user IS DISTINCT FROM NEW.user_id OR
       source_status IS DISTINCT FROM (CASE WHEN NEW.source_type='mission' THEN 'completed' ELSE 'active' END) OR
       expected_user_xp IS DISTINCT FROM NEW.base_user_xp OR
       expected_pet_xp IS DISTINCT FROM NEW.base_pet_xp OR
       (NEW.source_type='mission' AND NOT EXISTS (
            SELECT 1 FROM mission_records mr JOIN verification_results vr ON vr.record_id=mr.id
             WHERE mr.mission_id=NEW.source_id AND vr.decision='approved' AND vr.is_current)) THEN
        RAISE EXCEPTION 'XP award requires an active matching source' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER experience_awards_guard BEFORE INSERT OR UPDATE ON experience_awards
FOR EACH ROW EXECUTE FUNCTION guard_experience_award();
CREATE TABLE pending_pet_experience (
    experience_award_id uuid PRIMARY KEY, user_id uuid NOT NULL,
    base_pet_xp integer NOT NULL CHECK(base_pet_xp>=0),
    status varchar(12) NOT NULL CHECK(status IN ('pending','assigned','cancelled')),
    assigned_pet_id uuid, created_at timestamptz NOT NULL DEFAULT now(), assigned_at timestamptz,
    FOREIGN KEY(experience_award_id,user_id) REFERENCES experience_awards(id,user_id) ON DELETE CASCADE,
    FOREIGN KEY(assigned_pet_id,user_id) REFERENCES user_pets(id,user_id) ON DELETE RESTRICT,
    CHECK((status='assigned')=(assigned_pet_id IS NOT NULL AND assigned_at IS NOT NULL))
);
CREATE TABLE experience_transactions (
    id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_kind varchar(4) NOT NULL CHECK(recipient_kind IN ('user','pet')),
    user_pet_id uuid, experience_award_id uuid,
    xp_delta bigint NOT NULL CHECK(xp_delta<>0), balance_after bigint NOT NULL CHECK(balance_after>=0),
    kind varchar(20) NOT NULL CHECK(kind IN ('award','reversal','reinstatement','admin_adjustment')),
    original_transaction_id uuid, idempotency_key text NOT NULL UNIQUE CHECK(length(btrim(idempotency_key))>0),
    created_by_admin_id uuid REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    reason text, occurred_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(id,user_id),
    FOREIGN KEY(user_pet_id,user_id) REFERENCES user_pets(id,user_id) ON DELETE CASCADE,
    FOREIGN KEY(experience_award_id,user_id) REFERENCES experience_awards(id,user_id) ON DELETE CASCADE,
    FOREIGN KEY(original_transaction_id,user_id) REFERENCES experience_transactions(id,user_id) ON DELETE CASCADE,
    CHECK((recipient_kind='user' AND user_pet_id IS NULL) OR (recipient_kind='pet' AND user_pet_id IS NOT NULL)),
    CHECK((kind='admin_adjustment' AND created_by_admin_id IS NOT NULL AND reason IS NOT NULL
        AND length(btrim(reason))>0) OR (kind<>'admin_adjustment' AND experience_award_id IS NOT NULL)),
    CHECK((kind IN ('reversal','reinstatement'))=(original_transaction_id IS NOT NULL))
);
CREATE INDEX experience_transactions_award_idx ON experience_transactions(experience_award_id,occurred_at);
CREATE FUNCTION protect_experience_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'experience ledger is append-only' USING ERRCODE='23514';
END $$;
CREATE TRIGGER experience_transactions_no_change BEFORE UPDATE OR DELETE ON experience_transactions
FOR EACH ROW EXECUTE FUNCTION protect_experience_transaction();

-- users 참조 FK 중 인덱스가 없던 곳, 없으면 탈퇴 때 전체 스캔
CREATE INDEX experience_transactions_user_idx
    ON experience_transactions (user_id, id);
-- 부모 행(펫)이 연쇄로 지워질 때 자식 테이블 전체 스캔 방지
CREATE INDEX pet_evolution_events_user_pet_idx
    ON pet_evolution_events (user_pet_id);

CREATE TABLE admin_asset_uploads (
    id uuid PRIMARY KEY,
    asset_kind varchar(12) NOT NULL CHECK (asset_kind IN ('badge', 'pet_stage')),
    owner_id uuid NOT NULL,
    version_no integer CHECK (version_no > 0),
    object_key text NOT NULL UNIQUE CHECK (length(btrim(object_key)) > 0),
    mime_type varchar(40) NOT NULL
        CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
    size_bytes bigint NOT NULL CHECK (size_bytes > 0),
    created_by_admin_id uuid NOT NULL
        REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    uploaded_at timestamptz,
    consumed_at timestamptz,
    CHECK ((asset_kind = 'badge') = (version_no IS NOT NULL)),
    CHECK (consumed_at IS NULL OR uploaded_at IS NOT NULL)
);

CREATE INDEX admin_asset_uploads_owner_idx
    ON admin_asset_uploads (asset_kind, owner_id);
CREATE INDEX admin_asset_uploads_admin_idx
    ON admin_asset_uploads (created_by_admin_id);

COMMIT;
