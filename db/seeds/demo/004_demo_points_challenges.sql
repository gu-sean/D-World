-- 데모 보강 시드 2: 이광수(sd000002)의 챌린지 참여 상태와 포인트 거래 종류를 채운다.
-- 003_demo_coverage.sql 실행 후 사용. 새 행의 ID는 모두 'sdc'로 시작('sd' 접두어라 002 정리 스크립트가 함께 지운다).
--
--   챌린지 참여 : withdrawn · disqualified(관리자 조치 기록 포함) · failed(일별 미션 7일치 포함 → 정산 시연 가능)
--   포인트 거래 : manual_grant · manual_recovery · recovery · recovery_claim · recovery_settlement
--                 · recovery_cancel · reinstatement · refund · refund_offset · award_offset · auto_award
--   (이 시드가 끝난 뒤 가용 포인트 40, 미회수 포인트 0)
--
-- 실행: psql "$DATABASE_URL" -f db/seeds/demo/004_demo_points_challenges.sql
-- 주의: 001과 같이 트랜잭션 안에서만 session_replication_role = replica 로 트리거를 끈다.
--       시연용으로 만든 회수·복구 흐름이라 연결된 미션·성취·챌린지 보상 행의 상태는 일부러 바꾸지 않았다(미션 sd000011 지급만 '회수됨').

BEGIN;
SET LOCAL session_replication_role = replica;

-- 001 시드(또는 이미 있는 데모 데이터)의 행 ID는 환경마다 달라서 이광수의 기존 행을 찾아 쓴다.
CREATE TEMP TABLE _ref (k text PRIMARY KEY, v text NOT NULL) ON COMMIT DROP;
INSERT INTO _ref SELECT 'tx_m11', id FROM point_transactions WHERE user_id = 'sd000002' AND kind = 'auto_award' AND source_type = 'mission' AND source_id = 'sd000011';
INSERT INTO _ref SELECT 'tx_m10', id FROM point_transactions WHERE user_id = 'sd000002' AND kind = 'auto_award' AND source_type = 'mission' AND source_id = 'sd000010';
INSERT INTO _ref SELECT 'tx_m0z', id FROM point_transactions WHERE user_id = 'sd000002' AND kind = 'auto_award' AND source_type = 'mission' AND source_id = 'sd00000z';
INSERT INTO _ref SELECT 'ach', id FROM user_achievements WHERE user_id = 'sd000002' AND id LIKE 'sd%' ORDER BY id LIMIT 1;
INSERT INTO _ref SELECT 'tx_ach', t.id FROM point_transactions t WHERE t.user_id = 'sd000002' AND t.kind = 'auto_award' AND t.source_type = 'achievement' AND t.source_id = (SELECT v FROM _ref WHERE k = 'ach');
INSERT INTO _ref SELECT 'grant', g.id FROM challenge_reward_grants g JOIN challenge_participations p ON p.id = g.participation_id WHERE p.user_id = 'sd000002' AND g.id LIKE 'sd%' ORDER BY g.id LIMIT 1;
INSERT INTO _ref SELECT 'tx_ch', t.id FROM point_transactions t WHERE t.user_id = 'sd000002' AND t.kind = 'auto_award' AND t.source_type = 'challenge' AND t.source_id = (SELECT v FROM _ref WHERE k = 'grant');
INSERT INTO _ref SELECT 'ch_tpl', challenge_id FROM challenge_participations WHERE user_id = 'sd000002' AND status = 'enrolled' AND id LIKE 'sd%' ORDER BY id LIMIT 1;

