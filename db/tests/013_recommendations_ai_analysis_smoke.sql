-- smoke 013, 샘플 데이터는 롤백
BEGIN;
INSERT INTO users(id) VALUES ('00000000-0000-0000-0000-000000001301');
INSERT INTO admin_accounts(id,login_id,email,password_hash) VALUES
 ('00000000-0000-0000-0000-000000001302','owner13','owner13@example.com','hash');
INSERT INTO goal_categories(id,code,name,display_order) VALUES
 ('00000000-0000-0000-0000-000000001303','fitness13','운동13',1);
INSERT INTO difficulty_levels(id,code,name,display_order) VALUES
 ('00000000-0000-0000-0000-000000001304','basic13','기본13',1);
INSERT INTO goals(id,user_id,category_id,difficulty_id,title,start_date,end_date) VALUES
 ('00000000-0000-0000-0000-000000001305','00000000-0000-0000-0000-000000001301',
  '00000000-0000-0000-0000-000000001303','00000000-0000-0000-0000-000000001304',
  '주 3회 운동', current_date, current_date + 30);

-- 추천 문구: 조건 매개변수를 유형별로 검증
INSERT INTO recommendation_messages(id,message,condition_type,created_by_admin_id,updated_by_admin_id)
VALUES (gen_random_uuid(),'오늘도 시작해 볼까요?','always',
  '00000000-0000-0000-0000-000000001302','00000000-0000-0000-0000-000000001302');
INSERT INTO recommendation_messages(id,message,condition_type,condition_params,
    created_by_admin_id,updated_by_admin_id)
VALUES (gen_random_uuid(),'오랜만이에요','inactive_days','{"days":7}',
  '00000000-0000-0000-0000-000000001302','00000000-0000-0000-0000-000000001302'),
 (gen_random_uuid(),'늦은 밤 스트레칭','time_slot','{"start_hour":22,"end_hour":6}',
  '00000000-0000-0000-0000-000000001302','00000000-0000-0000-0000-000000001302');
DO $$ BEGIN
  BEGIN
    INSERT INTO recommendation_messages(id,message,condition_type,condition_params,
        created_by_admin_id,updated_by_admin_id)
    VALUES (gen_random_uuid(),'x','inactive_days','{"days":0}',
      '00000000-0000-0000-0000-000000001302','00000000-0000-0000-0000-000000001302');
    RAISE EXCEPTION 'zero inactive days accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO recommendation_messages(id,message,condition_type,condition_params,
        created_by_admin_id,updated_by_admin_id)
    VALUES (gen_random_uuid(),'x','time_slot','{"start_hour":9,"end_hour":9}',
      '00000000-0000-0000-0000-000000001302','00000000-0000-0000-0000-000000001302');
    RAISE EXCEPTION 'empty time slot accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO recommendation_messages(id,message,condition_type,condition_params,
        created_by_admin_id,updated_by_admin_id)
    VALUES (gen_random_uuid(),'x','always','{"days":3}',
      '00000000-0000-0000-0000-000000001302','00000000-0000-0000-0000-000000001302');
    RAISE EXCEPTION 'params on always accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO recommendation_messages(id,message,condition_type,starts_at,ends_at,
        created_by_admin_id,updated_by_admin_id)
    VALUES (gen_random_uuid(),'x','always',now(),now()-interval '1 day',
      '00000000-0000-0000-0000-000000001302','00000000-0000-0000-0000-000000001302');
    RAISE EXCEPTION 'reversed display window accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 실행 기간
DO $$ BEGIN
  BEGIN
    INSERT INTO ai_analysis_runs(id,user_id,run_type,period_start,period_end)
    VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000001301','weekly_report',
            DATE '2026-10-06', DATE '2026-10-12');
    RAISE EXCEPTION 'weekly report not starting on Monday accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO ai_analysis_runs(id,user_id,run_type,period_start,period_end)
    VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000001301','monthly_report',
            DATE '2026-10-01', DATE '2026-10-30');
    RAISE EXCEPTION 'monthly report with wrong end accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO ai_analysis_runs(id,user_id,run_type,period_start,period_end)
    VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000001301',
            'situational_recommendation', DATE '2026-10-01', DATE '2026-10-01');
    RAISE EXCEPTION 'situational run with a period accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 실행 생명주기(주간 리포트로 확인)
