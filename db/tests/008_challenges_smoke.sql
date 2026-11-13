-- smoke 008, 샘플 데이터는 롤백
BEGIN;
INSERT INTO users(id) VALUES
 ('00000801'),
 ('00000813');
INSERT INTO profiles(user_id,nickname) VALUES
 ('00000801','Runner08'),
 ('00000813','RunnerB08');
INSERT INTO admin_accounts(id,login_id,email,password_hash) VALUES
 ('00000802','owner08','owner08@example.com','hash');
INSERT INTO goal_categories(id,code,name,display_order) VALUES
 ('00000803','fitness08','운동08',1);
INSERT INTO difficulty_levels(id,code,name,display_order) VALUES
 ('00000804','basic08','기본08',1);
INSERT INTO challenges
 (id,origin,created_by_admin_id,title,description,category_id,difficulty_id,
  verification_method,start_date,end_date,required_success_days,
  publication_status,published_at)
VALUES
 ('00000805','admin',
  '00000802','7일 운동','매일 운동하기',
  '00000803',
  '00000804','sensor',
  ((now() AT TIME ZONE 'Asia/Seoul')::date+2),
  ((now() AT TIME ZONE 'Asia/Seoul')::date+8),7,'public',now());
INSERT INTO challenge_reward_packages(challenge_id,points,user_xp,pet_xp) VALUES
 ('00000805',100,40,20);
INSERT INTO challenge_participations(id,challenge_id,user_id) VALUES
 ('00000806',
  '00000805',
  '00000801'),
 ('00000813',
  '00000805',
  '00000813');
DO $$ BEGIN
  IF (SELECT participation_id FROM challenge_live_rankings
      WHERE challenge_id='00000805' AND rank_no=1)
      IS DISTINCT FROM '00000806'::short_id THEN
    RAISE EXCEPTION 'zero-score ranking tie break failed';
  END IF;
END $$;
INSERT INTO missions
 (id,user_id,source_type,title,category_id,difficulty_id,
  verification_method,scheduled_date)
VALUES
 ('00000807',
  '00000801','challenge','챌린지 인증',
  '00000803',
  '00000804','sensor',
  ((now() AT TIME ZONE 'Asia/Seoul')::date+2));
INSERT INTO challenge_daily_missions
 (id,participation_id,challenge_id,user_id,challenge_date,mission_id)
VALUES
 ('00000808',
  '00000806',
  '00000805',
  '00000801',
  ((now() AT TIME ZONE 'Asia/Seoul')::date+2),
  '00000807');

DO $$ BEGIN
  BEGIN
    UPDATE challenges SET required_success_days=1
     WHERE id='00000805';
    RAISE EXCEPTION 'post-enrollment rule change accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE challenge_reward_packages SET points=1000
     WHERE challenge_id='00000805';
    RAISE EXCEPTION 'post-enrollment reward change accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO challenge_participations(id,challenge_id,user_id,joined_at)
      VALUES('00000809',
       '00000805',
       '00000801',
       now()+interval '3 days');
    RAISE EXCEPTION 'late/duplicate enrollment accepted';
  EXCEPTION WHEN check_violation OR unique_violation THEN NULL; END;
  BEGIN
    UPDATE challenge_daily_missions SET status='success'
     WHERE id='00000808';
    RAISE EXCEPTION 'success without evidence accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO challenge_reward_grants
      (id,participation_id,challenge_id,user_id,first_settlement_run_id,
       promised_points,paid_points,user_xp,pet_xp,status)
      VALUES('00000810',
       '00000806',
       '00000805',
       '00000801',
       '00000811',100,100,40,20,'active');
    RAISE EXCEPTION 'reward without confirmed settlement accepted';
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN NULL; END;
END $$;

INSERT INTO challenge_settlement_runs(id,challenge_id,run_no)
VALUES('00000811',
       '00000805',1);
DO $$ BEGIN
  BEGIN
    UPDATE challenge_settlement_runs
       SET status='confirmed',confirmed_by_admin_id='00000802',
           confirmed_at=now(),reason='테스트'
     WHERE id='00000811';
    RAISE EXCEPTION 'future/pending challenge settlement accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

