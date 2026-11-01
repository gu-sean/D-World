-- smoke 011, 샘플 데이터는 롤백
BEGIN;
INSERT INTO users(id) VALUES
 ('00000000-0000-0000-0000-000000001101'),
 ('00000000-0000-0000-0000-000000001102');
INSERT INTO profiles(user_id,nickname) VALUES
 ('00000000-0000-0000-0000-000000001101','Reporter11'),
 ('00000000-0000-0000-0000-000000001102','Target11');
INSERT INTO admin_accounts(id,login_id,email,password_hash) VALUES
 ('00000000-0000-0000-0000-000000001103','owner11','owner11@example.com','hash');

-- 문의는 대상을 가질 수 없고 신고는 반드시 가진다
DO $$ BEGIN
  BEGIN
    INSERT INTO support_tickets(id,ticket_type,category,reporter_user_id,subject,body,
        target_kind,target_user_id)
    VALUES (gen_random_uuid(),'inquiry','other','00000000-0000-0000-0000-000000001101',
        's','b','user','00000000-0000-0000-0000-000000001102');
    RAISE EXCEPTION 'inquiry with target accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO support_tickets(id,ticket_type,category,reporter_user_id,subject,body)
    VALUES (gen_random_uuid(),'report','abuse','00000000-0000-0000-0000-000000001101',
        's','b');
    RAISE EXCEPTION 'report without target accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO support_tickets(id,ticket_type,category,reporter_user_id,subject,body,
        target_kind,target_user_id)
    VALUES (gen_random_uuid(),'report','abuse','00000000-0000-0000-0000-000000001101',
        's','b','user','00000000-0000-0000-0000-000000001101');
    RAISE EXCEPTION 'self report accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO support_tickets(id,ticket_type,category,reporter_user_id,subject,body)
    VALUES (gen_random_uuid(),'inquiry','abuse','00000000-0000-0000-0000-000000001101',
        's','b');
    RAISE EXCEPTION 'wrong category accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 문의와 신고
INSERT INTO support_tickets(id,ticket_type,category,reporter_user_id,subject,body) VALUES
 ('00000000-0000-0000-0000-000000001110','inquiry','points',
  '00000000-0000-0000-0000-000000001101','포인트 문의','내용');
INSERT INTO support_tickets(id,ticket_type,category,reporter_user_id,subject,body,
    target_kind,target_user_id) VALUES
 ('00000000-0000-0000-0000-000000001111','report','abuse',
  '00000000-0000-0000-0000-000000001101','부적절한 닉네임','사유',
  'user','00000000-0000-0000-0000-000000001102');

-- 같은 대상에 대한 미완료 중복 신고
DO $$ BEGIN
  BEGIN
    INSERT INTO support_tickets(id,ticket_type,category,reporter_user_id,subject,body,
        target_kind,target_user_id)
    VALUES (gen_random_uuid(),'report','abuse','00000000-0000-0000-0000-000000001101',
        's','b','user','00000000-0000-0000-0000-000000001102');
    RAISE EXCEPTION 'duplicate open report accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;

-- 상태 건너뛰기 불가, 완료에는 처리 결과 필요, 내용 고정
DO $$ BEGIN
  BEGIN
    UPDATE support_tickets SET status='completed',
        assigned_admin_id='00000000-0000-0000-0000-000000001103', completed_at=now()
     WHERE id='00000000-0000-0000-0000-000000001111';
    RAISE EXCEPTION 'status skipped';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE support_tickets SET body='edited'
     WHERE id='00000000-0000-0000-0000-000000001111';
    RAISE EXCEPTION 'ticket body edited';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO support_ticket_resolutions
      (ticket_id,ticket_type,outcome,resolved_by_admin_id)
    VALUES ('00000000-0000-0000-0000-000000001111','report','no_action',
        '00000000-0000-0000-0000-000000001103');
    RAISE EXCEPTION 'resolution accepted before review';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

UPDATE support_tickets SET status='in_review',
    assigned_admin_id='00000000-0000-0000-0000-000000001103'
 WHERE id='00000000-0000-0000-0000-000000001111';
DO $$ BEGIN
  BEGIN
    UPDATE support_tickets SET status='completed', completed_at=now()
     WHERE id='00000000-0000-0000-0000-000000001111';
    RAISE EXCEPTION 'completed without resolution';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- 결과 유형과 연결 데이터가 일치해야 한다
  BEGIN
    INSERT INTO support_ticket_resolutions
      (ticket_id,ticket_type,outcome,resolved_by_admin_id)
    VALUES ('00000000-0000-0000-0000-000000001111','report','account_action',
        '00000000-0000-0000-0000-000000001103');
    RAISE EXCEPTION 'account_action without action accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 신고자(잘못된 회원) 대상 조치는 거부, 신고 대상 회원은 허용
INSERT INTO account_actions(id,user_id,admin_id,action_type,reason,starts_at,
    source_ticket_id) VALUES
 ('00000000-0000-0000-0000-000000001121','00000000-0000-0000-0000-000000001101',
  '00000000-0000-0000-0000-000000001103','warning','x',now(),
  '00000000-0000-0000-0000-000000001111'),
 ('00000000-0000-0000-0000-000000001122','00000000-0000-0000-0000-000000001102',
  '00000000-0000-0000-0000-000000001103','warning','부적절한 닉네임',now(),
  '00000000-0000-0000-0000-000000001111');
