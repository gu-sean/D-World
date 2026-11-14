-- 연쇄 삭제·SET NULL 경로의 FK에 인덱스 추가 (구조·데이터 변경 없음)
-- 부모 행 삭제 때 자식 표 전체 스캔을 막는다. 부모가 삭제되지 않는 RESTRICT FK는 대상이 아니다.
BEGIN;

CREATE INDEX IF NOT EXISTS cdm_qualifying_record_fk_idx
    ON challenge_daily_missions (qualifying_record_id, mission_id);
CREATE INDEX IF NOT EXISTS css_participation_fk_idx
    ON challenge_score_snapshots (participation_id, challenge_id);
CREATE INDEX IF NOT EXISTS exp_tx_original_fk_idx
    ON experience_transactions (original_transaction_id, user_id);
CREATE INDEX IF NOT EXISTS exp_tx_user_pet_fk_idx
    ON experience_transactions (user_pet_id, user_id);
CREATE INDEX IF NOT EXISTS prc_mission_fk_idx
    ON point_recovery_claims (mission_id, user_id);
CREATE INDEX IF NOT EXISTS prc_original_award_fk_idx
    ON point_recovery_claims (original_award_transaction_id, user_id);
CREATE INDEX IF NOT EXISTS point_tx_original_fk_idx
    ON point_transactions (original_transaction_id, user_id);
CREATE INDEX IF NOT EXISTS profiles_rep_pet_fk_idx
    ON profiles (representative_pet_id, user_id);
CREATE INDEX IF NOT EXISTS shop_orders_refund_tx_fk_idx
    ON shop_orders (refund_transaction_id, user_id);
CREATE INDEX IF NOT EXISTS shop_orders_spend_tx_fk_idx
    ON shop_orders (spend_transaction_id, user_id);
CREATE INDEX IF NOT EXISTS streak_days_qualifying_mission_fk_idx
    ON streak_days (qualifying_mission_id, user_id);
CREATE INDEX IF NOT EXISTS inv_events_order_fk_idx
    ON user_inventory_events (order_id, user_id, item_id);

COMMIT;
