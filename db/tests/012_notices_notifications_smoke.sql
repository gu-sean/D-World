-- smoke 012, 샘플 데이터는 롤백
BEGIN;
INSERT INTO users(id) VALUES
 ('00001201'),
 ('00001202');
INSERT INTO admin_accounts(id,login_id,email,password_hash) VALUES
 ('00001203','owner12','owner12@example.com','hash');
INSERT INTO policy_document_versions(id,document_type,version,body,effective_at,published_at)
VALUES ('00001204','terms','12.0','본문',now(),now());

-- 분류·약관 연결, 노출 채널 최소 하나
DO $$ BEGIN
  BEGIN
    INSERT INTO notices(id,category,title,body,created_by_admin_id)
    VALUES (new_short_id(),'policy','약관','본문','00001203');
    RAISE EXCEPTION 'policy notice without a policy version accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO notices(id,category,title,body,policy_document_version_id,created_by_admin_id)
    VALUES (new_short_id(),'service','안내','본문',
            '00001204','00001203');
    RAISE EXCEPTION 'non-policy notice with a policy version accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO notices(id,category,title,body,show_in_list,send_push,created_by_admin_id)
    VALUES (new_short_id(),'service','안내','본문',false,false,
            '00001203');
    RAISE EXCEPTION 'notice with no channel accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 지정 대상 공지는 예약 전에 수신자가 있어야 한다
INSERT INTO notices(id,category,title,body,audience_type,send_push,link_screen,
    created_by_admin_id)
VALUES ('00001210','event','이벤트','본문','users',true,
    'event/detail','00001203');
DO $$ BEGIN
  BEGIN
    UPDATE notices SET status='scheduled', scheduled_at=now()+interval '1 hour'
     WHERE id='00001210';
    RAISE EXCEPTION 'targeted notice scheduled without recipients';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
INSERT INTO notice_recipients(notice_id,user_id)
VALUES ('00001210','00001201');
UPDATE notices SET status='scheduled', scheduled_at=now()+interval '1 hour'
 WHERE id='00001210';

-- 예약 후에는 내용·수신자·삭제가 잠긴다
DO $$ BEGIN
  BEGIN
    UPDATE notices SET title='변경' WHERE id='00001210';
    RAISE EXCEPTION 'scheduled notice edited';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO notice_recipients(notice_id,user_id)
    VALUES ('00001210','00001202');
    RAISE EXCEPTION 'recipient added after scheduling';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    DELETE FROM notices WHERE id='00001210';
    RAISE EXCEPTION 'scheduled notice deleted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- 게시 전에는 알림을 만들 수 없다
  BEGIN
    INSERT INTO user_notifications(id,user_id,kind,notice_id,title,body,push_status)
    VALUES (new_short_id(),'00001201','notice',
            '00001210','이벤트','본문','pending');
    RAISE EXCEPTION 'notification created before publish';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

UPDATE notices SET status='published', published_at=now()
 WHERE id='00001210';

-- 팬아웃: 수신자만, 내용 복사 필수, 회원당 한 번
DO $$ BEGIN
  BEGIN
    INSERT INTO user_notifications(id,user_id,kind,notice_id,title,body,push_status)
    VALUES (new_short_id(),'00001202','notice',
            '00001210','이벤트','본문','pending');
    RAISE EXCEPTION 'non-recipient notified';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO user_notifications(id,user_id,kind,notice_id,title,body,push_status)
    VALUES (new_short_id(),'00001201','notice',
            '00001210','다른 제목','본문','pending');
    RAISE EXCEPTION 'altered copy accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
INSERT INTO user_notifications(id,user_id,kind,notice_id,title,body,link_screen,push_status)
VALUES ('00001220','00001201',
    'notice','00001210','이벤트','본문','event/detail','pending');
DO $$ BEGIN
  BEGIN
    INSERT INTO user_notifications(id,user_id,kind,notice_id,title,body,push_status)
    VALUES (new_short_id(),'00001201','notice',
            '00001210','이벤트','본문','pending');
    RAISE EXCEPTION 'duplicate notification accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;

-- 푸시 결과와 읽음 상태
DO $$ BEGIN
  BEGIN
    UPDATE user_notifications SET push_status='sent'
     WHERE id='00001220';
    RAISE EXCEPTION 'sent without sent time';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE user_notifications SET title='변경'
     WHERE id='00001220';
    RAISE EXCEPTION 'notification content changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE user_notifications SET push_status='sent', push_sent_at=now(), push_attempts=1,
    read_at=now()
 WHERE id='00001220';
DO $$ BEGIN
  BEGIN
    UPDATE user_notifications SET push_status='failed', push_sent_at=NULL
     WHERE id='00001220';
    RAISE EXCEPTION 'final push result changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE notices SET fanout_completed_at=now()
 WHERE id='00001210';

-- 시스템 알림은 (회원, 이벤트 키)로 중복 제거
INSERT INTO user_notifications(id,user_id,kind,event_key,title,body)
VALUES ('00001221','00001201',
    'system','reward:1','보상 지급','100P가 지급되었습니다');
DO $$ BEGIN
  BEGIN
    INSERT INTO user_notifications(id,user_id,kind,event_key,title,body)
    VALUES (new_short_id(),'00001201',
        'system','reward:1','보상 지급','100P가 지급되었습니다');
    RAISE EXCEPTION 'duplicate system notification accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO user_notifications(id,user_id,kind,title,body)
    VALUES (new_short_id(),'00001201','system','t','b');
    RAISE EXCEPTION 'system notification without event key accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 초안·예약 공지 취소, 푸시 기기, 탈퇴 정리
INSERT INTO notices(id,category,title,body,created_by_admin_id)
VALUES ('00001211','service','안내','본문',
    '00001203');
UPDATE notices SET status='cancelled', cancelled_at=now()
 WHERE id='00001211';
DO $$ BEGIN
  BEGIN
    UPDATE notices SET status='published', published_at=now()
     WHERE id='00001211';
    RAISE EXCEPTION 'cancelled notice published';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

INSERT INTO push_devices(id,user_id,platform,token)
VALUES ('00001230','00001201',
    'android','tok-12');
DO $$ BEGIN
  BEGIN
    INSERT INTO push_devices(id,user_id,platform,token)
    VALUES (new_short_id(),'00001202','ios','tok-12');
    RAISE EXCEPTION 'duplicate device token accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;

DELETE FROM users WHERE id='00001201';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM user_notifications
              WHERE user_id='00001201')
     OR EXISTS (SELECT 1 FROM push_devices
                 WHERE user_id='00001201')
     OR EXISTS (SELECT 1 FROM notice_recipients
                 WHERE user_id='00001201') THEN
    RAISE EXCEPTION 'member data survived withdrawal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM notices
                  WHERE id='00001210') THEN
    RAISE EXCEPTION 'published notice lost on withdrawal';
  END IF;
END $$;
ROLLBACK;