INSERT INTO ai_analysis_runs(id,user_id,run_type,period_start,period_end,ingest_key)
VALUES ('00000000-0000-0000-0000-000000001310','00000000-0000-0000-0000-000000001301',
        'weekly_report', DATE '2026-09-28', DATE '2026-10-04','ing-1');
DO $$ BEGIN
  BEGIN
    UPDATE ai_analysis_runs SET status='completed', completed_at=now(), engine_version='m1'
     WHERE id='00000000-0000-0000-0000-000000001310';
    RAISE EXCEPTION 'run completed without result';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO ai_analysis_runs(id,user_id,run_type,period_start,period_end)
    VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000001301','weekly_report',
            DATE '2026-09-28', DATE '2026-10-04');
    RAISE EXCEPTION 'second live run for the same period accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO ai_analysis_runs(id,user_id,run_type,period_start,period_end,ingest_key)
    VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000001301','weekly_report',
            DATE '2026-10-12', DATE '2026-10-18','ing-1');
    RAISE EXCEPTION 'duplicate ingest key accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
INSERT INTO ai_reports(run_id,run_type,user_id,title,summary,content_json)
VALUES ('00000000-0000-0000-0000-000000001310','weekly_report',
        '00000000-0000-0000-0000-000000001301','9월 5주 리포트','요약','{"workouts":4}');
UPDATE ai_analysis_runs SET status='completed', completed_at=now(), engine_version='m1'
 WHERE id='00000000-0000-0000-0000-000000001310';
DO $$ BEGIN
  BEGIN
    UPDATE ai_analysis_runs SET engine_version='m2'
     WHERE id='00000000-0000-0000-0000-000000001310';
    RAISE EXCEPTION 'finished run changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 실패한 실행은 같은 기간의 새 요청을 허용
INSERT INTO ai_analysis_runs(id,user_id,run_type,period_start,period_end)
VALUES ('00000000-0000-0000-0000-000000001311','00000000-0000-0000-0000-000000001301',
        'weekly_report', DATE '2026-10-12', DATE '2026-10-18');
UPDATE ai_analysis_runs SET status='failed', completed_at=now(), failure_reason='timeout'
 WHERE id='00000000-0000-0000-0000-000000001311';
INSERT INTO ai_analysis_runs(id,user_id,run_type,period_start,period_end)
VALUES ('00000000-0000-0000-0000-000000001312','00000000-0000-0000-0000-000000001301',
        'weekly_report', DATE '2026-10-12', DATE '2026-10-18');

-- 끝난 실행에는 결과를 붙일 수 없다
DO $$ BEGIN
  BEGIN
    INSERT INTO ai_reports(run_id,run_type,user_id,title,summary,content_json)
    VALUES ('00000000-0000-0000-0000-000000001311','weekly_report',
            '00000000-0000-0000-0000-000000001301','t','s','{}');
    RAISE EXCEPTION 'result attached to a failed run';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 계획 재조정
INSERT INTO ai_analysis_runs(id,user_id,run_type,period_start,period_end)
VALUES ('00000000-0000-0000-0000-000000001320','00000000-0000-0000-0000-000000001301',
        'plan_adjustment', DATE '2026-10-05', DATE '2026-10-11');
INSERT INTO plan_adjustment_proposals(id,run_id,user_id,goal_id,proposal_json,before_plan)
VALUES ('00000000-0000-0000-0000-000000001321','00000000-0000-0000-0000-000000001320',
        '00000000-0000-0000-0000-000000001301','00000000-0000-0000-0000-000000001305',
        '{"change":"주 2회로 조정"}','{"per_week":3}');
UPDATE ai_analysis_runs SET status='completed', completed_at=now(), engine_version='m1'
 WHERE id='00000000-0000-0000-0000-000000001320';
DO $$ BEGIN
  BEGIN
    UPDATE plan_adjustment_proposals SET status='accepted', decided_at=now()
     WHERE id='00000000-0000-0000-0000-000000001321';
    RAISE EXCEPTION 'accepted without a plan';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE plan_adjustment_proposals SET proposal_json='{"change":"다른 내용"}'
     WHERE id='00000000-0000-0000-0000-000000001321';
    RAISE EXCEPTION 'proposal content changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE plan_adjustment_proposals SET status='accepted', decided_at=now(),
    accepted_plan_json='{"change":"주 2회로 조정"}'
 WHERE id='00000000-0000-0000-0000-000000001321';
