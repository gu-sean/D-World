-- 챌린지: 참여, 일별 인증, 순위, 정산, 보상
-- 정산 확정과 포인트·XP·배지 지급은 앱이 원자적으로 처리한다
BEGIN;

ALTER TABLE missions DROP CONSTRAINT missions_source_type_check;
ALTER TABLE missions ADD CONSTRAINT missions_source_type_check
    CHECK(source_type IN ('user','template','ai','challenge'));
ALTER TABLE missions ADD CONSTRAINT challenge_mission_no_daily_reward CHECK
    (source_type<>'challenge' OR
     (goal_id IS NULL AND goal_step_id IS NULL AND definition_id IS NULL
      AND source_proposal_id IS NULL AND reward_points=0
      AND reward_user_xp=0 AND reward_pet_xp=0));
ALTER TABLE achievement_versions DROP CONSTRAINT achievement_versions_condition_type_check;
ALTER TABLE achievement_versions ADD CONSTRAINT achievement_versions_condition_type_check
    CHECK(condition_type IN ('first_goal_completed','approved_mission_count',
        'category_approved_mission_count','streak_milestone','challenge_completed'));
ALTER TABLE achievement_versions DROP CONSTRAINT achievement_versions_check;
ALTER TABLE achievement_versions ADD CONSTRAINT achievement_versions_check CHECK(
    (condition_type='first_goal_completed' AND target_count=1 AND category_id IS NULL)
    OR (condition_type='approved_mission_count' AND category_id IS NULL)
    OR (condition_type='category_approved_mission_count' AND category_id IS NOT NULL)
    OR (condition_type='streak_milestone' AND target_count IN (7,30,100)
        AND category_id IS NULL AND reward_points=0)
    OR (condition_type='challenge_completed' AND target_count=1 AND category_id IS NULL
        AND reward_points=0 AND reward_user_xp=0 AND reward_pet_xp=0));
ALTER TABLE user_achievements DROP CONSTRAINT user_achievements_source_type_check;
ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_source_type_check
    CHECK(source_type IN ('goal','mission','streak','challenge'));
ALTER TABLE user_achievement_events DROP CONSTRAINT user_achievement_events_source_type_check;
ALTER TABLE user_achievement_events ADD CONSTRAINT user_achievement_events_source_type_check
    CHECK(source_type IN ('goal','mission','streak','challenge'));
ALTER TABLE experience_awards DROP CONSTRAINT experience_awards_source_type_check;
ALTER TABLE experience_awards ADD CONSTRAINT experience_awards_source_type_check
    CHECK(source_type IN ('mission','achievement','streak','challenge'));

CREATE TABLE challenges (
    id uuid PRIMARY KEY,
    origin varchar(8) NOT NULL CHECK(origin IN ('admin','user')),
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_by_admin_id uuid REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    title varchar(200) NOT NULL CHECK(length(btrim(title))>0),
    description text NOT NULL CHECK(length(btrim(description))>0),
    category_id uuid NOT NULL REFERENCES goal_categories(id) ON DELETE RESTRICT,
    difficulty_id uuid NOT NULL REFERENCES difficulty_levels(id) ON DELETE RESTRICT,
    verification_method varchar(30) NOT NULL CHECK(verification_method IN ('camera','sensor')),
    target_value numeric(10,2) CHECK(target_value>0),
    target_unit varchar(20),
    estimated_duration_seconds integer CHECK(estimated_duration_seconds>0),
    start_date date NOT NULL, end_date date NOT NULL,
    required_success_days integer NOT NULL CHECK(required_success_days>0),
    max_participants integer CHECK(max_participants>0),
    publication_status varchar(16) NOT NULL DEFAULT 'draft'
        CHECK(publication_status IN ('draft','review_pending','public','rejected','hidden','cancelled')),
    settlement_status varchar(16) NOT NULL DEFAULT 'not_started'
        CHECK(settlement_status IN ('not_started','draft','confirmed')),
    published_at timestamptz, cancelled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    -- 운동 종류 (mission_definitions.exercise_code와 같은 규칙)
    exercise_code varchar(20)
        CHECK(exercise_code IN ('push_up','burpee','squat','lunge','plank','running')),
    CHECK((origin='admin' AND created_by_admin_id IS NOT NULL AND created_by_user_id IS NULL)
       OR (origin='user' AND created_by_admin_id IS NULL)),
    CHECK((target_value IS NULL)=(target_unit IS NULL)),
    CHECK(target_unit IS NULL OR length(btrim(target_unit))>0),
    CHECK(end_date-start_date+1 IN (7,14,30)),
    CHECK(required_success_days<=end_date-start_date+1),
    CHECK(publication_status<>'public' OR published_at IS NOT NULL),
    CHECK((publication_status='cancelled')=(cancelled_at IS NOT NULL)),
    CONSTRAINT challenges_exercise_method_check
        CHECK(exercise_code IS NULL OR (exercise_code = 'running') = (verification_method = 'sensor'))
);
CREATE INDEX challenges_public_idx ON challenges(publication_status,start_date,category_id);
CREATE FUNCTION guard_challenge() RETURNS trigger LANGUAGE plpgsql AS $$
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
        IF EXISTS(SELECT 1 FROM challenge_participations WHERE challenge_id=OLD.id) AND
           ROW(OLD.origin,OLD.title,OLD.description,OLD.category_id,OLD.difficulty_id,
               OLD.verification_method,OLD.target_value,OLD.target_unit,
               OLD.estimated_duration_seconds,OLD.start_date,OLD.end_date,
               OLD.required_success_days,OLD.max_participants)
           IS DISTINCT FROM ROW(NEW.origin,NEW.title,NEW.description,NEW.category_id,NEW.difficulty_id,
               NEW.verification_method,NEW.target_value,NEW.target_unit,
               NEW.estimated_duration_seconds,NEW.start_date,NEW.end_date,
               NEW.required_success_days,NEW.max_participants) THEN
            RAISE EXCEPTION 'challenge rules locked after first enrollment' USING ERRCODE='23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER challenges_guard BEFORE INSERT OR UPDATE ON challenges
