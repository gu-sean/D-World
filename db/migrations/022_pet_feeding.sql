-- 펫 성장 방식 변경 (2026-11)
--   1) 펫 경험치 지갑: 미션 보상 펫 XP는 펫에게 바로 가지 않고 지갑에 쌓인다. 사용자가 "경험치 주기"로 10씩 먹인다.
--   2) 성장 규칙: 알 → 아기 = 알을 고른 뒤 완료한 세부 미션 3개(분야 무관), 아기 → 성체 = 먹인 경험치 450.
--   3) 펫 분야 삭제: 종류의 분야는 선택 사항이 되고, 부화·해금·보너스 계산에서 분야를 보지 않는다(보너스 0).
--   4) 새 미션 보상표: 모든 분야·난이도 30P · 펫 XP 30 · 사용자 XP 0 (지금부터 만드는 미션에 적용).
--   하루 한도(포인트 120P = 미션 4개, 펫 XP 하루 1번)는 백엔드가 지급할 때 계산한다.
-- 번호 안내: 공유 DB에 021_notifications_default_on이 이미 적용돼 있어 022를 쓴다.
BEGIN;

-- 1) 펫 경험치 지갑 ------------------------------------------------------------
CREATE TABLE pet_xp_wallets (
    user_id short_id PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pet_xp_wallet_transactions (
    id short_id PRIMARY KEY,
    user_id short_id NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind varchar(16) NOT NULL CHECK (kind IN ('mission', 'reward', 'feed', 'reversal')),
    xp_delta bigint NOT NULL CHECK (xp_delta <> 0),
    balance_after bigint NOT NULL CHECK (balance_after >= 0),
    source_type varchar(16),
    source_id short_id,
    user_pet_id short_id,
    reward_date date,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (user_pet_id, user_id) REFERENCES user_pets(id, user_id) ON DELETE CASCADE,
    CHECK ((kind = 'feed') = (user_pet_id IS NOT NULL)),
    CHECK (kind <> 'feed' OR xp_delta < 0),
    CHECK (kind NOT IN ('mission', 'reward') OR (xp_delta > 0 AND source_id IS NOT NULL)),
    CHECK ((kind = 'mission') = (reward_date IS NOT NULL))
);
-- 미션 펫 XP는 하루(KST) 한 번만
CREATE UNIQUE INDEX pet_xp_mission_daily_uq
    ON pet_xp_wallet_transactions (user_id, reward_date) WHERE kind = 'mission';
-- 같은 출처(미션·업적 등)에서 두 번 적립하지 않음
CREATE UNIQUE INDEX pet_xp_source_once_uq
    ON pet_xp_wallet_transactions (user_id, source_type, source_id) WHERE kind IN ('mission', 'reward');
CREATE INDEX pet_xp_wallet_transactions_user_idx
    ON pet_xp_wallet_transactions (user_id, occurred_at DESC);
CREATE INDEX pet_xp_wallet_transactions_pet_idx
    ON pet_xp_wallet_transactions (user_pet_id) WHERE user_pet_id IS NOT NULL;

CREATE FUNCTION protect_pet_xp_wallet_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'pet xp wallet ledger is append-only' USING ERRCODE = '23514';
END $$;
CREATE TRIGGER pet_xp_wallet_transactions_no_change
BEFORE UPDATE OR DELETE ON pet_xp_wallet_transactions
FOR EACH ROW EXECUTE FUNCTION protect_pet_xp_wallet_transaction();

ALTER TABLE pet_xp_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_xp_wallet_transactions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE pet_xp_wallets IS
    '사용자가 모은 펫 경험치(아직 펫에게 먹이지 않은 양). 미션 보상(하루 1번 30)으로 늘고, 펫에게 10씩 먹이면 줄어든다.';
COMMENT ON TABLE pet_xp_wallet_transactions IS
    '펫 경험치 지갑 원장(추가만). mission=하루 첫 미션 보상, reward=업적·챌린지 등 보상, feed=펫에게 먹임(음수), reversal=승인 취소로 회수.';

-- 2·3) 성장 규칙과 분야 삭제 ---------------------------------------------------
ALTER TABLE pet_species_versions ALTER COLUMN category_id DROP NOT NULL;
COMMENT ON COLUMN pet_species_versions.category_id IS
    '(사용 안 함) 예전의 펫 분야. 부화·해금·보너스 계산에서 보지 않는다.';

CREATE OR REPLACE FUNCTION guard_user_pet() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE calculated integer; spec_effective timestamptz; level_effective timestamptz;
        unlock_type text; unlock_target integer; unlock_achievement short_id;
        actual_count integer; expected_stage smallint;
        hatch_required CONSTANT integer := 3;
        adult_xp CONSTANT bigint := 450;
