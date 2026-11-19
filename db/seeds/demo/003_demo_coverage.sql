-- 데모 보강 시드: 이광수(sd000002) 계정에 '종류별 1건씩' 빠진 데이터를 채운다.
-- 001_demo_week.sql 실행 후 사용. 새 행의 ID는 모두 'sdc'로 시작('sd' 접두어라 002 정리 스크립트가 함께 지운다).
--
--   미션 상태      : in_progress(중단된 기록 포함) · submitted · failed(센서)
--   인증 기록 상태 : aborted · superseded · submitted · rejected(sensor_raw 증거)
--   문의/신고      : 처리 중(in_review) · 문의 분류 account/mission/challenge/other
--                    · 신고 분류 abuse/cheating/impersonation, 대상 user/mission_definition
--   계정 조치      : 경고 · 자연 만료된 이용 제한 · 중간에 해제된 이용 제한
--   탈퇴 요청      : 취소(cancelled)
--   펫             : 1단계(알)
--   상점 주문      : 취소(cancelled) + 환불 포인트·재고 되돌림(총 포인트는 그대로)
--
-- 실행: psql "$DATABASE_URL" -f db/seeds/demo/003_demo_coverage.sql
-- 주의: 001과 같이 트랜잭션 안에서만 session_replication_role = replica 로 트리거를 끈다.
--       영상·센서 원본 파일은 만들지 않는다(메타데이터만).

BEGIN;
SET LOCAL session_replication_role = replica;

-- ===== 미션 (이광수) =====
-- in_progress: 시작했다가 중단한(aborted) 기록만 있는 미션
INSERT INTO missions (id, user_id, goal_id, goal_step_id, definition_id, source_proposal_id, source_type, title, description, category_id, difficulty_id, target_value, target_unit, estimated_duration_seconds, verification_method, scheduled_date, due_at, is_required, status, memo, cancel_reason, cancelled_at, deleted_at, created_at, updated_at, exercise_code, reward_points, reward_user_xp, reward_pet_xp, reward_rate_version_id)
SELECT 'sdc00001', 'sd000002', NULL, NULL, NULL, NULL, 'user', '플랭크 90초', NULL, c.id, d.id, 90, 'seconds', 180, 'camera', date '2026-11-19', NULL, true, 'in_progress', NULL, NULL, NULL, NULL, timestamptz '2026-11-18 20:00:00+09', timestamptz '2026-11-19 07:10:00+09', 'plank', 30, 0, 30,
       (SELECT r.id FROM mission_reward_rate_versions r WHERE r.category_id = c.id AND r.difficulty_id = d.id ORDER BY r.version_no DESC LIMIT 1)
  FROM goal_categories c, difficulty_levels d WHERE c.code = 'exercise' AND d.code = 'easy';
-- submitted: 첫 제출이 거절돼 다시 제출(superseded → submitted)
INSERT INTO missions (id, user_id, goal_id, goal_step_id, definition_id, source_proposal_id, source_type, title, description, category_id, difficulty_id, target_value, target_unit, estimated_duration_seconds, verification_method, scheduled_date, due_at, is_required, status, memo, cancel_reason, cancelled_at, deleted_at, created_at, updated_at, exercise_code, reward_points, reward_user_xp, reward_pet_xp, reward_rate_version_id)
SELECT 'sdc00002', 'sd000002', NULL, NULL, NULL, NULL, 'user', '스쿼트 40회', NULL, c.id, d.id, 40, 'reps', 300, 'camera', date '2026-11-19', NULL, true, 'submitted', NULL, NULL, NULL, NULL, timestamptz '2026-11-18 20:05:00+09', timestamptz '2026-11-19 08:30:00+09', 'squat', 30, 0, 30,
       (SELECT r.id FROM mission_reward_rate_versions r WHERE r.category_id = c.id AND r.difficulty_id = d.id ORDER BY r.version_no DESC LIMIT 1)
  FROM goal_categories c, difficulty_levels d WHERE c.code = 'exercise' AND d.code = 'easy';
-- failed(센서): 센서 원본(sensor_raw)으로 제출했지만 거절
INSERT INTO missions (id, user_id, goal_id, goal_step_id, definition_id, source_proposal_id, source_type, title, description, category_id, difficulty_id, target_value, target_unit, estimated_duration_seconds, verification_method, scheduled_date, due_at, is_required, status, memo, cancel_reason, cancelled_at, deleted_at, created_at, updated_at, exercise_code, reward_points, reward_user_xp, reward_pet_xp, reward_rate_version_id)
SELECT 'sdc00003', 'sd000002', NULL, NULL, NULL, NULL, 'user', '러닝 3km', NULL, c.id, d.id, 3000, 'meters', 1200, 'sensor', date '2026-11-18', NULL, true, 'failed', NULL, NULL, NULL, NULL, timestamptz '2026-11-17 20:00:00+09', timestamptz '2026-11-19 00:10:00+09', 'running', 30, 0, 30,
       (SELECT r.id FROM mission_reward_rate_versions r WHERE r.category_id = c.id AND r.difficulty_id = d.id ORDER BY r.version_no DESC LIMIT 1)
  FROM goal_categories c, difficulty_levels d WHERE c.code = 'exercise' AND d.code = 'normal';