FOR EACH ROW EXECUTE FUNCTION guard_challenge();

CREATE TABLE challenge_reward_packages (
    challenge_id uuid PRIMARY KEY REFERENCES challenges(id) ON DELETE CASCADE,
    points integer NOT NULL DEFAULT 0 CHECK(points>=0),
    user_xp integer NOT NULL DEFAULT 0 CHECK(user_xp>=0),
    pet_xp integer NOT NULL DEFAULT 0 CHECK(pet_xp>=0),
    badge_achievement_version_id uuid UNIQUE REFERENCES achievement_versions(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION guard_challenge_reward_package() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE challenge_origin text; challenge_status text;
BEGIN
    SELECT origin,publication_status INTO challenge_origin,challenge_status
      FROM challenges WHERE id=NEW.challenge_id FOR UPDATE;
    IF challenge_origin='user' AND
       (NEW.points<>0 OR NEW.user_xp<>0 OR NEW.pet_xp<>0 OR NEW.badge_achievement_version_id IS NOT NULL) THEN
        RAISE EXCEPTION 'community challenge cannot grant currency or badges' USING ERRCODE='23514';
    END IF;
    IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM challenge_participations WHERE challenge_id=NEW.challenge_id) THEN
        RAISE EXCEPTION 'challenge reward locked after first enrollment' USING ERRCODE='23514';
    END IF;
    IF NEW.badge_achievement_version_id IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM achievement_versions av WHERE av.id=NEW.badge_achievement_version_id
          AND av.condition_type='challenge_completed' AND av.reward_points=0
          AND av.reward_user_xp=0 AND av.reward_pet_xp=0) THEN
        RAISE EXCEPTION 'challenge badge must be a zero-reward challenge achievement' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER challenge_reward_packages_guard BEFORE INSERT OR UPDATE ON challenge_reward_packages
FOR EACH ROW EXECUTE FUNCTION guard_challenge_reward_package();
CREATE TABLE challenge_publication_reviews (
    id uuid PRIMARY KEY, challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by_admin_id uuid REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    decision varchar(12) NOT NULL CHECK(decision IN ('submitted','approved','rejected','hidden')),
    reason text, created_at timestamptz NOT NULL DEFAULT now(),
    CHECK((decision='submitted' AND reviewed_by_admin_id IS NULL)
       OR (decision<>'submitted' AND reviewed_by_admin_id IS NOT NULL)),
    CHECK(decision NOT IN ('rejected','hidden') OR length(btrim(reason))>0)
);
CREATE TABLE challenge_rule_events (
    id uuid PRIMARY KEY, challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    admin_id uuid REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    event_type varchar(20) NOT NULL CHECK(event_type IN ('published','cancelled','hidden','rescheduled')),
    reason text NOT NULL CHECK(length(btrim(reason))>0),
    occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION scrub_user_challenge_logs() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE challenge_publication_reviews
       SET reason=CASE WHEN decision IN ('rejected','hidden')
                       THEN '탈퇴 회원 관련 기록' ELSE NULL END
     WHERE requested_by_user_id=OLD.id;
    UPDATE challenge_rule_events SET reason='탈퇴 회원 관련 기록'
     WHERE requested_by_user_id=OLD.id;
    RETURN OLD;
END $$;
CREATE TRIGGER users_scrub_challenge_logs BEFORE DELETE ON users
FOR EACH ROW EXECUTE FUNCTION scrub_user_challenge_logs();

CREATE TABLE challenge_participations (
    id uuid PRIMARY KEY, challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status varchar(16) NOT NULL DEFAULT 'enrolled'
        CHECK(status IN ('enrolled','withdrawn','disqualified','completed','failed')),
    joined_at timestamptz NOT NULL DEFAULT now(), withdrawn_at timestamptz,
    completed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(challenge_id,user_id), UNIQUE(id,challenge_id,user_id),
    UNIQUE(id,challenge_id), UNIQUE(id,user_id),
    CHECK((status='withdrawn')=(withdrawn_at IS NOT NULL)),
    CHECK((status='completed')=(completed_at IS NOT NULL))
);
CREATE INDEX challenge_participations_challenge_idx ON challenge_participations(challenge_id,status,joined_at);
CREATE FUNCTION guard_challenge_participation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE start_day date; public_status text; cap integer; active_count integer;
        public_at timestamptz;
BEGIN
    SELECT start_date,publication_status,max_participants,published_at
      INTO start_day,public_status,cap,public_at
      FROM challenges WHERE id=NEW.challenge_id FOR UPDATE;
    IF TG_OP='UPDATE' THEN
        IF ROW(OLD.challenge_id,OLD.user_id) IS DISTINCT FROM ROW(NEW.challenge_id,NEW.user_id) THEN
            RAISE EXCEPTION 'participation identity cannot change' USING ERRCODE='23514';
        END IF;
        IF OLD.status='withdrawn' AND NEW.status='enrolled' AND
           (OLD.withdrawn_at >= (start_day::timestamp AT TIME ZONE 'Asia/Seoul')
            OR NEW.joined_at >= (start_day::timestamp AT TIME ZONE 'Asia/Seoul')) THEN
            RAISE EXCEPTION 'cannot rejoin after challenge starts' USING ERRCODE='23514';
        END IF;
        IF OLD.status IN ('disqualified','completed','failed') AND NEW.status='enrolled' THEN
            RAISE EXCEPTION 'final participation cannot rejoin' USING ERRCODE='23514';
        END IF;
    END IF;
    IF NEW.status='enrolled' AND (TG_OP='INSERT' OR OLD.status<>'enrolled') THEN
        IF public_status<>'public' OR NEW.joined_at<public_at OR NEW.joined_at>now()
           OR NEW.joined_at >= (start_day::timestamp AT TIME ZONE 'Asia/Seoul')
           OR (now() AT TIME ZONE 'Asia/Seoul')::date>=start_day
           OR NOT EXISTS(SELECT 1 FROM challenge_reward_packages WHERE challenge_id=NEW.challenge_id)
           OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND status='active') THEN
            RAISE EXCEPTION 'challenge is not open for enrollment' USING ERRCODE='23514';
        END IF;
        SELECT count(*) INTO active_count FROM challenge_participations
         WHERE challenge_id=NEW.challenge_id AND status='enrolled' AND id<>NEW.id;
        IF cap IS NOT NULL AND active_count>=cap THEN
            RAISE EXCEPTION 'challenge is full' USING ERRCODE='23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER challenge_participations_guard BEFORE INSERT OR UPDATE ON challenge_participations
