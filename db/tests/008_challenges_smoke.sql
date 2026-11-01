-- smoke 008, 샘플 데이터는 롤백
BEGIN;
INSERT INTO users(id) VALUES
 ('00000000-0000-0000-0000-000000000801'),
 ('00000000-0000-0000-0000-000000000813');
INSERT INTO profiles(user_id,nickname) VALUES
 ('00000000-0000-0000-0000-000000000801','Runner08'),
 ('00000000-0000-0000-0000-000000000813','RunnerB08');
INSERT INTO admin_accounts(id,login_id,email,password_hash) VALUES
 ('00000000-0000-0000-0000-000000000802','owner08','owner08@example.com','hash');
INSERT INTO goal_categories(id,code,name,display_order) VALUES
 ('00000000-0000-0000-0000-000000000803','fitness08','운동08',1);
INSERT INTO difficulty_levels(id,code,name,display_order) VALUES
 ('00000000-0000-0000-0000-000000000804','basic08','기본08',1);
INSERT INTO challenges
 (id,origin,created_by_admin_id,title,description,category_id,difficulty_id,
  verification_method,start_date,end_date,required_success_days,
  publication_status,published_at)
VALUES
 ('00000000-0000-0000-0000-000000000805','admin',
  '00000000-0000-0000-0000-000000000802','7일 운동','매일 운동하기',
  '00000000-0000-0000-0000-000000000803',
  '00000000-0000-0000-0000-000000000804','sensor',
  ((now() AT TIME ZONE 'Asia/Seoul')::date+2),
  ((now() AT TIME ZONE 'Asia/Seoul')::date+8),7,'public',now());
INSERT INTO challenge_reward_packages(challenge_id,points,user_xp,pet_xp) VALUES
 ('00000000-0000-0000-0000-000000000805',100,40,20);
INSERT INTO challenge_participations(id,challenge_id,user_id) VALUES
 ('00000000-0000-0000-0000-000000000806',
  '00000000-0000-0000-0000-000000000805',
  '00000000-0000-0000-0000-000000000801'),
 ('00000000-0000-0000-0000-000000000813',
  '00000000-0000-0000-0000-000000000805',
  '00000000-0000-0000-0000-000000000813');
DO $$ BEGIN
  IF (SELECT participation_id FROM challenge_live_rankings
      WHERE challenge_id='00000000-0000-0000-0000-000000000805' AND rank_no=1)
      IS DISTINCT FROM '00000000-0000-0000-0000-000000000806'::uuid THEN
    RAISE EXCEPTION 'zero-score ranking tie break failed';
  END IF;
END $$;
INSERT INTO missions
 (id,user_id,source_type,title,category_id,difficulty_id,
  verification_method,scheduled_date)
VALUES
 ('00000000-0000-0000-0000-000000000807',
  '00000000-0000-0000-0000-000000000801','challenge','챌린지 인증',
  '00000000-0000-0000-0000-000000000803',
  '00000000-0000-0000-0000-000000000804','sensor',
  ((now() AT TIME ZONE 'Asia/Seoul')::date+2));
INSERT INTO challenge_daily_missions
 (id,participation_id,challenge_id,user_id,challenge_date,mission_id)
VALUES
 ('00000000-0000-0000-0000-000000000808',
  '00000000-0000-0000-0000-000000000806',
  '00000000-0000-0000-0000-000000000805',
  '00000000-0000-0000-0000-000000000801',
  ((now() AT TIME ZONE 'Asia/Seoul')::date+2),
  '00000000-0000-0000-0000-000000000807');

DO $$ BEGIN
  BEGIN
    UPDATE challenges SET required_success_days=1
     WHERE id='00000000-0000-0000-0000-000000000805';
    RAISE EXCEPTION 'post-enrollment rule change accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE challenge_reward_packages SET points=1000
     WHERE challenge_id='00000000-0000-0000-0000-000000000805';
    RAISE EXCEPTION 'post-enrollment reward change accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO challenge_participations(id,challenge_id,user_id,joined_at)
      VALUES('00000000-0000-0000-0000-000000000809',
       '00000000-0000-0000-0000-000000000805',
       '00000000-0000-0000-0000-000000000801',
       now()+interval '3 days');
    RAISE EXCEPTION 'late/duplicate enrollment accepted';
  EXCEPTION WHEN check_violation OR unique_violation THEN NULL; END;
  BEGIN
    UPDATE challenge_daily_missions SET status='success'
     WHERE id='00000000-0000-0000-0000-000000000808';
    RAISE EXCEPTION 'success without evidence accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO challenge_reward_grants
      (id,participation_id,challenge_id,user_id,first_settlement_run_id,
       promised_points,paid_points,user_xp,pet_xp,status)
      VALUES('00000000-0000-0000-0000-000000000810',
       '00000000-0000-0000-0000-000000000806',
       '00000000-0000-0000-0000-000000000805',
       '00000000-0000-0000-0000-000000000801',
       '00000000-0000-0000-0000-000000000811',100,100,40,20,'active');
    RAISE EXCEPTION 'reward without confirmed settlement accepted';
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN NULL; END;
END $$;

INSERT INTO challenge_settlement_runs(id,challenge_id,run_no)
VALUES('00000000-0000-0000-0000-000000000811',
       '00000000-0000-0000-0000-000000000805',1);
DO $$ BEGIN
  BEGIN
    UPDATE challenge_settlement_runs
       SET status='confirmed',confirmed_by_admin_id='00000000-0000-0000-0000-000000000802',
           confirmed_at=now(),reason='테스트'
     WHERE id='00000000-0000-0000-0000-000000000811';
    RAISE EXCEPTION 'future/pending challenge settlement accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

INSERT INTO challenges
 (id,origin,created_by_user_id,title,description,category_id,difficulty_id,
  verification_method,start_date,end_date,required_success_days)
VALUES
 ('00000000-0000-0000-0000-000000000812','user',
  '00000000-0000-0000-0000-000000000801','커뮤니티 걷기','매일 걷기',
  '00000000-0000-0000-0000-000000000803',
  '00000000-0000-0000-0000-000000000804','sensor',
  ((now() AT TIME ZONE 'Asia/Seoul')::date+3),
  ((now() AT TIME ZONE 'Asia/Seoul')::date+9),7);
DO $$ BEGIN
  BEGIN
    INSERT INTO challenge_reward_packages(challenge_id,points,user_xp,pet_xp)
    VALUES('00000000-0000-0000-0000-000000000812',1,0,0);
    RAISE EXCEPTION 'community currency reward accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
ROLLBACK;