BEGIN
    IF TG_OP='INSERT' THEN
        SELECT effective_at, unlock_condition_type, unlock_target_count, unlock_achievement_id
          INTO spec_effective, unlock_type, unlock_target, unlock_achievement
          FROM pet_species_versions WHERE id=NEW.species_version_id;
        SELECT effective_at INTO level_effective FROM pet_level_policy_versions WHERE id=NEW.level_policy_version_id;
        IF spec_effective>NEW.selected_at OR level_effective>NEW.selected_at OR
           NOT EXISTS(SELECT 1 FROM pet_species WHERE id=NEW.species_id AND status='public') OR
           (SELECT count(*) FROM pet_stage_versions WHERE species_version_id=NEW.species_version_id)<>3 THEN
            RAISE EXCEPTION 'pet policies must be published and complete at selection' USING ERRCODE='23514';
        END IF;
        -- 분야 조건(category_approved_mission_count)도 분야 없이 완료 미션 수로 센다
        IF unlock_type IN ('approved_mission_count', 'category_approved_mission_count') THEN
            SELECT count(DISTINCT m.id) INTO actual_count FROM missions m
            JOIN mission_records mr ON mr.mission_id=m.id
            JOIN verification_results vr ON vr.record_id=mr.id
            WHERE m.user_id=NEW.user_id AND m.status='completed'
              AND vr.decision='approved' AND vr.is_current;
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
    -- 알을 고른 뒤 시작해 완료(승인)한 세부 미션 수, 분야 무관
    SELECT count(DISTINCT m.id) INTO actual_count FROM missions m
    JOIN mission_records mr ON mr.mission_id=m.id
    JOIN verification_results vr ON vr.record_id=mr.id
    WHERE m.user_id=NEW.user_id AND m.status='completed' AND mr.started_at>=NEW.selected_at
      AND vr.decision='approved' AND vr.is_current;
    expected_stage:=CASE WHEN actual_count<hatch_required THEN 1
                         WHEN NEW.total_xp<adult_xp THEN 2 ELSE 3 END;
    IF NEW.stage_no<>expected_stage THEN
        RAISE EXCEPTION 'pet stage does not match hatch missions and fed XP' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;

-- 미션 시작 때 고정하는 펫 보너스: 분야가 없어졌으므로 항상 0
CREATE OR REPLACE FUNCTION snapshot_mission_pet() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE selected_pet short_id; selected_stage smallint;
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
    SELECT p.representative_pet_id, up.stage_no INTO selected_pet, selected_stage
      FROM profiles p LEFT JOIN user_pets up ON up.id=p.representative_pet_id
     WHERE p.user_id=NEW.user_id;
    IF selected_pet IS NOT NULL THEN
        NEW.reward_pet_id:=selected_pet;
        NEW.reward_pet_stage_no:=selected_stage;
    END IF;
    RETURN NEW;
END $$;

-- 4) 새 미션 보상표 (분야·난이도마다 새 버전, 관리자 계정이 있을 때만) -------------
INSERT INTO mission_reward_rate_versions
       (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp, effective_at, created_by_admin_id)
SELECT substr(md5(random()::text || c.id || d.id), 1, 8),
       c.id, d.id,
       COALESCE((SELECT max(version_no) FROM mission_reward_rate_versions r
                  WHERE r.category_id = c.id AND r.difficulty_id = d.id), 0) + 1,
       30, 0, 30, now(),
       (SELECT id FROM admin_accounts ORDER BY created_at LIMIT 1)
  FROM goal_categories c CROSS JOIN difficulty_levels d
 WHERE EXISTS (SELECT 1 FROM admin_accounts);

-- 5) 펫이 없을 때 쌓였던 보류 펫 XP는 지갑으로 옮긴다 (예전 방식은 펫을 고르면 한 번에 들어갔음) ----
INSERT INTO pet_xp_wallet_transactions (id, user_id, kind, xp_delta, balance_after, source_type, source_id)
SELECT substr(md5(random()::text || p.experience_award_id), 1, 8), p.user_id, 'reward', p.base_pet_xp,
       sum(p.base_pet_xp) OVER (PARTITION BY p.user_id ORDER BY p.created_at, p.experience_award_id),
       'pending_xp', p.experience_award_id
  FROM pending_pet_experience p
 WHERE p.status = 'pending' AND p.base_pet_xp > 0;
INSERT INTO pet_xp_wallets (user_id, balance)
SELECT user_id, sum(base_pet_xp) FROM pending_pet_experience
 WHERE status = 'pending' AND base_pet_xp > 0 GROUP BY user_id;
UPDATE pending_pet_experience SET status = 'cancelled' WHERE status = 'pending';

COMMIT;