FOR EACH ROW EXECUTE FUNCTION guard_challenge_participation();

CREATE TABLE challenge_daily_missions (
    id uuid PRIMARY KEY, participation_id uuid NOT NULL,
    challenge_id uuid NOT NULL, user_id uuid NOT NULL,
    challenge_date date NOT NULL, mission_id uuid NOT NULL UNIQUE,
    status varchar(12) NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','success','failed','excluded','cancelled')),
    qualifying_record_id uuid, qualifying_result_id uuid,
    judged_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(participation_id,challenge_date), UNIQUE(id,participation_id),
    FOREIGN KEY(participation_id,challenge_id,user_id)
        REFERENCES challenge_participations(id,challenge_id,user_id) ON DELETE CASCADE,
    FOREIGN KEY(mission_id,user_id) REFERENCES missions(id,user_id) ON DELETE CASCADE,
    FOREIGN KEY(qualifying_record_id,mission_id)
        REFERENCES mission_records(id,mission_id) ON DELETE CASCADE,
    FOREIGN KEY(qualifying_result_id,qualifying_record_id)
        REFERENCES verification_results(id,record_id) ON DELETE CASCADE,
    CHECK((status='success')=(qualifying_record_id IS NOT NULL AND qualifying_result_id IS NOT NULL))
);
CREATE INDEX challenge_daily_missions_score_idx ON challenge_daily_missions(challenge_id,status,challenge_date);
CREATE FUNCTION guard_challenge_daily_mission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE start_day date; end_day date; mission_row missions%ROWTYPE;
        challenge_row challenges%ROWTYPE;
        participation_status text;
        evidence_submitted timestamptz; evidence_decision text; evidence_current boolean;
BEGIN
    SELECT * INTO challenge_row FROM challenges WHERE id=NEW.challenge_id;
    start_day:=challenge_row.start_date;
    end_day:=challenge_row.end_date;
    SELECT status INTO participation_status FROM challenge_participations WHERE id=NEW.participation_id;
    IF TG_OP='INSERT' AND participation_status<>'enrolled' THEN
        RAISE EXCEPTION 'daily missions require enrolled participant' USING ERRCODE='23514';
    END IF;
    SELECT * INTO mission_row FROM missions WHERE id=NEW.mission_id;
    IF NEW.challenge_date<start_day OR NEW.challenge_date>end_day
       OR mission_row.source_type IS DISTINCT FROM 'challenge'
       OR mission_row.scheduled_date IS DISTINCT FROM NEW.challenge_date
       OR ROW(mission_row.category_id,mission_row.difficulty_id,mission_row.verification_method,
              mission_row.target_value,mission_row.target_unit,mission_row.estimated_duration_seconds)
          IS DISTINCT FROM ROW(challenge_row.category_id,challenge_row.difficulty_id,
              challenge_row.verification_method,challenge_row.target_value,
              challenge_row.target_unit,challenge_row.estimated_duration_seconds)
       OR mission_row.reward_points<>0 OR mission_row.reward_user_xp<>0 OR mission_row.reward_pet_xp<>0 THEN
        RAISE EXCEPTION 'daily challenge mission must match challenge and carry no daily reward' USING ERRCODE='23514';
    END IF;
    IF NEW.status='success' THEN
        SELECT mr.submitted_at,vr.decision,vr.is_current
          INTO evidence_submitted,evidence_decision,evidence_current
          FROM mission_records mr JOIN verification_results vr ON vr.record_id=mr.id
         WHERE mr.id=NEW.qualifying_record_id AND vr.id=NEW.qualifying_result_id;
        IF evidence_submitted IS NULL OR
           evidence_submitted >= ((NEW.challenge_date+1)::timestamp AT TIME ZONE 'Asia/Seoul')
           OR (evidence_submitted AT TIME ZONE 'Asia/Seoul')::date<>NEW.challenge_date
           OR evidence_decision<>'approved' OR NOT evidence_current THEN
            RAISE EXCEPTION 'challenge success needs timely current approval' USING ERRCODE='23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER challenge_daily_missions_guard BEFORE INSERT OR UPDATE ON challenge_daily_missions
FOR EACH ROW EXECUTE FUNCTION guard_challenge_daily_mission();
CREATE TABLE challenge_moderation_actions (
    id uuid PRIMARY KEY, participation_id uuid NOT NULL REFERENCES challenge_participations(id) ON DELETE CASCADE,
    daily_mission_id uuid, admin_id uuid NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    action varchar(16) NOT NULL CHECK(action IN ('disqualify','restore','exclude_day','restore_day')),
    reason text NOT NULL CHECK(length(btrim(reason))>0),
    evidence_result_id uuid REFERENCES verification_results(id) ON DELETE SET NULL,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY(daily_mission_id,participation_id)
        REFERENCES challenge_daily_missions(id,participation_id) ON DELETE CASCADE,
    CHECK((action IN ('exclude_day','restore_day'))=(daily_mission_id IS NOT NULL))
);