-- ===== 챌린지 3개(지난 주차)와 참여 =====
INSERT INTO challenges (id, origin, created_by_user_id, created_by_admin_id, title, description, category_id, difficulty_id, verification_method, target_value, target_unit, estimated_duration_seconds, start_date, end_date, required_success_days, max_participants, publication_status, settlement_status, published_at, cancelled_at, created_at, updated_at, exercise_code)
SELECT x.id, c.origin, c.created_by_user_id, c.created_by_admin_id, x.title, x.descr, c.category_id, c.difficulty_id, 'camera', x.tv, x.tu, 300, x.sd, x.sd + 6, 5, NULL, 'public', 'not_started', x.sd::timestamptz - interval '3 days', NULL, x.sd::timestamptz - interval '3 days', x.sd::timestamptz - interval '3 days', x.ex
  FROM challenges c,
       (VALUES ('sdc00090', '11월 1주차 런지 챌린지', '일주일 동안 매일 런지 20개에 도전하세요. 5일 이상 성공하면 완주!', 20, 'reps', date '2026-11-01', 'lunge'),
               ('sdc00091', '11월 2주차 플랭크 챌린지', '일주일 동안 매일 플랭크 60초에 도전하세요. 5일 이상 성공하면 완주!', 60, 'seconds', date '2026-11-08', 'plank'),
               ('sdc00092', '10월 말 버피 챌린지', '일주일 동안 매일 버피 15개에 도전하세요. 5일 이상 성공하면 완주!', 15, 'reps', date '2026-10-25', 'burpee')) AS x(id, title, descr, tv, tu, sd, ex)
 WHERE c.id = (SELECT v FROM _ref WHERE k = 'ch_tpl');
INSERT INTO challenge_participations (id, challenge_id, user_id, status, joined_at, withdrawn_at, completed_at, updated_at) VALUES
 ('sdc00093', 'sdc00090', 'sd000002', 'withdrawn', timestamptz '2026-11-01 09:00:00+09', timestamptz '2026-11-03 21:00:00+09', NULL, timestamptz '2026-11-03 21:00:00+09'),
 ('sdc00094', 'sdc00091', 'sd000002', 'disqualified', timestamptz '2026-11-08 09:00:00+09', NULL, NULL, timestamptz '2026-11-12 15:00:00+09'),
 ('sdc00095', 'sdc00092', 'sd000002', 'failed', timestamptz '2026-10-25 09:00:00+09', NULL, NULL, timestamptz '2026-11-01 00:00:00+09');
INSERT INTO challenge_moderation_actions (id, participation_id, daily_mission_id, admin_id, action, reason, evidence_result_id, occurred_at)
VALUES ('sdc00096', 'sdc00094', NULL, 'sd000001', 'disqualify', '다른 사람의 영상을 도용한 정황이 있어 자격 박탈', NULL, timestamptz '2026-11-12 15:00:00+09');

-- 실패한 챌린지(10월 말 버피)의 일별 미션 7일치: 정산 초안·확정을 시연할 수 있게 한다.
INSERT INTO missions (id, user_id, goal_id, goal_step_id, definition_id, source_proposal_id, source_type, title, description, category_id, difficulty_id, target_value, target_unit, estimated_duration_seconds, verification_method, scheduled_date, due_at, is_required, status, memo, cancel_reason, cancelled_at, deleted_at, created_at, updated_at, exercise_code, reward_points, reward_user_xp, reward_pet_xp, reward_rate_version_id)
SELECT 'sdc0m00' || g, 'sd000002', NULL, NULL, NULL, NULL, 'challenge', '버피 15회', NULL, c.id, d.id, 15, 'reps', 300, 'camera', date '2026-10-25' + g, NULL, true, 'failed', NULL, NULL, NULL, NULL, timestamptz '2026-10-25 00:00:00+09', timestamptz '2026-11-01 00:00:00+09', 'burpee', 0, 0, 0,
       (SELECT r.id FROM mission_reward_rate_versions r WHERE r.category_id = c.id AND r.difficulty_id = d.id ORDER BY r.version_no DESC LIMIT 1)
  FROM goal_categories c, difficulty_levels d, generate_series(0, 6) AS g WHERE c.code = 'exercise' AND d.code = 'easy';
INSERT INTO challenge_daily_missions (id, participation_id, challenge_id, user_id, challenge_date, mission_id, status, qualifying_record_id, qualifying_result_id, judged_at, created_at, updated_at)
SELECT 'sdc0d00' || g, 'sdc00095', 'sdc00092', 'sd000002', date '2026-10-25' + g, 'sdc0m00' || g, 'failed', NULL, NULL, timestamptz '2026-11-01 00:00:00+09', timestamptz '2026-10-25 00:00:00+09', timestamptz '2026-11-01 00:00:00+09'
  FROM generate_series(0, 6) AS g;