-- ===== 인증 기록 =====
-- aborted: 제출 전에 중단(제출 회차 번호·증거 종류 없음)
INSERT INTO mission_records (id, mission_id, user_id, attempt_no, submission_no, status, evidence_kind, started_at, submitted_at, completed_at, metrics, reward_pet_id, reward_pet_stage_no, reward_pet_bonus_basis_points)
VALUES ('sdc00011', 'sdc00001', 'sd000002', 1, NULL, 'aborted', NULL, timestamptz '2026-11-19 07:00:00+09', NULL, NULL, NULL, NULL, NULL, 0);
-- superseded: 거절된 첫 제출(재제출로 대체됨)
INSERT INTO mission_records (id, mission_id, user_id, attempt_no, submission_no, status, evidence_kind, started_at, submitted_at, completed_at, metrics, reward_pet_id, reward_pet_stage_no, reward_pet_bonus_basis_points)
VALUES ('sdc00012', 'sdc00002', 'sd000002', 1, 1, 'superseded', 'camera_media', timestamptz '2026-11-18 20:10:00+09', timestamptz '2026-11-18 20:20:00+09', timestamptz '2026-11-18 20:22:00+09', '{"reps":18,"detectionRate":0.41}'::jsonb, NULL, NULL, 0);
-- submitted: 다시 제출했고 판정 전
INSERT INTO mission_records (id, mission_id, user_id, attempt_no, submission_no, status, evidence_kind, started_at, submitted_at, completed_at, metrics, reward_pet_id, reward_pet_stage_no, reward_pet_bonus_basis_points)
VALUES ('sdc00013', 'sdc00002', 'sd000002', 2, 2, 'submitted', 'camera_media', timestamptz '2026-11-19 08:00:00+09', timestamptz '2026-11-19 08:20:00+09', NULL, '{"reps":40,"detectionRate":0.9}'::jsonb, NULL, NULL, 0);
-- rejected + sensor_raw: 센서 원본 증거를 거절
INSERT INTO mission_records (id, mission_id, user_id, attempt_no, submission_no, status, evidence_kind, started_at, submitted_at, completed_at, metrics, reward_pet_id, reward_pet_stage_no, reward_pet_bonus_basis_points)
VALUES ('sdc00014', 'sdc00003', 'sd000002', 1, 1, 'rejected', 'sensor_raw', timestamptz '2026-11-18 06:30:00+09', timestamptz '2026-11-18 07:05:00+09', timestamptz '2026-11-18 07:06:00+09', '{"distanceMeters":2100,"durationSeconds":1500}'::jsonb, NULL, NULL, 0);

INSERT INTO verification_results (id, record_id, result_no, source, decision, criteria_version_id, engine_version, confidence, metrics, reason, reviewed_by_admin_id, is_current, decided_at, notified_at, ingest_key, raw_result)
SELECT 'sdc00021', 'sdc00012', 1, 'ai', 'rejected', c.id, 'demo-engine-1.0', 0.4100, '{"reps":18}'::jsonb, '목표 횟수에 미달', NULL, true, timestamptz '2026-11-18 20:22:00+09', timestamptz '2026-11-18 20:23:00+09', 'sd-ingest-sdc00021', NULL
  FROM verification_criteria_versions c WHERE c.verification_method = 'camera' ORDER BY c.version_no DESC LIMIT 1;
INSERT INTO verification_results (id, record_id, result_no, source, decision, criteria_version_id, engine_version, confidence, metrics, reason, reviewed_by_admin_id, is_current, decided_at, notified_at, ingest_key, raw_result)
SELECT 'sdc00022', 'sdc00014', 1, 'ai', 'rejected', c.id, 'demo-engine-1.0', 0.7000, '{"distanceMeters":2100}'::jsonb, '목표 거리 3km에 미달', NULL, true, timestamptz '2026-11-18 07:06:00+09', timestamptz '2026-11-18 07:07:00+09', 'sd-ingest-sdc00022', NULL
  FROM verification_criteria_versions c WHERE c.verification_method = 'sensor' ORDER BY c.version_no DESC LIMIT 1;

