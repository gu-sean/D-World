-- smoke 015, 샘플 데이터는 롤백
BEGIN;
INSERT INTO users(id) VALUES ('00000000-0000-0000-0000-000000001501');
INSERT INTO goal_categories(id,code,name,display_order) VALUES
 ('00000000-0000-0000-0000-000000001503','fitness15','운동15',1);
INSERT INTO difficulty_levels(id,code,name,display_order) VALUES
 ('00000000-0000-0000-0000-000000001504','basic15','기본15',1);
INSERT INTO goals(id,user_id,category_id,difficulty_id,title,start_date,end_date) VALUES
 ('00000000-0000-0000-0000-000000001505','00000000-0000-0000-0000-000000001501',
  '00000000-0000-0000-0000-000000001503','00000000-0000-0000-0000-000000001504',
  '목표',current_date,current_date+30);

-- 리포트: 피드백·다음 목표, 내용은 수정 불가
INSERT INTO ai_analysis_runs(id,user_id,run_type,period_start,period_end) VALUES
 ('00000000-0000-0000-0000-000000001510','00000000-0000-0000-0000-000000001501',
  'weekly_report',DATE '2026-10-05',DATE '2026-10-11');
INSERT INTO ai_reports(run_id,run_type,user_id,title,summary,content_json,feedback,next_goals)
VALUES ('00000000-0000-0000-0000-000000001510','weekly_report',
    '00000000-0000-0000-0000-000000001501','리포트','요약','{"workouts":3}',
    '좋아요','["주 3회 유지"]');
DO $$ BEGIN
  BEGIN
    UPDATE ai_reports SET feedback='바꿈' WHERE run_id='00000000-0000-0000-0000-000000001510';
    RAISE EXCEPTION 'report feedback changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE ai_analysis_runs SET status='completed',completed_at=now(),engine_version='m1'
 WHERE id='00000000-0000-0000-0000-000000001510';

-- 재생성: 완료된 실행을 대체하면 두 번째 세대를 만들 수 있다
DO $$ BEGIN
  BEGIN
    INSERT INTO ai_analysis_runs(id,user_id,run_type,period_start,period_end,generation_no)
    VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000001501','weekly_report',
            DATE '2026-10-05',DATE '2026-10-11',2);
    RAISE EXCEPTION 'second current run accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
UPDATE ai_analysis_runs SET superseded_at=now()
 WHERE id='00000000-0000-0000-0000-000000001510';
DO $$ BEGIN
  BEGIN
    UPDATE ai_analysis_runs SET superseded_at=NULL
     WHERE id='00000000-0000-0000-0000-000000001510';
    RAISE EXCEPTION 'supersession cleared';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE ai_analysis_runs SET generation_no=9
     WHERE id='00000000-0000-0000-0000-000000001510';
    RAISE EXCEPTION 'generation changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
INSERT INTO ai_analysis_runs(id,user_id,run_type,period_start,period_end,generation_no)
VALUES ('00000000-0000-0000-0000-000000001511','00000000-0000-0000-0000-000000001501',
        'weekly_report',DATE '2026-10-05',DATE '2026-10-11',2);
DO $$ BEGIN
  BEGIN
    UPDATE ai_analysis_runs SET superseded_at=now()
     WHERE id='00000000-0000-0000-0000-000000001511';
    RAISE EXCEPTION 'open run superseded';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
INSERT INTO ai_reports(run_id,run_type,user_id,title,summary,content_json)
VALUES ('00000000-0000-0000-0000-000000001511','weekly_report',
    '00000000-0000-0000-0000-000000001501','리포트 재생성','요약','{}');
UPDATE ai_analysis_runs SET status='completed',completed_at=now(),engine_version='m2'
 WHERE id='00000000-0000-0000-0000-000000001511';

-- 재조정: before_plan은 필수이며 수정할 수 없다
INSERT INTO ai_analysis_runs(id,user_id,run_type,period_start,period_end) VALUES
 ('00000000-0000-0000-0000-000000001520','00000000-0000-0000-0000-000000001501',
  'plan_adjustment',DATE '2026-10-05',DATE '2026-10-11');
DO $$ BEGIN
  BEGIN
    INSERT INTO plan_adjustment_proposals(id,run_id,user_id,goal_id,proposal_json)
    VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000001520',
        '00000000-0000-0000-0000-000000001501','00000000-0000-0000-0000-000000001505','{}');
    RAISE EXCEPTION 'proposal without before_plan accepted';
  EXCEPTION WHEN not_null_violation THEN NULL; END;
END $$;
INSERT INTO plan_adjustment_proposals(id,run_id,user_id,goal_id,proposal_json,
    before_plan,reason)
VALUES ('00000000-0000-0000-0000-000000001521','00000000-0000-0000-0000-000000001520',
    '00000000-0000-0000-0000-000000001501','00000000-0000-0000-0000-000000001505',
    '{"per_week":2}','{"per_week":3}','수행률이 낮아 빈도를 줄임');
DO $$ BEGIN
  BEGIN
    UPDATE plan_adjustment_proposals SET before_plan='{"per_week":9}'
     WHERE id='00000000-0000-0000-0000-000000001521';
    RAISE EXCEPTION 'before_plan changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 생성된 미션을 가리키는 추천
INSERT INTO missions(id,user_id,source_type,title,category_id,difficulty_id,
    verification_method,scheduled_date)
VALUES ('00000000-0000-0000-0000-000000001540','00000000-0000-0000-0000-000000001501',
    'user','추천 미션','00000000-0000-0000-0000-000000001503',
    '00000000-0000-0000-0000-000000001504','camera',current_date);
INSERT INTO ai_analysis_runs(id,user_id,run_type) VALUES
 ('00000000-0000-0000-0000-000000001541','00000000-0000-0000-0000-000000001501',
  'situational_recommendation');
INSERT INTO ai_mission_recommendations(id,run_id,user_id,rank_no,mission_id,reason,context)
VALUES ('00000000-0000-0000-0000-000000001542','00000000-0000-0000-0000-000000001541',
    '00000000-0000-0000-0000-000000001501',1,'00000000-0000-0000-0000-000000001540',
    '퇴근 후 시간대','{"time_slot":"evening"}');
DO $$ BEGIN
  BEGIN
    INSERT INTO ai_mission_recommendations(id,run_id,user_id,rank_no)
    VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000001541',
        '00000000-0000-0000-0000-000000001501',2);
    RAISE EXCEPTION 'recommendation without a target accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 탈퇴하면 미션 연결을 포함해 모두 삭제된다
DELETE FROM users WHERE id='00000000-0000-0000-0000-000000001501';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM ai_analysis_runs
              WHERE user_id='00000000-0000-0000-0000-000000001501')
     OR EXISTS (SELECT 1 FROM plan_adjustment_proposals
                 WHERE user_id='00000000-0000-0000-0000-000000001501')
     OR EXISTS (SELECT 1 FROM ai_mission_recommendations
                 WHERE user_id='00000000-0000-0000-0000-000000001501') THEN
    RAISE EXCEPTION 'AI data survived withdrawal';
  END IF;
END $$;
ROLLBACK;