CREATE TABLE challenge_score_snapshots (
    challenge_id uuid NOT NULL, participation_id uuid NOT NULL,
    successful_days integer NOT NULL CHECK(successful_days>=0),
    score integer GENERATED ALWAYS AS (successful_days*100) STORED,
    last_qualifying_submitted_at timestamptz,
    calculated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(challenge_id,participation_id),
    FOREIGN KEY(participation_id,challenge_id)
        REFERENCES challenge_participations(id,challenge_id) ON DELETE CASCADE,
    CHECK((successful_days=0)=(last_qualifying_submitted_at IS NULL))
);
-- 동점: 마지막 성공 제출 시각 → 신청 시각 → 참가 ID (승인 시각은 검수 지연 때문에 제외)
-- 0점은 제출 시각이 없어 NULLS LAST
CREATE VIEW challenge_live_rankings AS
SELECT cp.challenge_id, cp.id AS participation_id, cp.user_id,
       pf.nickname AS display_name,
       count(d.id) FILTER(WHERE d.status='success')::integer AS successful_days,
       (count(d.id) FILTER(WHERE d.status='success')*100)::integer AS score,
       last_success.submitted_at AS last_qualifying_submitted_at,
       row_number() OVER (
         PARTITION BY cp.challenge_id
         ORDER BY count(d.id) FILTER(WHERE d.status='success') DESC,
                  last_success.submitted_at ASC NULLS LAST,
                  cp.joined_at ASC, cp.id ASC
       ) AS rank_no
  FROM challenge_participations cp
  JOIN profiles pf ON pf.user_id=cp.user_id
  LEFT JOIN challenge_daily_missions d ON d.participation_id=cp.id
  LEFT JOIN LATERAL (
    SELECT mr.submitted_at FROM challenge_daily_missions d2
    JOIN mission_records mr ON mr.id=d2.qualifying_record_id
    WHERE d2.participation_id=cp.id AND d2.status='success'
    ORDER BY d2.challenge_date DESC LIMIT 1
  ) last_success ON true
 WHERE cp.status NOT IN ('withdrawn','disqualified')
 GROUP BY cp.challenge_id,cp.id,cp.user_id,pf.nickname,
          last_success.submitted_at;
CREATE TABLE challenge_settlement_runs (
    id uuid PRIMARY KEY, challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE RESTRICT,
    run_no integer NOT NULL CHECK(run_no>0),
    status varchar(12) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','confirmed','superseded')),
    based_on_at timestamptz NOT NULL DEFAULT now(),
    confirmed_by_admin_id uuid REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    confirmed_at timestamptz, reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(challenge_id,run_no), UNIQUE(id,challenge_id),
    CHECK((status='draft' AND confirmed_at IS NULL AND confirmed_by_admin_id IS NULL)
       OR (status<>'draft' AND confirmed_at IS NOT NULL AND confirmed_by_admin_id IS NOT NULL
           AND reason IS NOT NULL AND length(btrim(reason))>0))
);
-- 챌린지당 확정 정산은 하나, 정정은 새 버전 확정 시 이전 버전을 superseded로
CREATE UNIQUE INDEX challenge_one_current_settlement_uq ON challenge_settlement_runs(challenge_id)
 WHERE status='confirmed';
CREATE TABLE challenge_settlement_entries (
    run_id uuid NOT NULL, challenge_id uuid NOT NULL, participation_id uuid NOT NULL,
    successful_days integer NOT NULL CHECK(successful_days>=0),
    score integer GENERATED ALWAYS AS (successful_days*100) STORED,
    last_qualifying_submitted_at timestamptz,
    rank_no integer CHECK(rank_no>0),
    outcome varchar(16) NOT NULL CHECK(outcome IN ('completed','failed','withdrawn','disqualified')),
    exclusion_reason text,
    promised_points integer NOT NULL DEFAULT 0 CHECK(promised_points>=0),
    paid_points integer NOT NULL DEFAULT 0 CHECK(paid_points>=0),
    user_xp integer NOT NULL DEFAULT 0 CHECK(user_xp>=0),
    pet_xp integer NOT NULL DEFAULT 0 CHECK(pet_xp>=0),
    payment_status varchar(12) NOT NULL DEFAULT 'pending'
        CHECK(payment_status IN ('pending','paid','failed','none')),
    PRIMARY KEY(run_id,participation_id),
    FOREIGN KEY(run_id,challenge_id) REFERENCES challenge_settlement_runs(id,challenge_id) ON DELETE CASCADE,
    FOREIGN KEY(participation_id,challenge_id) REFERENCES challenge_participations(id,challenge_id) ON DELETE CASCADE,
    CHECK(paid_points<=promised_points),
    CHECK((successful_days=0)=(last_qualifying_submitted_at IS NULL)),
    CHECK((outcome IN ('withdrawn','disqualified'))=(rank_no IS NULL)),
    CHECK(outcome='completed' OR (promised_points=0 AND paid_points=0 AND user_xp=0 AND pet_xp=0))
);
CREATE UNIQUE INDEX challenge_settlement_rank_uq ON challenge_settlement_entries(run_id,rank_no)
 WHERE rank_no IS NOT NULL;
CREATE FUNCTION guard_challenge_settlement_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE run_status text; required_days integer; package_points integer;
        package_user_xp integer; package_pet_xp integer;
        actual_days integer; last_submission timestamptz;
BEGIN
    SELECT status INTO run_status FROM challenge_settlement_runs WHERE id=NEW.run_id;
    IF TG_OP='UPDATE' AND run_status<>'draft' AND
       ROW(OLD.run_id,OLD.challenge_id,OLD.participation_id,OLD.successful_days,
           OLD.last_qualifying_submitted_at,OLD.rank_no,OLD.outcome,
           OLD.exclusion_reason,OLD.promised_points,OLD.user_xp,OLD.pet_xp)
       IS DISTINCT FROM ROW(NEW.run_id,NEW.challenge_id,NEW.participation_id,NEW.successful_days,
           NEW.last_qualifying_submitted_at,NEW.rank_no,NEW.outcome,
           NEW.exclusion_reason,NEW.promised_points,NEW.user_xp,NEW.pet_xp) THEN
        RAISE EXCEPTION 'confirmed settlement result is immutable' USING ERRCODE='23514';
    END IF;
    IF TG_OP='INSERT' AND run_status<>'draft' THEN
        RAISE EXCEPTION 'settlement entries must be prepared in a draft' USING ERRCODE='23514';
    END IF;
    SELECT c.required_success_days,p.points,p.user_xp,p.pet_xp
      INTO required_days,package_points,package_user_xp,package_pet_xp
      FROM challenges c JOIN challenge_reward_packages p ON p.challenge_id=c.id
     WHERE c.id=NEW.challenge_id;
    SELECT count(*) INTO actual_days FROM challenge_daily_missions
     WHERE participation_id=NEW.participation_id AND status='success';
    SELECT mr.submitted_at INTO last_submission
      FROM challenge_daily_missions d
      JOIN mission_records mr ON mr.id=d.qualifying_record_id
     WHERE d.participation_id=NEW.participation_id AND d.status='success'
     ORDER BY d.challenge_date DESC LIMIT 1;
    IF actual_days<>NEW.successful_days OR
       last_submission IS DISTINCT FROM NEW.last_qualifying_submitted_at THEN
        RAISE EXCEPTION 'settlement score must match current daily evidence' USING ERRCODE='23514';
    END IF;
    IF NEW.outcome='completed' AND
       (NEW.successful_days<required_days OR NEW.promised_points<>package_points
        OR NEW.user_xp<>package_user_xp OR NEW.pet_xp<>package_pet_xp) THEN
        RAISE EXCEPTION 'completed result must match challenge threshold and reward package' USING ERRCODE='23514';
    END IF;
    IF NEW.outcome='failed' AND NEW.successful_days>=required_days THEN
        RAISE EXCEPTION 'qualifying participant cannot be marked failed' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER challenge_settlement_entries_guard BEFORE INSERT OR UPDATE ON challenge_settlement_entries
