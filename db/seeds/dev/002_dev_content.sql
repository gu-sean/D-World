-- 개발용 콘텐츠: 펫 3종, 업적 6개, 관리자 미션 틀 10개, 상점 상품 2개,
-- 추천 문구 3개, 개발 사용자 1명, 공개 챌린지 1개
-- 001_dev_reference.sql 다음에 실행한다. 값의 근거는 docs/11 §9
-- 이미지 파일은 db/seeds/dev/assets/ 를 MinIO에 올린다 (npm run db:seed 가 처리)

\if :{?user_password_hash}
\else
    \echo 'Set -v user_password_hash=<hash> before running this seed.'
    \quit
\endif

BEGIN;

-- ---------- 펫 3종 ----------
INSERT INTO pet_species (id, code, name, description, status, created_by_admin_id) VALUES
    ('d4000101', 'steady_cat', '꾸준냥이', '운동을 좋아하는 고양이', 'public', 'd4000001'),
    ('d4000102', 'book_owl',   '새벽 부엉이', '운동을 좋아하는 부엉이', 'public', 'd4000001'),
    ('d4000103', 'sprout',     '새싹이', '운동하며 쑥쑥 자라는 새싹', 'public', 'd4000001')
ON CONFLICT (code) DO NOTHING;

INSERT INTO pet_stage_images (id, species_id, r2_object_key, mime_type, size_bytes, uploaded_at, created_by_admin_id)
SELECT i.id::short_id, i.species_id::short_id,
       'dev/assets/pets/' || i.species_id || '/' || i.stage_code || '-' || i.id || '.png',
       'image/png', 70, timestamptz '2026-01-01 00:00:00+09', 'd4000001'
  FROM (VALUES
    ('d4000121', 'd4000101', 'egg'),
    ('d4000122', 'd4000101', 'baby'),
    ('d4000123', 'd4000101', 'adult'),
    ('d4000124', 'd4000102', 'egg'),
    ('d4000125', 'd4000102', 'baby'),
    ('d4000126', 'd4000102', 'adult'),
    ('d4000127', 'd4000103', 'egg'),
    ('d4000128', 'd4000103', 'baby'),
    ('d4000129', 'd4000103', 'adult')
  ) AS i(id, species_id, stage_code)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pet_species_versions
    (id, species_id, version_no, name, description, personality, world_text, category_id,
     unlock_condition_type, hatch_mission_count, effective_at, created_by_admin_id)
SELECT v.id::short_id, v.species_id::short_id, 1, v.name, v.description, v.personality, v.world_text,
       (SELECT id FROM goal_categories WHERE code = v.category_code),
       'none', 3, timestamptz '2026-01-01 00:00:00+09', 'd4000001'
  FROM (VALUES
    ('d4000111', 'd4000101', '꾸준냥이',
     '운동 미션을 하면 빨리 자라요', '활발하고 끈기 있음', '운동장 옆 작은 마을에 살아요', 'exercise'),
    ('d4000112', 'd4000102', '새벽 부엉이',
     '운동 미션을 하면 빨리 자라요', '차분하고 호기심 많음', '체육관 꼭대기에 살아요', 'exercise'),
    ('d4000113', 'd4000103', '새싹이',
     '운동 미션을 하면 빨리 자라요', '느긋하고 다정함', '햇살 좋은 공원에 살아요', 'exercise')
  ) AS v(id, species_id, name, description, personality, world_text, category_code)
ON CONFLICT (species_id, version_no) DO NOTHING;

INSERT INTO pet_stage_versions
    (species_version_id, species_id, stage_no, stage_code, min_total_xp, bonus_basis_points, image_id)
SELECT s.version_id::short_id, s.species_id::short_id, s.stage_no, s.stage_code, s.min_xp, s.bonus, s.image_id::short_id
  FROM (VALUES
    ('d4000111', 'd4000101', 1, 'egg',   0,  500, 'd4000121'),
    ('d4000111', 'd4000101', 2, 'baby',  50, 1000, 'd4000122'),
    ('d4000111', 'd4000101', 3, 'adult', 200, 1500, 'd4000123'),
    ('d4000112', 'd4000102', 1, 'egg',   0,  500, 'd4000124'),
    ('d4000112', 'd4000102', 2, 'baby',  50, 1000, 'd4000125'),
    ('d4000112', 'd4000102', 3, 'adult', 200, 1500, 'd4000126'),
    ('d4000113', 'd4000103', 1, 'egg',   0,  500, 'd4000127'),
    ('d4000113', 'd4000103', 2, 'baby',  50, 1000, 'd4000128'),
    ('d4000113', 'd4000103', 3, 'adult', 200, 1500, 'd4000129')
  ) AS s(version_id, species_id, stage_no, stage_code, min_xp, bonus, image_id)
ON CONFLICT DO NOTHING;

INSERT INTO pet_stage_dialogues
    (species_version_id, stage_no, dialogue_no, text_content, time_of_day, display_order)
