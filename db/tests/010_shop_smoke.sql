-- smoke 010, 샘플 데이터는 롤백
BEGIN;
INSERT INTO users(id) VALUES ('00000000-0000-0000-0000-000000001001');
INSERT INTO admin_accounts(id,login_id,email,password_hash) VALUES
 ('00000000-0000-0000-0000-000000001002','owner10','owner10@example.com','hash');
INSERT INTO shop_items(id,code,name,item_kind) VALUES
 ('00000000-0000-0000-0000-000000001003','snack10','간식10','consumable');
INSERT INTO shop_item_price_versions
 (id,item_id,version_no,price_points,effective_at,created_by_admin_id) VALUES
 ('00000000-0000-0000-0000-000000001004','00000000-0000-0000-0000-000000001003',
  1,100,now()-interval '1 day','00000000-0000-0000-0000-000000001002');
INSERT INTO point_wallets(user_id,available_points)
VALUES ('00000000-0000-0000-0000-000000001001',1000);

-- 가격 버전은 수정할 수 없다
DO $$ BEGIN
  BEGIN
    UPDATE shop_item_price_versions SET price_points=1
     WHERE id='00000000-0000-0000-0000-000000001004';
    RAISE EXCEPTION 'price version changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 주문 1: 100 P 사용
UPDATE point_wallets SET available_points=900
 WHERE user_id='00000000-0000-0000-0000-000000001001';
INSERT INTO point_transactions
 (id,user_id,kind,available_delta,balance_after,outstanding_after,
  source_type,source_id,idempotency_key)
VALUES ('00000000-0000-0000-0000-000000001011','00000000-0000-0000-0000-000000001001',
  'spend',-100,900,0,'shop_order','00000000-0000-0000-0000-000000001010','sp-1');

-- 단가는 가격 버전과 일치해야 한다
DO $$ BEGIN
  BEGIN
    INSERT INTO shop_orders(id,user_id,item_id,price_version_id,quantity,unit_points,
        spend_transaction_id,idempotency_key)
    VALUES ('00000000-0000-0000-0000-000000001010','00000000-0000-0000-0000-000000001001',
        '00000000-0000-0000-0000-000000001003','00000000-0000-0000-0000-000000001004',
        1,50,'00000000-0000-0000-0000-000000001011','o-1');
    RAISE EXCEPTION 'wrong unit price accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

INSERT INTO shop_orders(id,user_id,item_id,price_version_id,quantity,unit_points,
    spend_transaction_id,idempotency_key)
VALUES ('00000000-0000-0000-0000-000000001010','00000000-0000-0000-0000-000000001001',
    '00000000-0000-0000-0000-000000001003','00000000-0000-0000-0000-000000001004',
    1,100,'00000000-0000-0000-0000-000000001011','o-1');

-- 중복 요청 키는 거부
DO $$ BEGIN
  BEGIN
    UPDATE point_wallets SET available_points=800
     WHERE user_id='00000000-0000-0000-0000-000000001001';
    INSERT INTO point_transactions
     (id,user_id,kind,available_delta,balance_after,outstanding_after,
      source_type,source_id,idempotency_key)
    VALUES ('00000000-0000-0000-0000-000000001041',
      '00000000-0000-0000-0000-000000001001','spend',-100,800,0,'shop_order',
      '00000000-0000-0000-0000-000000001040','sp-dup');
    INSERT INTO shop_orders(id,user_id,item_id,price_version_id,quantity,unit_points,
        spend_transaction_id,idempotency_key)
    VALUES ('00000000-0000-0000-0000-000000001040',
        '00000000-0000-0000-0000-000000001001',
        '00000000-0000-0000-0000-000000001003','00000000-0000-0000-0000-000000001004',
        1,100,'00000000-0000-0000-0000-000000001041','o-1');
    RAISE EXCEPTION 'duplicate order key accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;

-- 재고: 구매 +1, 사용 -1, 한 번 더 사용하면 0 미만
INSERT INTO user_inventory_events
 (id,user_id,item_id,kind,quantity_delta,order_id,idempotency_key) VALUES
 ('00000000-0000-0000-0000-000000001021','00000000-0000-0000-0000-000000001001',
  '00000000-0000-0000-0000-000000001003','purchase',1,
  '00000000-0000-0000-0000-000000001010','inv-1');