-- ===== 새 미션 지급(award_offset 시연용): 푸쉬업 20회 승인 =====
INSERT INTO missions (id, user_id, goal_id, goal_step_id, definition_id, source_proposal_id, source_type, title, description, category_id, difficulty_id, target_value, target_unit, estimated_duration_seconds, verification_method, scheduled_date, due_at, is_required, status, memo, cancel_reason, cancelled_at, deleted_at, created_at, updated_at, exercise_code, reward_points, reward_user_xp, reward_pet_xp, reward_rate_version_id)
SELECT 'sdc00005', 'sd000002', NULL, NULL, NULL, NULL, 'user', '푸쉬업 20회', NULL, c.id, d.id, 20, 'reps', 300, 'camera', date '2026-11-18', NULL, true, 'completed', NULL, NULL, NULL, NULL, timestamptz '2026-11-18 13:00:00+09', timestamptz '2026-11-18 15:00:00+09', 'push_up', 30, 0, 30,
       (SELECT r.id FROM mission_reward_rate_versions r WHERE r.category_id = c.id AND r.difficulty_id = d.id ORDER BY r.version_no DESC LIMIT 1)
  FROM goal_categories c, difficulty_levels d WHERE c.code = 'exercise' AND d.code = 'easy';
INSERT INTO mission_records (id, mission_id, user_id, attempt_no, submission_no, status, evidence_kind, started_at, submitted_at, completed_at, metrics, reward_pet_id, reward_pet_stage_no, reward_pet_bonus_basis_points)
VALUES ('sdc00015', 'sdc00005', 'sd000002', 1, 1, 'approved', 'camera_media', timestamptz '2026-11-18 14:30:00+09', timestamptz '2026-11-18 14:45:00+09', timestamptz '2026-11-18 14:59:00+09', '{"reps":21,"detectionRate":0.9}'::jsonb, NULL, NULL, 0);
INSERT INTO verification_results (id, record_id, result_no, source, decision, criteria_version_id, engine_version, confidence, metrics, reason, reviewed_by_admin_id, is_current, decided_at, notified_at, ingest_key, raw_result)
SELECT 'sdc00023', 'sdc00015', 1, 'ai', 'approved', c.id, 'demo-engine-1.0', 0.9000, '{"reps":21}'::jsonb, '기준 충족', NULL, true, timestamptz '2026-11-18 14:59:00+09', timestamptz '2026-11-18 15:00:00+09', 'sd-ingest-sdc00023', NULL
  FROM verification_criteria_versions c WHERE c.verification_method = 'camera' ORDER BY c.version_no DESC LIMIT 1;
INSERT INTO mission_point_awards (mission_id, user_id, first_approved_result_id, original_points, paid_points, status, awarded_at, updated_at)
VALUES ('sdc00005', 'sd000002', 'sdc00023', 30, 30, 'active', timestamptz '2026-11-18 15:00:00+09', timestamptz '2026-11-18 15:00:00+09');
UPDATE mission_point_awards SET status = 'revoked', updated_at = timestamptz '2026-11-18 12:10:00+09' WHERE mission_id = 'sd000011' AND user_id = 'sd000002';

-- ===== 두 번째 취소 주문(환불 때 미회수 포인트를 먼저 정산하는 refund_offset 시연용) =====
INSERT INTO shop_orders (id, user_id, item_id, price_version_id, quantity, unit_points, status, spend_transaction_id, refund_transaction_id, cancel_reason, idempotency_key, created_at, cancelled_at)
SELECT 'sdc00075', 'sd000002', i.id, p.id, 1, 250, 'cancelled', 'sdc01002', 'sdc01013', '단순 변심', 'sdc:order:sdc00075', timestamptz '2026-11-18 11:40:00+09', timestamptz '2026-11-18 14:00:00+09'
  FROM shop_items i JOIN shop_item_price_versions p ON p.item_id = i.id WHERE i.code = 'pet_snack' AND p.price_points = 250 ORDER BY p.version_no DESC LIMIT 1;