SELECT v.id, st.stage_no, d.no, d.text_content, d.time_of_day, d.no
  FROM (VALUES ('d4000111'::short_id),
               ('d4000112'::short_id),
               ('d4000113'::short_id)) AS v(id)
 CROSS JOIN (VALUES (1), (2), (3)) AS st(stage_no)
 CROSS JOIN (VALUES (1, '좋은 아침! 오늘도 같이 해 볼까?', 'morning'),
                    (2, '오늘 하루도 수고했어!', 'evening')) AS d(no, text_content, time_of_day)
ON CONFLICT DO NOTHING;

-- ---------- 업적 6개 ----------
INSERT INTO achievement_definitions (id, code, status, created_by_admin_id)
SELECT a.id::short_id, a.code, 'public', 'd4000001'
  FROM (VALUES
    ('d4000201', 'first_goal'),
    ('d4000202', 'missions_10'),
    ('d4000203', 'missions_50'),
    ('d4000204', 'exercise_20'),
    ('d4000205', 'streak_7'),
    ('d4000206', 'challenge_1')
  ) AS a(id, code)
ON CONFLICT (code) DO NOTHING;

INSERT INTO achievement_badge_images
    (id, achievement_id, version_no, r2_object_key, mime_type, size_bytes, uploaded_at, created_by_admin_id)
SELECT b.id::short_id, b.achievement_id::short_id, 1,
       'dev/assets/badges/' || b.achievement_id || '/v1.png',
       'image/png', 70, timestamptz '2026-01-01 00:00:00+09', 'd4000001'
  FROM (VALUES
    ('d4000211', 'd4000201'),
    ('d4000212', 'd4000202'),
    ('d4000213', 'd4000203'),
    ('d4000214', 'd4000204'),
    ('d4000215', 'd4000205'),
    ('d4000216', 'd4000206')
  ) AS b(id, achievement_id)
ON CONFLICT (id) DO NOTHING;

INSERT INTO achievement_versions
    (id, achievement_id, version_no, title, description, rarity, condition_type, target_count,
     category_id, reward_points, reward_user_xp, reward_pet_xp, badge_image_id, effective_at, created_by_admin_id)
SELECT v.id::short_id, v.achievement_id::short_id, 1, v.title, v.description, v.rarity, v.condition_type, v.target_count,
       (SELECT id FROM goal_categories WHERE code = v.category_code),
       v.points, v.points, 0, v.badge_id::short_id,
       timestamptz '2026-01-01 00:00:00+09', 'd4000001'
  FROM (VALUES
    ('d4000221', 'd4000201', '첫 목표 달성', '목표를 처음으로 완료했어요', 'common', 'first_goal_completed', 1, NULL, 100, 'd4000211'),
    ('d4000222', 'd4000202', '미션 10개', '미션을 10개 완료했어요', 'common', 'approved_mission_count', 10, NULL, 100, 'd4000212'),
    ('d4000223', 'd4000203', '미션 50개', '미션을 50개 완료했어요', 'rare', 'approved_mission_count', 50, NULL, 300, 'd4000213'),
    ('d4000224', 'd4000204', '운동 20회', '운동 미션을 20개 완료했어요', 'rare', 'category_approved_mission_count', 20, 'exercise', 200, 'd4000214'),
    ('d4000225', 'd4000205', '7일 연속', '7일 연속으로 미션을 해냈어요', 'rare', 'streak_milestone', 7, NULL, 0, 'd4000215'),
    ('d4000226', 'd4000206', '첫 챌린지 완주', '챌린지를 처음으로 완주했어요', 'legendary', 'challenge_completed', 1, NULL, 0, 'd4000216')
  ) AS v(id, achievement_id, title, description, rarity, condition_type, target_count, category_code, points, badge_id)
ON CONFLICT (achievement_id, version_no) DO NOTHING;

-- ---------- 관리자 미션 틀 10개 ----------
INSERT INTO mission_definitions
    (id, origin, title, description, category_id, difficulty_id, estimated_duration_seconds,
     target_value, target_unit, verification_method, exercise_code, publication_status,
     base_points, base_user_xp, base_pet_xp)
SELECT d.id::short_id, 'admin', d.title, d.description,
       (SELECT id FROM goal_categories WHERE code = d.category_code),
       (SELECT id FROM difficulty_levels WHERE code = d.difficulty_code),
       d.seconds, d.target_value, d.target_unit, d.method, d.exercise_code, 'public',
       d.points, d.points, d.pet_xp
  FROM (VALUES
    ('d4000301', '스쿼트 20회', '무릎이 발끝을 넘지 않게 천천히', 'exercise', 'normal', 180, 20, 'reps', 'camera', 'squat', 20, 10),
    ('d4000302', '푸시업 10회', '몸을 일자로 유지해요', 'exercise', 'normal', 120, 10, 'reps', 'camera', 'push_up', 20, 10),
    ('d4000303', '런지 20회', '양쪽 다리를 번갈아 10회씩', 'exercise', 'normal', 180, 20, 'reps', 'camera', 'lunge', 20, 10),
    ('d4000304', '버피 테스트 10회', '엎드렸다 점프까지 한 번', 'exercise', 'normal', 180, 10, 'reps', 'camera', 'burpee', 20, 10),
    ('d4000305', '플랭크 30초', '허리가 처지지 않게 버텨요', 'exercise', 'normal', 60, 30, 'seconds', 'camera', 'plank', 20, 10),
    ('d4000306', '러닝 2km', '편한 속도로 달려요', 'exercise', 'normal', 900, 2000, 'meters', 'sensor', 'running', 20, 10)
  ) AS d(id, title, description, category_code, difficulty_code, seconds, target_value, target_unit, method, exercise_code, points, pet_xp)