FOR EACH ROW EXECUTE FUNCTION guard_challenge_settlement_entry();
CREATE FUNCTION guard_challenge_settlement_run() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE end_day date;
BEGIN
    IF TG_OP='UPDATE' THEN
        IF OLD.status='superseded' OR (OLD.status='confirmed' AND NEW.status<>'superseded') THEN
            RAISE EXCEPTION 'settlement status cannot go backward' USING ERRCODE='23514';
        END IF;
        IF ROW(OLD.challenge_id,OLD.run_no,OLD.based_on_at,OLD.confirmed_by_admin_id,
               OLD.confirmed_at,OLD.reason)
           IS DISTINCT FROM ROW(NEW.challenge_id,NEW.run_no,NEW.based_on_at,NEW.confirmed_by_admin_id,
               NEW.confirmed_at,NEW.reason) AND OLD.status<>'draft' THEN
            RAISE EXCEPTION 'confirmed settlement header is immutable' USING ERRCODE='23514';
        END IF;
    END IF;
    IF NEW.status='confirmed' AND (TG_OP='INSERT' OR OLD.status<>'confirmed') THEN
        SELECT end_date INTO end_day FROM challenges WHERE id=NEW.challenge_id FOR UPDATE;
        IF (now() AT TIME ZONE 'Asia/Seoul')::date<=end_day OR
           EXISTS(SELECT 1 FROM challenge_daily_missions d
                   WHERE d.challenge_id=NEW.challenge_id AND d.status='pending') OR
           EXISTS(SELECT 1 FROM challenge_daily_missions d
                  JOIN mission_records mr ON mr.mission_id=d.mission_id
                  WHERE d.challenge_id=NEW.challenge_id
                    AND mr.submitted_at<((d.challenge_date+1)::timestamp AT TIME ZONE 'Asia/Seoul')
                    AND (mr.status IN ('submitted','review_required')
                         OR EXISTS(SELECT 1 FROM verification_appeals va
                                   WHERE va.record_id=mr.id AND va.status='open'))) OR
           EXISTS(SELECT 1 FROM challenge_participations p
                  WHERE p.challenge_id=NEW.challenge_id AND
                    (SELECT count(*) FROM challenge_daily_missions d
                      WHERE d.participation_id=p.id)<>
                    (SELECT end_date-start_date+1 FROM challenges c WHERE c.id=NEW.challenge_id)) OR
           EXISTS(SELECT 1 FROM challenge_participations p
                   WHERE p.challenge_id=NEW.challenge_id AND NOT EXISTS(
                     SELECT 1 FROM challenge_settlement_entries e
                     WHERE e.run_id=NEW.id AND e.participation_id=p.id)) THEN
            RAISE EXCEPTION 'settlement cannot confirm before end or while results are pending'
                USING ERRCODE='23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER challenge_settlement_runs_guard BEFORE INSERT OR UPDATE ON challenge_settlement_runs
FOR EACH ROW EXECUTE FUNCTION guard_challenge_settlement_run();
CREATE TABLE challenge_final_rankings (
    id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES challenge_settlement_runs(id) ON DELETE RESTRICT,
    participation_id uuid REFERENCES challenge_participations(id) ON DELETE SET NULL,
    rank_no integer NOT NULL CHECK(rank_no>0), score integer NOT NULL CHECK(score>=0),
    display_name varchar(32) NOT NULL CHECK(length(btrim(display_name))>0),
    anonymized_at timestamptz,
    UNIQUE(run_id,rank_no), UNIQUE(run_id,participation_id),
    CHECK((participation_id IS NULL)=(anonymized_at IS NOT NULL))
);
CREATE FUNCTION guard_challenge_final_ranking() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry_rank integer; entry_score integer; profile_name text;
BEGIN
    IF TG_OP='UPDATE' THEN
        IF ROW(OLD.run_id,OLD.rank_no,OLD.score)
           IS DISTINCT FROM ROW(NEW.run_id,NEW.rank_no,NEW.score) OR
           (OLD.participation_id IS NULL AND NEW.participation_id IS NOT NULL) THEN
            RAISE EXCEPTION 'final ranking history is immutable' USING ERRCODE='23514';
        END IF;
        IF OLD.participation_id IS NOT NULL AND NEW.participation_id IS NULL AND
           (NEW.display_name<>'탈퇴 회원' OR NEW.anonymized_at IS NULL) THEN
            RAISE EXCEPTION 'deleted participant must be anonymized' USING ERRCODE='23514';
        END IF;
        RETURN NEW;
    END IF;
    SELECT e.rank_no,e.score,pf.nickname INTO entry_rank,entry_score,profile_name
      FROM challenge_settlement_entries e
      JOIN challenge_participations cp ON cp.id=e.participation_id
      JOIN profiles pf ON pf.user_id=cp.user_id
     WHERE e.run_id=NEW.run_id AND e.participation_id=NEW.participation_id;
    IF entry_rank IS DISTINCT FROM NEW.rank_no OR entry_score IS DISTINCT FROM NEW.score OR
       profile_name IS DISTINCT FROM NEW.display_name THEN
        RAISE EXCEPTION 'final ranking must match settlement and current nickname' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER challenge_final_rankings_guard BEFORE INSERT OR UPDATE ON challenge_final_rankings
