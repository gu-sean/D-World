-- 정리 (2026-11):
--   1) 추천 문구의 '매일'(weekday NULL)은 쓰지 않으므로 없애고, 요일을 필수로 바꾼다.
--      (홈 화면은 오늘 요일의 문구만 보여 주고, 없으면 기본 문구를 쓴다.)
--   2) 시행 시각이 2026-01-01 00:00(KST)인 정책 버전은 2026-11-01 00:00(KST)으로 맞춘다.
--      정책 버전 테이블은 추가만 허용하는 트리거가 있어 이 트랜잭션 안에서만 트리거를 끈다.
BEGIN;

DELETE FROM recommendation_messages WHERE weekday IS NULL;

ALTER TABLE recommendation_messages
    ALTER COLUMN weekday SET NOT NULL;

COMMENT ON COLUMN recommendation_messages.weekday IS
    '문구를 보여 줄 한국 요일(1=월 … 7=일). 필수.';

SET LOCAL session_replication_role = replica;

UPDATE achievement_versions              SET effective_at = '2026-11-01 00:00:00+09' WHERE effective_at = '2026-01-01 00:00:00+09';
UPDATE mission_reward_rate_versions      SET effective_at = '2026-11-01 00:00:00+09' WHERE effective_at = '2026-01-01 00:00:00+09';
UPDATE pet_level_policy_versions         SET effective_at = '2026-11-01 00:00:00+09' WHERE effective_at = '2026-01-01 00:00:00+09';
UPDATE pet_species_versions              SET effective_at = '2026-11-01 00:00:00+09' WHERE effective_at = '2026-01-01 00:00:00+09';
UPDATE policy_document_versions          SET effective_at = '2026-11-01 00:00:00+09' WHERE effective_at = '2026-01-01 00:00:00+09';
UPDATE shop_item_price_versions          SET effective_at = '2026-11-01 00:00:00+09' WHERE effective_at = '2026-01-01 00:00:00+09';
UPDATE streak_milestone_policy_versions  SET effective_at = '2026-11-01 00:00:00+09' WHERE effective_at = '2026-01-01 00:00:00+09';
UPDATE user_level_policy_versions        SET effective_at = '2026-11-01 00:00:00+09' WHERE effective_at = '2026-01-01 00:00:00+09';
UPDATE verification_criteria_versions    SET effective_at = '2026-11-01 00:00:00+09' WHERE effective_at = '2026-01-01 00:00:00+09';

COMMIT;