INSERT INTO user_inventory_events
 (id,user_id,item_id,kind,quantity_delta,idempotency_key) VALUES
 ('00000000-0000-0000-0000-000000001022','00000000-0000-0000-0000-000000001001',
  '00000000-0000-0000-0000-000000001003','use',-1,'inv-2');
DO $$ BEGIN
  IF (SELECT quantity FROM user_inventory
       WHERE user_id='00000000-0000-0000-0000-000000001001') <> 0 THEN
    RAISE EXCEPTION 'inventory not updated by events';
  END IF;
  BEGIN
    INSERT INTO user_inventory_events
     (id,user_id,item_id,kind,quantity_delta,idempotency_key) VALUES
     (gen_random_uuid(),'00000000-0000-0000-0000-000000001001',
      '00000000-0000-0000-0000-000000001003','use',-1,'inv-3');
    RAISE EXCEPTION 'negative inventory accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE user_inventory_events SET quantity_delta=-2
     WHERE id='00000000-0000-0000-0000-000000001022';
    RAISE EXCEPTION 'inventory event changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 주문 2(2개, 200 P) 후 환불
UPDATE point_wallets SET available_points=700
 WHERE user_id='00000000-0000-0000-0000-000000001001';
INSERT INTO point_transactions
 (id,user_id,kind,available_delta,balance_after,outstanding_after,
  source_type,source_id,idempotency_key)
VALUES ('00000000-0000-0000-0000-000000001031','00000000-0000-0000-0000-000000001001',
  'spend',-200,700,0,'shop_order','00000000-0000-0000-0000-000000001030','sp-2');
INSERT INTO shop_orders(id,user_id,item_id,price_version_id,quantity,unit_points,
    spend_transaction_id,idempotency_key)
VALUES ('00000000-0000-0000-0000-000000001030','00000000-0000-0000-0000-000000001001',
    '00000000-0000-0000-0000-000000001003','00000000-0000-0000-0000-000000001004',
    2,100,'00000000-0000-0000-0000-000000001031','o-2');
INSERT INTO user_inventory_events
 (id,user_id,item_id,kind,quantity_delta,order_id,idempotency_key) VALUES
 ('00000000-0000-0000-0000-000000001023','00000000-0000-0000-0000-000000001001',
  '00000000-0000-0000-0000-000000001003','purchase',2,
  '00000000-0000-0000-0000-000000001030','inv-4');

UPDATE point_wallets SET available_points=900
 WHERE user_id='00000000-0000-0000-0000-000000001001';
INSERT INTO point_transactions
 (id,user_id,kind,available_delta,balance_after,outstanding_after,
  source_type,source_id,original_transaction_id,idempotency_key)
VALUES ('00000000-0000-0000-0000-000000001032','00000000-0000-0000-0000-000000001001',
  'refund',200,900,0,'shop_order','00000000-0000-0000-0000-000000001030',
  '00000000-0000-0000-0000-000000001031','rf-2');

-- 다른 거래를 가리키는 환불은 거부
DO $$ BEGIN
  BEGIN
    UPDATE shop_orders SET status='cancelled', cancelled_at=now(),
        cancel_reason='mistake',
        refund_transaction_id='00000000-0000-0000-0000-000000001011'
     WHERE id='00000000-0000-0000-0000-000000001030';
    RAISE EXCEPTION 'wrong refund transaction accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

UPDATE shop_orders SET status='cancelled', cancelled_at=now(),
    cancel_reason='mistake',
    refund_transaction_id='00000000-0000-0000-0000-000000001032'
 WHERE id='00000000-0000-0000-0000-000000001030';
INSERT INTO user_inventory_events
 (id,user_id,item_id,kind,quantity_delta,order_id,idempotency_key) VALUES
 ('00000000-0000-0000-0000-000000001024','00000000-0000-0000-0000-000000001001',
  '00000000-0000-0000-0000-000000001003','refund',-2,
  '00000000-0000-0000-0000-000000001030','inv-5');

DO $$ BEGIN
  BEGIN
    UPDATE shop_orders SET cancel_reason='changed'
     WHERE id='00000000-0000-0000-0000-000000001030';
    RAISE EXCEPTION 'cancelled order changed';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
ROLLBACK;