FOR EACH ROW EXECUTE FUNCTION guard_challenge_final_ranking();
CREATE FUNCTION anonymize_challenge_ranking() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE challenge_final_rankings SET participation_id=NULL,
           display_name='탈퇴 회원',anonymized_at=now()
     WHERE participation_id=OLD.id;
    RETURN OLD;
END $$;
CREATE TRIGGER challenge_participation_anonymize BEFORE DELETE ON challenge_participations
FOR EACH ROW EXECUTE FUNCTION anonymize_challenge_ranking();

CREATE TABLE challenge_reward_grants (
    id uuid PRIMARY KEY, participation_id uuid NOT NULL UNIQUE,
    challenge_id uuid NOT NULL, user_id uuid NOT NULL,
    first_settlement_run_id uuid NOT NULL,
    promised_points integer NOT NULL CHECK(promised_points>=0),
    paid_points integer NOT NULL CHECK(paid_points>=0),
    user_xp integer NOT NULL CHECK(user_xp>=0),
    pet_xp integer NOT NULL CHECK(pet_xp>=0),
    recipient_pet_id uuid, badge_grant_id uuid,
    status varchar(12) NOT NULL CHECK(status IN ('active','revoked')),
    granted_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(id,user_id),
    FOREIGN KEY(participation_id,challenge_id,user_id)
        REFERENCES challenge_participations(id,challenge_id,user_id) ON DELETE CASCADE,
    FOREIGN KEY(first_settlement_run_id,challenge_id)
        REFERENCES challenge_settlement_runs(id,challenge_id) ON DELETE RESTRICT,
    FOREIGN KEY(recipient_pet_id,user_id) REFERENCES user_pets(id,user_id) ON DELETE RESTRICT,
    FOREIGN KEY(badge_grant_id,user_id) REFERENCES user_achievements(id,user_id) ON DELETE RESTRICT,
    CHECK(paid_points<=promised_points)
);
CREATE FUNCTION guard_challenge_reward_grant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pkg challenge_reward_packages%ROWTYPE; run_status text;
        entry_paid integer; badge_version uuid;
BEGIN
    SELECT * INTO pkg FROM challenge_reward_packages WHERE challenge_id=NEW.challenge_id;
    SELECT status INTO run_status FROM challenge_settlement_runs WHERE id=NEW.first_settlement_run_id;
    IF TG_OP='INSERT' THEN
        SELECT paid_points INTO entry_paid FROM challenge_settlement_entries
         WHERE run_id=NEW.first_settlement_run_id AND participation_id=NEW.participation_id;
        IF run_status<>'confirmed' OR pkg.points IS DISTINCT FROM NEW.promised_points
           OR pkg.user_xp IS DISTINCT FROM NEW.user_xp OR pkg.pet_xp IS DISTINCT FROM NEW.pet_xp
           OR entry_paid IS DISTINCT FROM NEW.paid_points
           OR NOT EXISTS(SELECT 1 FROM challenge_settlement_entries e
              WHERE e.run_id=NEW.first_settlement_run_id AND e.participation_id=NEW.participation_id
                AND e.outcome='completed') THEN
            RAISE EXCEPTION 'reward requires confirmed completed settlement' USING ERRCODE='23514';
        END IF;
    ELSE
        IF ROW(OLD.participation_id,OLD.challenge_id,OLD.user_id,OLD.first_settlement_run_id,
               OLD.promised_points,OLD.paid_points,OLD.user_xp,OLD.pet_xp,OLD.recipient_pet_id)
           IS DISTINCT FROM ROW(NEW.participation_id,NEW.challenge_id,NEW.user_id,NEW.first_settlement_run_id,
               NEW.promised_points,NEW.paid_points,NEW.user_xp,NEW.pet_xp,NEW.recipient_pet_id) THEN
            RAISE EXCEPTION 'reward grant identity and amounts are immutable' USING ERRCODE='23514';
        END IF;
    END IF;
    IF NEW.badge_grant_id IS NOT NULL THEN
        SELECT achievement_version_id INTO badge_version FROM user_achievements
         WHERE id=NEW.badge_grant_id AND user_id=NEW.user_id;
        IF badge_version IS DISTINCT FROM pkg.badge_achievement_version_id THEN
            RAISE EXCEPTION 'challenge badge grant must match reward package' USING ERRCODE='23514';
        END IF;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER challenge_reward_grants_guard BEFORE INSERT OR UPDATE ON challenge_reward_grants
FOR EACH ROW EXECUTE FUNCTION guard_challenge_reward_grant();

-- 004의 미션 회수 청구를 챌린지 지급·스트릭 마일스톤·업적 지급도 가리키도록 확장한다
-- (스트릭 005, 업적 006, 챌린지가 모두 만들어진 이 자리에서 한 번에)
ALTER TABLE point_recovery_claims ALTER COLUMN mission_id DROP NOT NULL;
ALTER TABLE point_recovery_claims
    ADD COLUMN challenge_reward_grant_id uuid,
    ADD COLUMN streak_milestone_award_id uuid,
    ADD COLUMN user_achievement_id uuid,
    ADD CONSTRAINT point_recovery_challenge_grant_owner_fk
        FOREIGN KEY(challenge_reward_grant_id,user_id)
        REFERENCES challenge_reward_grants(id,user_id) ON DELETE CASCADE,
    ADD CONSTRAINT point_recovery_streak_award_owner_fk
        FOREIGN KEY (streak_milestone_award_id, user_id)
        REFERENCES streak_milestone_awards(id, user_id) ON DELETE CASCADE,
    ADD CONSTRAINT point_recovery_achievement_owner_fk
        FOREIGN KEY (user_achievement_id, user_id)
        REFERENCES user_achievements(id, user_id) ON DELETE CASCADE;