INSERT INTO user_inventory_events (id, user_id, item_id, kind, quantity_delta, order_id, idempotency_key, occurred_at)
SELECT e.id, 'sd000002', i.id, e.kind, e.q, 'sdc00075', e.key, e.at
  FROM shop_items i,
       (VALUES ('sdc00076', 'purchase', 1, 'sdc:inv:purchase:sdc00075', timestamptz '2026-11-18 11:40:00+09'),
               ('sdc00077', 'refund', -1, 'sdc:inv:refund:sdc00075', timestamptz '2026-11-18 14:00:00+09')) AS e(id, kind, q, key, at)
 WHERE i.code = 'pet_snack';

-- ===== 포인트 회수 청구 4건 =====
INSERT INTO point_recovery_claims (id, user_id, mission_id, original_award_transaction_id, target_points, outstanding_points, settled_points, is_cancelled, created_at, cancelled_at, challenge_reward_grant_id, streak_milestone_award_id, user_achievement_id) VALUES
 ('sdc03001', 'sd000002', 'sd000011', (SELECT v FROM _ref WHERE k = 'tx_m11'), 20, 0, 20, false, timestamptz '2026-11-18 12:11:00+09', NULL, NULL, NULL, NULL),
 ('sdc03002', 'sd000002', 'sd00000z', (SELECT v FROM _ref WHERE k = 'tx_m0z'), 30, 0, 0, true, timestamptz '2026-11-18 13:20:00+09', timestamptz '2026-11-18 13:30:00+09', NULL, NULL, NULL),
 ('sdc03003', 'sd000002', NULL, (SELECT v FROM _ref WHERE k = 'tx_ach'), 100, 0, 100, false, timestamptz '2026-11-18 13:10:00+09', NULL, NULL, NULL, (SELECT v FROM _ref WHERE k = 'ach')),
 ('sdc03004', 'sd000002', NULL, (SELECT v FROM _ref WHERE k = 'tx_ch'), 90, 0, 90, false, timestamptz '2026-11-18 14:41:00+09', NULL, (SELECT v FROM _ref WHERE k = 'grant'), NULL, NULL);

-- ===== 포인트 거래: 잔액이 시간순으로 이어지도록 만든 21건 =====

-- 시드 보정: 이광수의 11:20 이전 잔액이 이 시드가 가정한 210이 아니면(001 시드 버전이 다른 DB) 차이만큼 관리자 조정을 넣어 맞춘다.
INSERT INTO point_transactions (id, user_id, kind, available_delta, outstanding_delta, balance_after, outstanding_after, source_type, source_id, original_transaction_id, recovery_claim_id, cap_month, cap_delta, idempotency_key, created_by_admin_id, reason, occurred_at)
SELECT 'sdc01000', 'sd000002', CASE WHEN x.d > 0 THEN 'manual_recovery' ELSE 'manual_grant' END, -x.d, 0, 0, 0, 'admin_adjustment', 'sdc02000', NULL, NULL, NULL, 0, 'sdc:pt:sdc01000', 'sd000001', '데모 시드 잔액 보정', timestamptz '2026-11-18 11:20:00+09'
  FROM (SELECT coalesce(sum(available_delta), 0) - 210 AS d FROM point_transactions WHERE user_id = 'sd000002' AND occurred_at < timestamptz '2026-11-18 11:20:00+09') x
 WHERE x.d <> 0;