ON CONFLICT (id) DO NOTHING;

-- ---------- 상점 상품 ----------
INSERT INTO shop_items (id, code, name, description, item_kind, display_order) VALUES
    ('d4000401', 'pet_snack', '펫 간식', '펫이 좋아하는 간식', 'consumable', 1),
    ('d4000402', 'pet_hat',   '펫 모자', '펫에게 씌워 줄 모자', 'permanent', 2)
ON CONFLICT (code) DO NOTHING;

INSERT INTO shop_item_price_versions (id, item_id, version_no, price_points, effective_at, created_by_admin_id) VALUES
    ('d4000411', 'd4000401', 1, 250,
     timestamptz '2026-01-01 00:00:00+09', 'd4000001'),
    ('d4000412', 'd4000402', 1, 1000,
     timestamptz '2026-01-01 00:00:00+09', 'd4000001')
ON CONFLICT (id) DO NOTHING;

-- ---------- 오늘의 인사 문구 ----------
INSERT INTO recommendation_messages
    (id, message, condition_type, condition_params, priority, created_by_admin_id, updated_by_admin_id) VALUES
    ('d4000501', '오늘도 건강한 하루예요!', 'always', '{}', 10,
     'd4000001', 'd4000001'),
    ('d4000502', '오늘 할 미션을 하나 골라볼까요?', 'no_mission_today', '{}', 50,
     'd4000001', 'd4000001'),
    ('d4000503', '연속 기록이 끊기기 전에 미션 하나만 해요!', 'streak_at_risk', '{}', 90,
     'd4000001', 'd4000001')
ON CONFLICT (id) DO NOTHING;

-- ---------- 개발 사용자 (휴대폰 01000000001 / devuser1234) ----------
INSERT INTO users (id) VALUES ('d4000601') ON CONFLICT DO NOTHING;
INSERT INTO profiles (user_id, nickname, notification_enabled)
VALUES ('d4000601', '개발유저', true) ON CONFLICT DO NOTHING;
INSERT INTO phone_credentials (user_id, phone_e164, password_hash, verified_at, password_changed_at)
VALUES ('d4000601', '+821000000001', :'user_password_hash', now(), now())
ON CONFLICT DO NOTHING;
INSERT INTO consent_records (id, user_id, document_version_id, granted)
SELECT new_short_id(), 'd4000601', p.id, true
  FROM policy_document_versions p
 WHERE p.version = 'dev-1'
   AND NOT EXISTS (SELECT 1 FROM consent_records c
                    WHERE c.user_id = 'd4000601'
                      AND c.document_version_id = p.id);
INSERT INTO point_wallets (user_id) VALUES ('d4000601') ON CONFLICT DO NOTHING;
INSERT INTO user_experience (user_id, level_policy_version_id)
SELECT 'd4000601', id FROM user_level_policy_versions WHERE version_no = 1
ON CONFLICT DO NOTHING;
INSERT INTO streak_states (user_id) VALUES ('d4000601') ON CONFLICT DO NOTHING;
INSERT INTO user_pets (id, user_id, species_id, species_version_id, level_policy_version_id, nickname)
SELECT 'd4000611', 'd4000601',
       'd4000101', 'd4000111', id, '꾸준이'
  FROM pet_level_policy_versions WHERE version_no = 1
ON CONFLICT DO NOTHING;
UPDATE profiles SET representative_pet_id = 'd4000611'
 WHERE user_id = 'd4000601' AND representative_pet_id IS NULL;

-- ---------- 공개 챌린지 (시드 실행일 + 2일 시작, 7일) ----------
INSERT INTO challenges
    (id, origin, created_by_admin_id, title, description, category_id, difficulty_id,
     verification_method, exercise_code, target_value, target_unit, estimated_duration_seconds,
     start_date, end_date, required_success_days, publication_status, published_at)
SELECT 'd4000701', 'admin', 'd4000001',
       '7일 스쿼트 챌린지', '7일 동안 매일 스쿼트 20회, 6일 이상 성공하면 완주',
       (SELECT id FROM goal_categories WHERE code = 'exercise'),
       (SELECT id FROM difficulty_levels WHERE code = 'normal'),
       'camera', 'squat', 20, 'reps', 180,
       (now() AT TIME ZONE 'Asia/Seoul')::date + 2, (now() AT TIME ZONE 'Asia/Seoul')::date + 8,
       6, 'public', now()
ON CONFLICT (id) DO NOTHING;
INSERT INTO challenge_reward_packages (challenge_id, points, user_xp, pet_xp)
VALUES ('d4000701', 500, 100, 50)
ON CONFLICT DO NOTHING;

COMMIT;