-- 소스는 미션, 챌린지 지급, 스트릭 마일스톤, 업적 중 정확히 하나
ALTER TABLE point_recovery_claims
    ADD CONSTRAINT point_recovery_exactly_one_source CHECK (
        num_nonnulls(mission_id, challenge_reward_grant_id,
                     streak_milestone_award_id, user_achievement_id) = 1);

-- 같은 지급에 대한 유효(취소되지 않은) 청구는 동시에 하나만, 복구로 취소된 뒤의 재번복은 새 청구
CREATE UNIQUE INDEX point_recovery_one_open_challenge_claim_uq
    ON point_recovery_claims (challenge_reward_grant_id)
    WHERE challenge_reward_grant_id IS NOT NULL AND NOT is_cancelled;
CREATE UNIQUE INDEX point_recovery_one_open_streak_claim_uq
    ON point_recovery_claims (streak_milestone_award_id)
    WHERE streak_milestone_award_id IS NOT NULL AND NOT is_cancelled;
CREATE UNIQUE INDEX point_recovery_one_open_achievement_claim_uq
    ON point_recovery_claims (user_achievement_id)
    WHERE user_achievement_id IS NOT NULL AND NOT is_cancelled;

-- 지급 행 삭제(탈퇴 연쇄)가 취소된 청구까지 찾을 수 있게 전체 행 인덱스
CREATE INDEX point_recovery_claims_challenge_grant_idx
    ON point_recovery_claims (challenge_reward_grant_id)
    WHERE challenge_reward_grant_id IS NOT NULL;
CREATE INDEX point_recovery_claims_streak_award_idx
    ON point_recovery_claims (streak_milestone_award_id)
    WHERE streak_milestone_award_id IS NOT NULL;
CREATE INDEX point_recovery_claims_achievement_idx
    ON point_recovery_claims (user_achievement_id)
    WHERE user_achievement_id IS NOT NULL;

CREATE FUNCTION guard_challenge_point_recovery_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.challenge_reward_grant_id IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM point_transactions pt
         WHERE pt.id=NEW.original_award_transaction_id AND pt.user_id=NEW.user_id
           AND pt.source_type='challenge' AND pt.source_id=NEW.challenge_reward_grant_id
           AND pt.kind='auto_award') THEN
        RAISE EXCEPTION 'challenge recovery must reference its original point award'
            USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER point_recovery_challenge_source BEFORE INSERT ON point_recovery_claims
FOR EACH ROW EXECUTE FUNCTION guard_challenge_point_recovery_claim();

-- 스트릭·업적 청구는 그 지급의 원 적립 거래를 가리켜야 함(챌린지는 위 트리거)
CREATE FUNCTION guard_point_recovery_claim_source() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    expected_source_type varchar(32);
    expected_source_id uuid;
BEGIN
    IF NEW.streak_milestone_award_id IS NOT NULL THEN
        expected_source_type := 'streak';
        expected_source_id := NEW.streak_milestone_award_id;
    ELSIF NEW.user_achievement_id IS NOT NULL THEN
        expected_source_type := 'achievement';
        expected_source_id := NEW.user_achievement_id;
    ELSE
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM point_transactions pt
         WHERE pt.id = NEW.original_award_transaction_id
           AND pt.user_id = NEW.user_id
           AND pt.source_type = expected_source_type
           AND pt.source_id = expected_source_id
           AND pt.kind = 'auto_award'
    ) THEN
        RAISE EXCEPTION 'recovery claim must reference its original point award'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER point_recovery_claims_streak_achievement_source
BEFORE INSERT ON point_recovery_claims
FOR EACH ROW EXECUTE FUNCTION guard_point_recovery_claim_source();

-- 업적 paid_points는 지급 행을 만든 뒤 실제 지급액으로 보정하므로(006의 lock 함수),
-- 활성 지급이고 회수 청구가 없을 때(지급 직후)만 바꿀 수 있다
CREATE FUNCTION guard_user_achievement_paid_points() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.paid_points IS DISTINCT FROM OLD.paid_points AND (
        OLD.status <> 'active'
        OR EXISTS (SELECT 1 FROM point_recovery_claims c
                    WHERE c.user_achievement_id = OLD.id)
    ) THEN
        RAISE EXCEPTION 'achievement paid points are fixed after revoke or recovery claim'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER user_achievements_paid_points_guard
BEFORE UPDATE ON user_achievements
FOR EACH ROW EXECUTE FUNCTION guard_user_achievement_paid_points();