INSERT INTO point_transactions (id, user_id, kind, available_delta, outstanding_delta, balance_after, outstanding_after, source_type, source_id, original_transaction_id, recovery_claim_id, cap_month, cap_delta, idempotency_key, created_by_admin_id, reason, occurred_at) VALUES
 ('sdc01001', 'sd000002', 'manual_grant', 100, 0, 310, 0, 'admin_adjustment', 'sdc02001', NULL, NULL, NULL, 0, 'sdc:pt:sdc01001', 'sd000001', '데모 이벤트 추가 보상', timestamptz '2026-11-18 11:30:00+09'),
 ('sdc01002', 'sd000002', 'spend', -250, 0, 60, 0, 'shop_order', 'sdc00075', NULL, NULL, NULL, 0, 'sdc:pt:sdc01002', NULL, NULL, timestamptz '2026-11-18 11:40:00+09'),
 ('sdc01003', 'sd000002', 'manual_recovery', -50, 0, 10, 0, 'admin_adjustment', 'sdc02002', NULL, NULL, NULL, 0, 'sdc:pt:sdc01003', 'sd000001', '중복 지급된 포인트 회수', timestamptz '2026-11-18 12:00:00+09'),
 ('sdc01004', 'sd000002', 'recovery', -10, 0, 0, 0, 'mission', 'sd000011', (SELECT v FROM _ref WHERE k = 'tx_m11'), NULL, date '2026-11-01', -10, 'sdc:pt:sdc01004', NULL, NULL, timestamptz '2026-11-18 12:10:00+09'),
 ('sdc01005', 'sd000002', 'recovery_claim', 0, 20, 0, 20, 'mission', 'sd000011', (SELECT v FROM _ref WHERE k = 'tx_m11'), 'sdc03001', NULL, 0, 'sdc:pt:sdc01005', NULL, NULL, timestamptz '2026-11-18 12:11:00+09'),
 ('sdc01006', 'sd000002', 'manual_grant', 50, 0, 50, 20, 'admin_adjustment', 'sdc02003', NULL, NULL, NULL, 0, 'sdc:pt:sdc01006', 'sd000001', '데모 이벤트 참여 보상', timestamptz '2026-11-18 12:30:00+09'),
 ('sdc01007', 'sd000002', 'recovery_settlement', -20, -20, 30, 0, 'admin_adjustment', 'sdc02003', NULL, 'sdc03001', NULL, 0, 'sdc:pt:sdc01007', 'sd000001', '데모 이벤트 참여 보상', timestamptz '2026-11-18 12:31:00+09'),
 ('sdc01008', 'sd000002', 'recovery', -30, 0, 0, 0, 'mission', 'sd000010', (SELECT v FROM _ref WHERE k = 'tx_m10'), NULL, date '2026-11-01', -30, 'sdc:pt:sdc01008', NULL, NULL, timestamptz '2026-11-18 13:00:00+09'),
 ('sdc01009', 'sd000002', 'recovery_claim', 0, 100, 0, 100, 'achievement', (SELECT v FROM _ref WHERE k = 'ach'), (SELECT v FROM _ref WHERE k = 'tx_ach'), 'sdc03003', NULL, 0, 'sdc:pt:sdc01009', NULL, NULL, timestamptz '2026-11-18 13:10:00+09'),
 ('sdc01010', 'sd000002', 'recovery_claim', 0, 30, 0, 130, 'mission', 'sd00000z', (SELECT v FROM _ref WHERE k = 'tx_m0z'), 'sdc03002', NULL, 0, 'sdc:pt:sdc01010', NULL, NULL, timestamptz '2026-11-18 13:20:00+09'),
 ('sdc01011', 'sd000002', 'recovery_cancel', 0, -30, 0, 100, 'mission', 'sd00000z', NULL, 'sdc03002', NULL, 0, 'sdc:pt:sdc01011', NULL, NULL, timestamptz '2026-11-18 13:30:00+09'),
 ('sdc01012', 'sd000002', 'reinstatement', 30, 0, 30, 100, 'mission', 'sd000010', 'sdc01008', NULL, date '2026-11-01', 30, 'sdc:pt:sdc01012', NULL, NULL, timestamptz '2026-11-18 13:40:00+09'),
 ('sdc01013', 'sd000002', 'refund', 250, 0, 280, 100, 'shop_order', 'sdc00075', 'sdc01002', NULL, NULL, 0, 'sdc:pt:sdc01013', NULL, NULL, timestamptz '2026-11-18 14:00:00+09'),
 ('sdc01014', 'sd000002', 'refund_offset', -100, -100, 180, 0, 'shop_order', 'sdc00075', NULL, 'sdc03003', NULL, 0, 'sdc:pt:sdc01014', NULL, NULL, timestamptz '2026-11-18 14:01:00+09'),
 ('sdc01015', 'sd000002', 'manual_recovery', -170, 0, 10, 0, 'admin_adjustment', 'sdc02004', NULL, NULL, NULL, 0, 'sdc:pt:sdc01015', 'sd000001', '오지급 포인트 회수', timestamptz '2026-11-18 14:30:00+09'),
 ('sdc01016', 'sd000002', 'recovery', -10, 0, 0, 0, 'challenge', (SELECT v FROM _ref WHERE k = 'grant'), (SELECT v FROM _ref WHERE k = 'tx_ch'), NULL, NULL, 0, 'sdc:pt:sdc01016', NULL, NULL, timestamptz '2026-11-18 14:40:00+09'),
 ('sdc01017', 'sd000002', 'recovery_claim', 0, 90, 0, 90, 'challenge', (SELECT v FROM _ref WHERE k = 'grant'), (SELECT v FROM _ref WHERE k = 'tx_ch'), 'sdc03004', NULL, 0, 'sdc:pt:sdc01017', NULL, NULL, timestamptz '2026-11-18 14:41:00+09'),
 ('sdc01018', 'sd000002', 'auto_award', 30, 0, 30, 90, 'mission', 'sdc00005', NULL, NULL, date '2026-11-01', 30, 'sdc:pt:sdc01018', NULL, NULL, timestamptz '2026-11-18 15:00:00+09'),
 ('sdc01019', 'sd000002', 'award_offset', -30, -30, 0, 60, 'mission', 'sdc00005', NULL, 'sdc03004', NULL, 0, 'sdc:pt:sdc01019', NULL, NULL, timestamptz '2026-11-18 15:01:00+09'),
 ('sdc01020', 'sd000002', 'manual_grant', 100, 0, 100, 60, 'admin_adjustment', 'sdc02005', NULL, NULL, NULL, 0, 'sdc:pt:sdc01020', 'sd000001', '데모 이벤트 추가 보상', timestamptz '2026-11-18 15:30:00+09'),
 ('sdc01021', 'sd000002', 'recovery_settlement', -60, -60, 40, 0, 'admin_adjustment', 'sdc02005', NULL, 'sdc03004', NULL, 0, 'sdc:pt:sdc01021', 'sd000001', '데모 이벤트 추가 보상', timestamptz '2026-11-18 15:31:00+09');