INSERT INTO challenges
 (id,origin,created_by_user_id,title,description,category_id,difficulty_id,
  verification_method,start_date,end_date,required_success_days)
VALUES
 ('00000812','user',
  '00000801','커뮤니티 걷기','매일 걷기',
  '00000803',
  '00000804','sensor',
  ((now() AT TIME ZONE 'Asia/Seoul')::date+3),
  ((now() AT TIME ZONE 'Asia/Seoul')::date+9),7);
DO $$ BEGIN
  BEGIN
    INSERT INTO challenge_reward_packages(challenge_id,points,user_xp,pet_xp)
    VALUES('00000812',1,0,0);
    RAISE EXCEPTION 'community currency reward accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
ROLLBACK;

-- smoke: 포인트 회수 청구 소스 (챌린지·스트릭·업적) (샘플 데이터는 롤백)
BEGIN;

INSERT INTO users (id) VALUES ('00001601');

DO $$
BEGIN
    -- 소스가 하나도 없는 청구
    BEGIN
        INSERT INTO point_recovery_claims
            (id, user_id, original_award_transaction_id,
             target_points, outstanding_points)
        VALUES ('00001610',
                '00001601',
                '00001611', 10, 10);
        RAISE EXCEPTION 'claim without a source was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 소스가 둘인 청구
    BEGIN
        INSERT INTO point_recovery_claims
            (id, user_id, mission_id, streak_milestone_award_id,
             original_award_transaction_id, target_points, outstanding_points)
        VALUES ('00001612',
                '00001601',
                '00001613',
                '00001614',
                '00001611', 10, 10);
        RAISE EXCEPTION 'claim with two sources was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 원 적립 거래가 없는 스트릭·업적 청구는 소스 검증에서 거절
    BEGIN
        INSERT INTO point_recovery_claims
            (id, user_id, streak_milestone_award_id,
             original_award_transaction_id, target_points, outstanding_points)
        VALUES ('00001615',
                '00001601',
                '00001614',
                '00001611', 10, 10);
        RAISE EXCEPTION 'streak claim without its award was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO point_recovery_claims
            (id, user_id, user_achievement_id,
             original_award_transaction_id, target_points, outstanding_points)
        VALUES ('00001616',
                '00001601',
                '00001617',
                '00001611', 10, 10);
        RAISE EXCEPTION 'achievement claim without its award was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 유효 청구만 고유한 부분 인덱스, 취소된 청구는 제외
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
         WHERE tablename = 'point_recovery_claims'
           AND indexname = 'point_recovery_one_open_streak_claim_uq'
           AND indexdef LIKE '%NOT is_cancelled%'
    ) THEN
        RAISE EXCEPTION 'streak claim uniqueness is not limited to open claims';
    END IF;
    -- 챌린지 청구 고유성도 유효 청구로 좁혀졌고 예전 인덱스는 없다
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
         WHERE tablename = 'point_recovery_claims'
           AND indexname = 'point_recovery_one_open_challenge_claim_uq'
           AND indexdef LIKE '%NOT is_cancelled%'
    ) OR EXISTS (
        SELECT 1 FROM pg_indexes
         WHERE indexname = 'point_recovery_one_challenge_claim_uq'
    ) THEN
        RAISE EXCEPTION 'challenge claim uniqueness was not narrowed to open claims';
    END IF;
    -- 소스 하나 제약은 네 소스(미션, 챌린지, 스트릭, 업적)를 센다
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'point_recovery_exactly_one_source'
           AND pg_get_constraintdef(oid) LIKE '%num_nonnulls%'
           AND pg_get_constraintdef(oid) LIKE '%challenge_reward_grant_id%'
           AND pg_get_constraintdef(oid) LIKE '%streak_milestone_award_id%'
           AND pg_get_constraintdef(oid) LIKE '%user_achievement_id%'
    ) THEN
        RAISE EXCEPTION 'exactly-one-source constraint is wrong';
    END IF;
END;
$$;

-- 업적 청구 정상 경로: 업적 지급과 그 원 적립 거래를 만든 뒤 청구
INSERT INTO admin_accounts (id, login_id, email, password_hash)
VALUES ('00001602', 'owner16', 'owner16@example.com', 'hash');
INSERT INTO goal_categories (id, code, name, display_order)
VALUES ('00001603', 'fitness16', '운동16', 1);
INSERT INTO difficulty_levels (id, code, name, display_order)
VALUES ('00001604', 'basic16', '기본16', 1);
INSERT INTO goals
    (id, user_id, category_id, difficulty_id, title,
     start_date, end_date, status, completed_at)