-- 다형 소스 검증 함수를 챌린지까지 확장한다
CREATE OR REPLACE FUNCTION guard_user_achievement() RETURNS trigger
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
    ELSIF version_condition = 'challenge_completed' THEN
        IF NEW.source_type <> 'challenge' OR NOT EXISTS (
            SELECT 1 FROM challenge_reward_grants crg
            JOIN challenge_reward_packages crp ON crp.challenge_id=crg.challenge_id
            WHERE crg.id=NEW.source_id AND crg.user_id=NEW.user_id
              AND crg.status='active'
              AND crp.badge_achievement_version_id=NEW.achievement_version_id
        ) THEN
            RAISE EXCEPTION 'challenge badge requires active matching reward grant'
                USING ERRCODE = '23514';
        END IF;
    ELSE
        RAISE EXCEPTION 'unsupported achievement condition'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION guard_user_achievement_event() RETURNS trigger
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
    ELSIF NEW.source_type = 'streak' THEN
        SELECT EXISTS (SELECT 1 FROM streak_milestone_awards
                       WHERE id = NEW.source_id AND user_id = NEW.user_id)
          INTO source_owned;
    ELSE
        SELECT EXISTS (SELECT 1 FROM challenge_reward_grants
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
-- 대표 펫이 없어 보류된 보상(recipient_pet_id NULL)은 나중에 대표 펫을 고를 때 한 번만 배정할 수 있고,
-- 배정된 뒤에는 불변이다. 보류 배정에는 버프가 없으므로 bonus_basis_points는 0이어야 한다.
-- (007의 가드를 챌린지 분기와 함께 교체, UPDATE 분기만 007과 다름)
CREATE OR REPLACE FUNCTION guard_experience_award() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_user_xp integer; expected_pet_xp integer;
        source_status text; source_user uuid; snapshot_pet uuid;
        snapshot_stage smallint; snapshot_bonus integer;
        snapshot_species_version uuid;
BEGIN
    IF TG_OP='UPDATE' THEN
        IF ROW(OLD.user_id,OLD.source_type,OLD.source_id,OLD.base_user_xp,OLD.base_pet_xp,OLD.bonus_pet_xp)
           IS DISTINCT FROM ROW(NEW.user_id,NEW.source_type,NEW.source_id,NEW.base_user_xp,NEW.base_pet_xp,NEW.bonus_pet_xp)
        THEN
            RAISE EXCEPTION 'XP award source and amount are fixed' USING ERRCODE='23514';
        END IF;
        IF OLD.recipient_pet_id IS NOT NULL THEN
            IF ROW(OLD.recipient_pet_id,OLD.pet_species_version_id,OLD.pet_stage_no,OLD.bonus_basis_points)
               IS DISTINCT FROM ROW(NEW.recipient_pet_id,NEW.pet_species_version_id,NEW.pet_stage_no,NEW.bonus_basis_points)
            THEN
                RAISE EXCEPTION 'XP award recipient is fixed once assigned' USING ERRCODE='23514';
            END IF;
        ELSIF NEW.recipient_pet_id IS NOT NULL AND NEW.bonus_basis_points<>0 THEN
            RAISE EXCEPTION 'pending XP assignment cannot carry a buff' USING ERRCODE='23514';
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
    ELSIF NEW.source_type='streak' THEN
        SELECT sma.user_id,sma.status,sp.user_xp,sp.pet_xp
          INTO source_user,source_status,expected_user_xp,expected_pet_xp
          FROM streak_milestone_awards sma
          JOIN streak_milestone_policy_versions sp ON sp.id=sma.policy_version_id
         WHERE sma.id=NEW.source_id;
    ELSE
        SELECT crg.user_id,crg.status,crg.user_xp,crg.pet_xp
          INTO source_user,source_status,expected_user_xp,expected_pet_xp
          FROM challenge_reward_grants crg WHERE crg.id=NEW.source_id;
        IF NEW.recipient_pet_id IS DISTINCT FROM
             (SELECT recipient_pet_id FROM challenge_reward_grants WHERE id=NEW.source_id) THEN
            RAISE EXCEPTION 'challenge XP must retain settlement pet recipient' USING ERRCODE='23514';
        END IF;
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

CREATE FUNCTION reject_challenge_streak_day() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.qualifying_mission_id IS NOT NULL AND EXISTS(
        SELECT 1 FROM missions WHERE id=NEW.qualifying_mission_id AND source_type='challenge') THEN
        RAISE EXCEPTION 'challenge daily missions do not count toward ordinary streak'
            USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER streak_days_reject_challenge BEFORE INSERT OR UPDATE ON streak_days
FOR EACH ROW EXECUTE FUNCTION reject_challenge_streak_day();

CREATE FUNCTION guard_challenge_point_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.source_type='challenge' AND NOT EXISTS(
        SELECT 1 FROM challenge_reward_grants
         WHERE id=NEW.source_id AND user_id=NEW.user_id) THEN
        RAISE EXCEPTION 'challenge point source must belong to user' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER point_transactions_challenge_source BEFORE INSERT ON point_transactions
FOR EACH ROW EXECUTE FUNCTION guard_challenge_point_source();

-- users 참조 FK 중 인덱스가 없던 곳, 없으면 탈퇴 때 전체 스캔
CREATE INDEX challenge_participations_user_idx ON challenge_participations (user_id);
CREATE INDEX challenge_publication_reviews_requester_idx
    ON challenge_publication_reviews (requested_by_user_id)
    WHERE requested_by_user_id IS NOT NULL;
CREATE INDEX challenge_rule_events_requester_idx
    ON challenge_rule_events (requested_by_user_id)
    WHERE requested_by_user_id IS NOT NULL;
CREATE INDEX challenges_creator_idx
    ON challenges (created_by_user_id) WHERE created_by_user_id IS NOT NULL;

-- 부모 행(챌린지·참여·일별 미션·판정)이 연쇄로 지워질 때 자식 테이블 전체 스캔 방지
CREATE INDEX challenge_publication_reviews_challenge_idx
    ON challenge_publication_reviews (challenge_id);
CREATE INDEX challenge_rule_events_challenge_idx
    ON challenge_rule_events (challenge_id);
CREATE INDEX challenge_daily_missions_qualifying_result_idx
    ON challenge_daily_missions (qualifying_result_id)
    WHERE qualifying_result_id IS NOT NULL;
CREATE INDEX challenge_moderation_actions_participation_idx
    ON challenge_moderation_actions (participation_id);
CREATE INDEX challenge_moderation_actions_daily_mission_idx
    ON challenge_moderation_actions (daily_mission_id)
    WHERE daily_mission_id IS NOT NULL;
CREATE INDEX challenge_moderation_actions_evidence_idx
    ON challenge_moderation_actions (evidence_result_id)
    WHERE evidence_result_id IS NOT NULL;
CREATE INDEX challenge_settlement_entries_participation_idx
    ON challenge_settlement_entries (participation_id, challenge_id);
CREATE INDEX challenge_final_rankings_participation_idx
    ON challenge_final_rankings (participation_id)
    WHERE participation_id IS NOT NULL;

-- 챌린지 일별 결과 확정 작업: status = 'pending'이고 날짜가 지난 행만 찾음
CREATE INDEX challenge_daily_missions_pending_idx
    ON challenge_daily_missions (challenge_date)
    WHERE status = 'pending';

-- 스트릭 날짜 확정 작업: 지난 날짜의 취소·챌린지 외 미션만 찾음
CREATE INDEX missions_streak_scan_idx
    ON missions (scheduled_date)
    WHERE status <> 'cancelled' AND source_type <> 'challenge';

COMMIT;