-- ===== 문의·신고 (이광수가 접수) =====
INSERT INTO support_tickets (id, ticket_type, category, reporter_user_id, subject, body, target_user_id, target_mission_definition_id, target_challenge_id, target_kind, status, assigned_admin_id, received_at, completed_at) VALUES
 ('sdc00031', 'inquiry', 'account', 'sd000002', '닉네임을 바꾸고 싶어요', '가입할 때 정한 닉네임을 변경할 수 있나요?', NULL, NULL, NULL, NULL, 'in_review', 'sd000001', timestamptz '2026-11-19 09:00:00+09', NULL),
 ('sdc00032', 'inquiry', 'mission', 'sd000002', '미션 일정이 사라졌어요', '어제 추가한 미션이 오늘 목록에 보이지 않습니다.', NULL, NULL, NULL, NULL, 'received', NULL, timestamptz '2026-11-19 09:10:00+09', NULL),
 ('sdc00033', 'inquiry', 'challenge', 'sd000002', '챌린지 순위 기준이 궁금해요', '점수가 같을 때 순위가 어떻게 정해지나요?', NULL, NULL, NULL, NULL, 'completed', 'sd000001', timestamptz '2026-11-18 11:00:00+09', timestamptz '2026-11-18 11:40:00+09'),
 ('sdc00034', 'inquiry', 'other', 'sd000002', '앱 사용 팁이 있나요', '운동 기록을 꾸준히 이어가는 방법을 알려 주세요.', NULL, NULL, NULL, NULL, 'received', NULL, timestamptz '2026-11-19 09:20:00+09', NULL),
 ('sdc00035', 'report', 'abuse', 'sd000002', '챌린지 채팅 욕설 신고', '다른 참여자가 불쾌한 표현을 사용했습니다.', 'sd000003', NULL, NULL, 'user', 'in_review', 'sd000001', timestamptz '2026-11-19 09:30:00+09', NULL),
 ('sdc00036', 'report', 'cheating', 'sd000002', '부정 의심 미션', '실제로 수행하기 어려운 목표라 의심됩니다.', NULL, 'sd00000t', NULL, 'mission_definition', 'received', NULL, timestamptz '2026-11-19 09:40:00+09', NULL),
 ('sdc00037', 'report', 'impersonation', 'sd000002', '사칭 계정 신고', '운영자를 사칭하는 계정이 있습니다.', 'sd000004', NULL, NULL, 'user', 'completed', 'sd000001', timestamptz '2026-11-18 12:00:00+09', timestamptz '2026-11-18 13:00:00+09');
INSERT INTO support_ticket_events (id, ticket_id, admin_id, event_type, visibility, body, created_at) VALUES
 ('sdc00041', 'sdc00031', NULL, 'received', 'user', NULL, timestamptz '2026-11-19 09:00:00+09'),
 ('sdc00042', 'sdc00031', 'sd000001', 'assigned', 'internal', NULL, timestamptz '2026-11-19 09:15:00+09'),
 ('sdc00043', 'sdc00031', 'sd000001', 'note', 'internal', '닉네임 변경 정책 확인 후 답변 예정', timestamptz '2026-11-19 09:16:00+09'),
 ('sdc00044', 'sdc00032', NULL, 'received', 'user', NULL, timestamptz '2026-11-19 09:10:00+09'),
 ('sdc00045', 'sdc00033', NULL, 'received', 'user', NULL, timestamptz '2026-11-18 11:00:00+09'),
 ('sdc00046', 'sdc00033', 'sd000001', 'assigned', 'internal', NULL, timestamptz '2026-11-18 11:10:00+09'),
 ('sdc00047', 'sdc00033', 'sd000001', 'reply', 'user', '점수가 같으면 같은 순위로 표시되고 다음 순위는 건너뜁니다.', timestamptz '2026-11-18 11:40:00+09'),
 ('sdc00048', 'sdc00034', NULL, 'received', 'user', NULL, timestamptz '2026-11-19 09:20:00+09'),
 ('sdc00049', 'sdc00035', NULL, 'received', 'user', NULL, timestamptz '2026-11-19 09:30:00+09'),
 ('sdc0004a', 'sdc00035', 'sd000001', 'assigned', 'internal', NULL, timestamptz '2026-11-19 09:35:00+09'),
 ('sdc0004b', 'sdc00036', NULL, 'received', 'user', NULL, timestamptz '2026-11-19 09:40:00+09'),
 ('sdc0004c', 'sdc00037', NULL, 'received', 'user', NULL, timestamptz '2026-11-18 12:00:00+09'),
 ('sdc0004d', 'sdc00037', 'sd000001', 'assigned', 'internal', NULL, timestamptz '2026-11-18 12:10:00+09'),
 ('sdc0004e', 'sdc00037', 'sd000001', 'reply', 'user', '확인 결과 사칭 계정에 조치했습니다. 신고 감사합니다.', timestamptz '2026-11-18 13:00:00+09');

