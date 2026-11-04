-- smoke 009, 샘플 데이터는 롤백
BEGIN;
INSERT INTO users(id) VALUES ('00000000-0000-0000-0000-000000000901');
INSERT INTO admin_accounts(id,login_id,email,password_hash) VALUES
 ('00000000-0000-0000-0000-000000000902','owner09','owner09@example.com','hash');

-- 관리자 멱등 키: 중복 키 거부, 요청 식별 정보 고정, 재오픈 금지
INSERT INTO admin_idempotency_keys(id,admin_id,idempotency_key,operation,request_hash)
VALUES ('00000000-0000-0000-0000-000000000903',
        '00000000-0000-0000-0000-000000000902','key-1','settlement.confirm','h1');
DO $$ BEGIN
  BEGIN
    INSERT INTO admin_idempotency_keys(id,admin_id,idempotency_key,operation,request_hash)
    VALUES ('00000000-0000-0000-0000-000000000904',
            '00000000-0000-0000-0000-000000000902','key-1','settlement.confirm','h1');
    RAISE EXCEPTION 'duplicate idempotency key was accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    UPDATE admin_idempotency_keys SET request_hash='other'
     WHERE id='00000000-0000-0000-0000-000000000903';
    RAISE EXCEPTION 'request identity changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE admin_idempotency_keys SET status='completed'
     WHERE id='00000000-0000-0000-0000-000000000903';
    RAISE EXCEPTION 'completed without completed_at';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE admin_idempotency_keys
   SET status='completed', response_status=200,
       response_body='{"ok":true}', completed_at=now()
 WHERE id='00000000-0000-0000-0000-000000000903';
DO $$ BEGIN
  BEGIN
    UPDATE admin_idempotency_keys SET status='failed', completed_at=now()
     WHERE id='00000000-0000-0000-0000-000000000903';
    RAISE EXCEPTION 'completed key reopened';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- verification_results: 수신 키는 AI 전용이며 고유하다
DO $$ BEGIN
  BEGIN
    INSERT INTO verification_results
      (id,record_id,result_no,source,decision,criteria_version_id,
       reviewed_by_admin_id,reason,ingest_key)
    VALUES (gen_random_uuid(),gen_random_uuid(),1,'admin','approved',
            gen_random_uuid(),'00000000-0000-0000-0000-000000000902','r','k');
    RAISE EXCEPTION 'admin result accepted an ingest key';
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN NULL; END;
END $$;

-- 지급 재시도 상태는 존재하는 정산 항목을 가리켜야 한다
DO $$ BEGIN
  BEGIN
    INSERT INTO challenge_reward_payment_attempts(run_id,participation_id)
    VALUES (gen_random_uuid(),gen_random_uuid());
    RAISE EXCEPTION 'attempt row without settlement entry accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO challenge_reward_payment_attempts
      (run_id,participation_id,attempt_count)
    VALUES (gen_random_uuid(),gen_random_uuid(),1);
    RAISE EXCEPTION 'attempt count without attempt time accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 고유 인덱스·수정 금지 컬럼은 카탈로그로 확인 (전체 행 생성에는 002/003 픽스처 필요)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE indexname='verification_results_ingest_key_uq') THEN
    RAISE EXCEPTION 'ingest key unique index missing';
  END IF;
  IF pg_get_functiondef('protect_verification_result'::regproc)
       NOT LIKE '%ingest_key%' THEN
    RAISE EXCEPTION 'ingest key not protected from update';
  END IF;
END $$;
ROLLBACK;