VALUES ('00001605',
        '00001601',
        '00001603',
        '00001604',
        '첫 목표', CURRENT_DATE - 1, CURRENT_DATE + 1,
        'completed', now() - interval '1 hour');
INSERT INTO achievement_definitions (id, code, status, created_by_admin_id)
VALUES ('00001608', 'first_goal_16', 'public',
        '00001602');
INSERT INTO achievement_badge_images
    (id, achievement_id, version_no, r2_object_key,
     mime_type, size_bytes, uploaded_at, created_by_admin_id)
VALUES ('00001607',
        '00001608',
        1, 'badges/first-goal-16/v1.webp', 'image/webp', 1024,
        now() - interval '2 days', '00001602');
INSERT INTO achievement_versions
    (id, achievement_id, version_no, title, description, rarity,
     condition_type, target_count, reward_points,
     badge_image_id, effective_at, created_by_admin_id)
VALUES ('00001609',
        '00001608',
        1, '첫 목표 달성', '첫 목표를 완료한다', 'common',
        'first_goal_completed', 1, 50,
        '00001607',
        now() - interval '2 days', '00001602');
INSERT INTO user_achievements
    (id, user_id, achievement_id, achievement_version_id,
     badge_image_id, source_type, source_id,
     first_achieved_at, awarded_points, paid_points)
VALUES ('00001618',
        '00001601',
        '00001608',
        '00001609',
        '00001607',
        'goal', '00001605',
        now() - interval '1 hour', 50, 50);
INSERT INTO point_wallets (user_id) VALUES ('00001601');
INSERT INTO point_monthly_usage (user_id, month_start_date, gross_auto_awarded_points)
VALUES ('00001601',
        date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date, 50);
UPDATE point_wallets SET available_points = 50
 WHERE user_id = '00001601';
INSERT INTO point_transactions
    (id, user_id, kind, available_delta, balance_after,
     outstanding_after, source_type, source_id,
     cap_month, cap_delta, idempotency_key)
VALUES ('00001619',
        '00001601',
        'auto_award', 50, 50, 0, 'achievement',
        '00001618',
        date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date,
        50, 'achievement:1601:1608:award');

INSERT INTO point_recovery_claims
    (id, user_id, user_achievement_id,
     original_award_transaction_id, target_points, outstanding_points)
VALUES ('00001620',
        '00001601',
        '00001618',
        '00001619', 50, 50);

DO $$
BEGIN
    -- 같은 지급의 유효 청구는 하나만
    BEGIN
        INSERT INTO point_recovery_claims
            (id, user_id, user_achievement_id,
             original_award_transaction_id, target_points, outstanding_points)
        VALUES ('00001621',
                '00001601',
                '00001618',
                '00001619', 50, 50);
        RAISE EXCEPTION 'second open achievement claim was accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
END;
$$;

-- 취소하면 같은 지급에 새 청구 가능
UPDATE point_recovery_claims
   SET is_cancelled = true, cancelled_at = now(), outstanding_points = 0
 WHERE id = '00001620';
INSERT INTO point_recovery_claims
    (id, user_id, user_achievement_id,
     original_award_transaction_id, target_points, outstanding_points)
VALUES ('00001621',
        '00001601',
        '00001618',
        '00001619', 50, 50);

-- (구 smoke 014) 정기 작업용 부분 인덱스가 있고 작업 쿼리 조건을 포함하는지 확인
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                    WHERE indexname = 'challenge_daily_missions_pending_idx'
                      AND indexdef LIKE '%WHERE%pending%') THEN
        RAISE EXCEPTION 'challenge_daily_missions_pending_idx missing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                    WHERE indexname = 'missions_streak_scan_idx'
                      AND indexdef LIKE '%cancelled%' AND indexdef LIKE '%challenge%') THEN
        RAISE EXCEPTION 'missions_streak_scan_idx missing';
    END IF;
END $$;

ROLLBACK;