-- 거래마다 거래 후 잔액을 시간순 누적으로 다시 계산해 원장이 항상 이어지게 한다.
UPDATE point_transactions t
   SET balance_after = x.cb, outstanding_after = x.co
  FROM (SELECT id, sum(available_delta) OVER (ORDER BY occurred_at, id) AS cb, sum(outstanding_delta) OVER (ORDER BY occurred_at, id) AS co
          FROM point_transactions WHERE user_id = 'sd000002') x
 WHERE t.id = x.id AND t.user_id = 'sd000002';
UPDATE point_wallets w SET available_points = x.a, outstanding_recovery_points = x.o, updated_at = timestamptz '2026-11-18 15:31:00+09'
  FROM (SELECT coalesce(sum(available_delta), 0) AS a, coalesce(sum(outstanding_delta), 0) AS o FROM point_transactions WHERE user_id = 'sd000002') x
 WHERE w.user_id = 'sd000002';
-- 이번 달 한도: 지급 +30(미션 sdc00005), 같은 달 회수 순 10(=10+30-30)
UPDATE point_monthly_usage
   SET gross_auto_awarded_points = gross_auto_awarded_points + 30,
       same_month_recovered_points = same_month_recovered_points + 10,
       updated_at = timestamptz '2026-11-18 15:31:00+09'
 WHERE user_id = 'sd000002' AND month_start_date = date '2026-11-01';

COMMIT;