DO $$ BEGIN
  BEGIN
    INSERT INTO support_ticket_resolutions
      (ticket_id,ticket_type,outcome,account_action_id,resolved_by_admin_id)
    VALUES ('00000000-0000-0000-0000-000000001111','report','account_action',
        '00000000-0000-0000-0000-000000001121',
        '00000000-0000-0000-0000-000000001103');
    RAISE EXCEPTION 'action against another member accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
INSERT INTO support_ticket_resolutions
  (ticket_id,ticket_type,outcome,account_action_id,resolved_by_admin_id)
VALUES ('00000000-0000-0000-0000-000000001111','report','account_action',
    '00000000-0000-0000-0000-000000001122','00000000-0000-0000-0000-000000001103');
UPDATE support_tickets SET status='completed', completed_at=now()
 WHERE id='00000000-0000-0000-0000-000000001111';

-- 완료된 티켓은 고정되고, 같은 대상에 대한 새 신고는 허용
DO $$ BEGIN
  BEGIN
    UPDATE support_tickets SET completed_at=now()+interval '1 day'
     WHERE id='00000000-0000-0000-0000-000000001111';
    RAISE EXCEPTION 'completed ticket changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
INSERT INTO support_tickets(id,ticket_type,category,reporter_user_id,subject,body,
    target_kind,target_user_id)
VALUES ('00000000-0000-0000-0000-000000001112','report','abuse',
  '00000000-0000-0000-0000-000000001101','재신고','다시','user',
  '00000000-0000-0000-0000-000000001102');

-- 문의의 처리 결과는 답변이어야 한다
INSERT INTO support_ticket_events(id,ticket_id,event_type)
VALUES (gen_random_uuid(),'00000000-0000-0000-0000-000000001110','received');
DO $$ BEGIN
  BEGIN
    INSERT INTO support_ticket_events(id,ticket_id,event_type,visibility,body)
    VALUES ('00000000-0000-0000-0000-000000001131',
      '00000000-0000-0000-0000-000000001110','note','internal','메모');
    RAISE EXCEPTION 'note without admin accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
INSERT INTO support_ticket_events(id,ticket_id,admin_id,event_type,visibility,body)
VALUES ('00000000-0000-0000-0000-000000001131','00000000-0000-0000-0000-000000001110',
  '00000000-0000-0000-0000-000000001103','note','internal','메모');
DO $$ BEGIN
  BEGIN
    UPDATE support_ticket_events SET body='changed'
     WHERE id='00000000-0000-0000-0000-000000001131';
    RAISE EXCEPTION 'event history changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 경고받은 회원이 탈퇴: 조치는 사라지고 처리 결과는 남는다
INSERT INTO users(id) VALUES ('00000000-0000-0000-0000-000000001104');
INSERT INTO support_tickets(id,ticket_type,category,reporter_user_id,subject,body,
    target_kind,target_user_id)
VALUES ('00000000-0000-0000-0000-000000001113','report','cheating',
  '00000000-0000-0000-0000-000000001102','역신고','내용','user',
  '00000000-0000-0000-0000-000000001104');
UPDATE support_tickets SET status='in_review',
    assigned_admin_id='00000000-0000-0000-0000-000000001103'
 WHERE id='00000000-0000-0000-0000-000000001113';
INSERT INTO account_actions(id,user_id,admin_id,action_type,reason,starts_at,source_ticket_id)
VALUES ('00000000-0000-0000-0000-000000001123','00000000-0000-0000-0000-000000001104',
  '00000000-0000-0000-0000-000000001103','warning','x',now(),
  '00000000-0000-0000-0000-000000001113');
INSERT INTO support_ticket_resolutions
  (ticket_id,ticket_type,outcome,account_action_id,resolved_by_admin_id)
VALUES ('00000000-0000-0000-0000-000000001113','report','account_action',
  '00000000-0000-0000-0000-000000001123','00000000-0000-0000-0000-000000001103');
UPDATE support_tickets SET status='completed', completed_at=now()
 WHERE id='00000000-0000-0000-0000-000000001113';
DELETE FROM users WHERE id='00000000-0000-0000-0000-000000001104';
DO $$ BEGIN
  IF (SELECT account_action_id FROM support_ticket_resolutions
       WHERE ticket_id='00000000-0000-0000-0000-000000001113') IS NOT NULL
     OR (SELECT outcome FROM support_ticket_resolutions
          WHERE ticket_id='00000000-0000-0000-0000-000000001113') <> 'account_action' THEN
    RAISE EXCEPTION 'resolution not kept after the warned member withdrew';
  END IF;
  BEGIN
    UPDATE support_ticket_resolutions SET user_reply='edited'
     WHERE ticket_id='00000000-0000-0000-0000-000000001113';
    RAISE EXCEPTION 'resolution edited';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 탈퇴: 신고자의 문의는 삭제, 신고는 신고자 없이 보존
DELETE FROM users WHERE id='00000000-0000-0000-0000-000000001101';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM support_tickets
              WHERE id='00000000-0000-0000-0000-000000001110') THEN
    RAISE EXCEPTION 'inquiry survived withdrawal';
  END IF;
  IF (SELECT reporter_user_id FROM support_tickets
       WHERE id='00000000-0000-0000-0000-000000001111') IS NOT NULL THEN
    RAISE EXCEPTION 'reporter reference survived withdrawal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM support_ticket_resolutions
                  WHERE ticket_id='00000000-0000-0000-0000-000000001111') THEN
    RAISE EXCEPTION 'report history lost on withdrawal';
  END IF;
END $$;
ROLLBACK;