-- ===== 계정 조치·탈퇴 요청 (이광수) =====
INSERT INTO account_actions (id, user_id, admin_id, action_type, reason, starts_at, ends_at, lifted_at, created_at) VALUES
 ('sdc00051', 'sd000002', 'sd000001', 'warning', '챌린지 영상 화질이 낮아 재촬영 안내', timestamptz '2026-11-12 10:00:00+09', NULL, NULL, timestamptz '2026-11-12 10:00:00+09'),
 ('sdc00052', 'sd000002', 'sd000001', 'restriction', '부적절한 문구 신고가 접수되어 이틀간 이용 제한', timestamptz '2026-11-13 09:00:00+09', timestamptz '2026-11-15 09:00:00+09', NULL, timestamptz '2026-11-13 09:00:00+09'),
 ('sdc00053', 'sd000002', 'sd000001', 'restriction', '신고 내용 확인 중 임시 이용 제한', timestamptz '2026-11-16 09:00:00+09', timestamptz '2026-11-23 09:00:00+09', timestamptz '2026-11-16 15:00:00+09', timestamptz '2026-11-16 09:00:00+09');
INSERT INTO account_withdrawal_requests (id, user_id, status, requested_at, reviewed_by, reviewed_at, reason, completed_at)
VALUES ('sdc00054', 'sd000002', 'cancelled', timestamptz '2026-11-14 22:00:00+09', NULL, NULL, '잠시 쉬려다 마음을 바꿈', NULL);

-- ===== 펫: 1단계(알) =====
INSERT INTO user_pets (id, user_id, species_id, species_version_id, level_policy_version_id, nickname, total_xp, level_no, stage_no, selected_at, updated_at)
SELECT 'sdc00061', 'sd000002', v.species_id, v.id, (SELECT id FROM pet_level_policy_versions ORDER BY effective_at DESC, version_no DESC LIMIT 1),
       '새싹이', 0, 1, 1, timestamptz '2026-11-19 09:00:00+09', timestamptz '2026-11-19 09:00:00+09'
  FROM pet_species_versions v WHERE v.name = '원숭이' ORDER BY v.effective_at DESC LIMIT 1;

-- ===== 상점: 취소된 주문 + 환불 (이광수 포인트는 시간순 460 → 210 → 460) =====
INSERT INTO point_transactions (id, user_id, kind, available_delta, outstanding_delta, balance_after, outstanding_after, source_type, source_id, original_transaction_id, recovery_claim_id, cap_month, cap_delta, idempotency_key, created_by_admin_id, reason, occurred_at) VALUES
 ('sdc00071', 'sd000002', 'spend', -250, 0, 210, 0, 'shop_order', 'sdc00070', NULL, NULL, NULL, 0, 'sdc:spend:sdc00070', NULL, NULL, timestamptz '2026-11-18 10:20:00+09'),
 ('sdc00072', 'sd000002', 'refund', 250, 0, 460, 0, 'shop_order', 'sdc00070', 'sdc00071', NULL, NULL, 0, 'sdc:refund:sdc00070', NULL, NULL, timestamptz '2026-11-18 10:30:00+09');
INSERT INTO shop_orders (id, user_id, item_id, price_version_id, quantity, unit_points, status, spend_transaction_id, refund_transaction_id, cancel_reason, idempotency_key, created_at, cancelled_at)
SELECT 'sdc00070', 'sd000002', i.id, p.id, 1, 250, 'cancelled', 'sdc00071', 'sdc00072', '단순 변심', 'sdc:order:sdc00070', timestamptz '2026-11-18 10:20:00+09', timestamptz '2026-11-18 10:30:00+09'
  FROM shop_items i JOIN shop_item_price_versions p ON p.item_id = i.id WHERE i.code = 'pet_snack' AND p.price_points = 250 ORDER BY p.version_no DESC LIMIT 1;
INSERT INTO user_inventory_events (id, user_id, item_id, kind, quantity_delta, order_id, idempotency_key, occurred_at)
SELECT e.id, 'sd000002', i.id, e.kind, e.q, 'sdc00070', e.key, e.at
  FROM shop_items i,
       (VALUES ('sdc00073', 'purchase', 1, 'sdc:inv:purchase:sdc00070', timestamptz '2026-11-18 10:20:00+09'),
               ('sdc00074', 'refund', -1, 'sdc:inv:refund:sdc00070', timestamptz '2026-11-18 10:30:00+09')) AS e(id, kind, q, key, at)
 WHERE i.code = 'pet_snack';

COMMIT;