DO $$ BEGIN
  BEGIN
    UPDATE plan_adjustment_proposals SET status='rejected',
        accepted_plan_json=NULL
     WHERE id='00000000-0000-0000-0000-000000001321';
    RAISE EXCEPTION 'decision reversed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 주간 리포트
INSERT INTO ai_analysis_runs(id,user_id,run_type,period_start,period_end)
VALUES ('00000000-0000-0000-0000-000000001330','00000000-0000-0000-0000-000000001301',
        'weekly_report', DATE '2026-10-05', DATE '2026-10-11');
INSERT INTO ai_reports(run_id,run_type,user_id,title,summary,content_json)
VALUES ('00000000-0000-0000-0000-000000001330','weekly_report',
        '00000000-0000-0000-0000-000000001301','10월 2주 리포트','요약','{"sections":[]}');
UPDATE ai_analysis_runs SET status='completed', completed_at=now(), engine_version='m1'
 WHERE id='00000000-0000-0000-0000-000000001330';
UPDATE ai_reports SET read_at=now() WHERE run_id='00000000-0000-0000-0000-000000001330';
DO $$ BEGIN
  BEGIN
    UPDATE ai_reports SET title='변경' WHERE run_id='00000000-0000-0000-0000-000000001330';
    RAISE EXCEPTION 'report content changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- 리포트는 리포트 종류의 실행에만 속해야 한다
  BEGIN
    INSERT INTO ai_reports(run_id,run_type,user_id,title,summary,content_json)
    VALUES ('00000000-0000-0000-0000-000000001320','weekly_report',
            '00000000-0000-0000-0000-000000001301','t','s','{}');
    RAISE EXCEPTION 'report attached to a plan run';
  EXCEPTION WHEN foreign_key_violation OR check_violation THEN NULL; END;
END $$;

-- 상황 추천은 원본 좌표를 저장하지 않는다
INSERT INTO ai_analysis_runs(id,user_id,run_type)
VALUES ('00000000-0000-0000-0000-000000001340','00000000-0000-0000-0000-000000001301',
        'situational_recommendation');
DO $$ BEGIN
  BEGIN
    INSERT INTO ai_mission_recommendations(id,run_id,user_id,rank_no,suggestion_text,context)
    VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000001340',
        '00000000-0000-0000-0000-000000001301',1,'공원 걷기','{"latitude":37.5}');
    RAISE EXCEPTION 'raw coordinates accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO ai_mission_recommendations(id,run_id,user_id,rank_no)
    VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000001340',
        '00000000-0000-0000-0000-000000001301',1);
    RAISE EXCEPTION 'empty recommendation accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
INSERT INTO ai_mission_recommendations(id,run_id,user_id,rank_no,suggestion_text,context)
VALUES ('00000000-0000-0000-0000-000000001341','00000000-0000-0000-0000-000000001340',
    '00000000-0000-0000-0000-000000001301',1,'공원 걷기',
    '{"time_slot":"evening","place":"park"}');
UPDATE ai_analysis_runs SET status='completed', completed_at=now(), engine_version='m1'
 WHERE id='00000000-0000-0000-0000-000000001340';
UPDATE ai_mission_recommendations SET status='dismissed', decided_at=now()
 WHERE id='00000000-0000-0000-0000-000000001341';
DO $$ BEGIN
  BEGIN
    UPDATE ai_mission_recommendations SET status='accepted'
     WHERE id='00000000-0000-0000-0000-000000001341';
    RAISE EXCEPTION 'final recommendation decision changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 탈퇴하면 개인 AI 결과는 모두 삭제되고 관리자 문구는 남는다
DELETE FROM users WHERE id='00000000-0000-0000-0000-000000001301';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM ai_analysis_runs
              WHERE user_id='00000000-0000-0000-0000-000000001301')
     OR EXISTS (SELECT 1 FROM ai_reports
                 WHERE user_id='00000000-0000-0000-0000-000000001301')
     OR EXISTS (SELECT 1 FROM ai_mission_recommendations
                 WHERE user_id='00000000-0000-0000-0000-000000001301') THEN
    RAISE EXCEPTION 'AI results survived withdrawal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM recommendation_messages) THEN
    RAISE EXCEPTION 'recommendation messages lost on withdrawal';
  END IF;
END $$;
ROLLBACK;
