-- 시행 시각 조정 (2026-11): 2026-11-01 00:00(KST)로 맞춘 정책 버전을 2026-09-01 00:00(KST)로 옮긴다.
-- 정책 버전 테이블은 추가만 허용하는 트리거가 있어 이 트랜잭션 안에서만 트리거를 끈다.
BEGIN;

SET LOCAL session_replication_role = replica;

UPDATE achievement_versions              SET effective_at = '2026-09-01 00:00:00+09' WHERE effective_at = '2026-11-01 00:00:00+09';
UPDATE mission_reward_rate_versions      SET effective_at = '2026-09-01 00:00:00+09' WHERE effective_at = '2026-11-01 00:00:00+09';
UPDATE pet_level_policy_versions         SET effective_at = '2026-09-01 00:00:00+09' WHERE effective_at = '2026-11-01 00:00:00+09';
UPDATE pet_species_versions              SET effective_at = '2026-09-01 00:00:00+09' WHERE effective_at = '2026-11-01 00:00:00+09';
UPDATE policy_document_versions          SET effective_at = '2026-09-01 00:00:00+09' WHERE effective_at = '2026-11-01 00:00:00+09';
UPDATE shop_item_price_versions          SET effective_at = '2026-09-01 00:00:00+09' WHERE effective_at = '2026-11-01 00:00:00+09';
UPDATE streak_milestone_policy_versions  SET effective_at = '2026-09-01 00:00:00+09' WHERE effective_at = '2026-11-01 00:00:00+09';
UPDATE user_level_policy_versions        SET effective_at = '2026-09-01 00:00:00+09' WHERE effective_at = '2026-11-01 00:00:00+09';
UPDATE verification_criteria_versions    SET effective_at = '2026-09-01 00:00:00+09' WHERE effective_at = '2026-11-01 00:00:00+09';

COMMIT;
