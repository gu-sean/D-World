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
    ('d0000000-0000-4000-8000-000000000101', 'steady_cat', '꾸준냥이', '운동을 좋아하는 고양이', 'public', 'd0000000-0000-4000-8000-000000000001'),
    ('d0000000-0000-4000-8000-000000000102', 'book_owl',   '책벌레 부엉이', '공부를 좋아하는 부엉이', 'public', 'd0000000-0000-4000-8000-000000000001'),
    ('d0000000-0000-4000-8000-000000000103', 'sprout',     '새싹이', '좋은 습관을 좋아하는 새싹', 'public', 'd0000000-0000-4000-8000-000000000001')
ON CONFLICT (code) DO NOTHING;

INSERT INTO pet_stage_images (id, species_id, r2_object_key, mime_type, size_bytes, uploaded_at, created_by_admin_id)
SELECT i.id::uuid, i.species_id::uuid,
       'dev/assets/pets/' || i.species_id || '/' || i.stage_code || '-' || i.id || '.png',
       'image/png', 70, timestamptz '2026-01-01 00:00:00+09', 'd0000000-0000-4000-8000-000000000001'
  FROM (VALUES
    ('d0000000-0000-4000-8000-000000000121', 'd0000000-0000-4000-8000-000000000101', 'egg'),
    ('d0000000-0000-4000-8000-000000000122', 'd0000000-0000-4000-8000-000000000101', 'baby'),
    ('d0000000-0000-4000-8000-000000000123', 'd0000000-0000-4000-8000-000000000101', 'adult'),
    ('d0000000-0000-4000-8000-000000000124', 'd0000000-0000-4000-8000-000000000102', 'egg'),
    ('d0000000-0000-4000-8000-000000000125', 'd0000000-0000-4000-8000-000000000102', 'baby'),
    ('d0000000-0000-4000-8000-000000000126', 'd0000000-0000-4000-8000-000000000102', 'adult'),
    ('d0000000-0000-4000-8000-000000000127', 'd0000000-0000-4000-8000-000000000103', 'egg'),
    ('d0000000-0000-4000-8000-000000000128', 'd0000000-0000-4000-8000-000000000103', 'baby'),
    ('d0000000-0000-4000-8000-000000000129', 'd0000000-0000-4000-8000-000000000103', 'adult')
  ) AS i(id, species_id, stage_code)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pet_species_versions
    (id, species_id, version_no, name, description, personality, world_text, category_id,
     unlock_condition_type, hatch_mission_count, effective_at, created_by_admin_id)
SELECT v.id::uuid, v.species_id::uuid, 1, v.name, v.description, v.personality, v.world_text,
       (SELECT id FROM goal_categories WHERE code = v.category_code),
       'none', 3, timestamptz '2026-01-01 00:00:00+09', 'd0000000-0000-4000-8000-000000000001'
  FROM (VALUES
    ('d0000000-0000-4000-8000-000000000111', 'd0000000-0000-4000-8000-000000000101', '꾸준냥이',
     '운동 미션을 하면 빨리 자라요', '활발하고 끈기 있음', '운동장 옆 작은 마을에 살아요', 'exercise'),
    ('d0000000-0000-4000-8000-000000000112', 'd0000000-0000-4000-8000-000000000102', '책벌레 부엉이',
     '학습 미션을 하면 빨리 자라요', '차분하고 호기심 많음', '오래된 도서관 꼭대기에 살아요', 'study'),
    ('d0000000-0000-4000-8000-000000000113', 'd0000000-0000-4000-8000-000000000103', '새싹이',
     '생활습관 미션을 하면 빨리 자라요', '느긋하고 다정함', '햇살 좋은 정원에 살아요', 'lifestyle')
  ) AS v(id, species_id, name, description, personality, world_text, category_code)
ON CONFLICT (species_id, version_no) DO NOTHING;

INSERT INTO pet_stage_versions
    (species_version_id, species_id, stage_no, stage_code, min_total_xp, bonus_basis_points, image_id)
SELECT s.version_id::uuid, s.species_id::uuid, s.stage_no, s.stage_code, s.min_xp, s.bonus, s.image_id::uuid
  FROM (VALUES
    ('d0000000-0000-4000-8000-000000000111', 'd0000000-0000-4000-8000-000000000101', 1, 'egg',   0,  500, 'd0000000-0000-4000-8000-000000000121'),
    ('d0000000-0000-4000-8000-000000000111', 'd0000000-0000-4000-8000-000000000101', 2, 'baby',  50, 1000, 'd0000000-0000-4000-8000-000000000122'),
    ('d0000000-0000-4000-8000-000000000111', 'd0000000-0000-4000-8000-000000000101', 3, 'adult', 200, 1500, 'd0000000-0000-4000-8000-000000000123'),
    ('d0000000-0000-4000-8000-000000000112', 'd0000000-0000-4000-8000-000000000102', 1, 'egg',   0,  500, 'd0000000-0000-4000-8000-000000000124'),
    ('d0000000-0000-4000-8000-000000000112', 'd0000000-0000-4000-8000-000000000102', 2, 'baby',  50, 1000, 'd0000000-0000-4000-8000-000000000125'),
    ('d0000000-0000-4000-8000-000000000112', 'd0000000-0000-4000-8000-000000000102', 3, 'adult', 200, 1500, 'd0000000-0000-4000-8000-000000000126'),
    ('d0000000-0000-4000-8000-000000000113', 'd0000000-0000-4000-8000-000000000103', 1, 'egg',   0,  500, 'd0000000-0000-4000-8000-000000000127'),
    ('d0000000-0000-4000-8000-000000000113', 'd0000000-0000-4000-8000-000000000103', 2, 'baby',  50, 1000, 'd0000000-0000-4000-8000-000000000128'),
    ('d0000000-0000-4000-8000-000000000113', 'd0000000-0000-4000-8000-000000000103', 3, 'adult', 200, 1500, 'd0000000-0000-4000-8000-000000000129')
  ) AS s(version_id, species_id, stage_no, stage_code, min_xp, bonus, image_id)
ON CONFLICT DO NOTHING;

INSERT INTO pet_stage_dialogues
    (species_version_id, stage_no, dialogue_no, text_content, time_of_day, display_order)
SELECT v.id, st.stage_no, d.no, d.text_content, d.time_of_day, d.no
  FROM (VALUES ('d0000000-0000-4000-8000-000000000111'::uuid),
               ('d0000000-0000-4000-8000-000000000112'::uuid),
               ('d0000000-0000-4000-8000-000000000113'::uuid)) AS v(id)
 CROSS JOIN (VALUES (1), (2), (3)) AS st(stage_no)
 CROSS JOIN (VALUES (1, '좋은 아침! 오늘도 같이 해 볼까?', 'morning'),
                    (2, '오늘 하루도 수고했어!', 'evening')) AS d(no, text_content, time_of_day)
ON CONFLICT DO NOTHING;

-- ---------- 업적 6개 ----------
INSERT INTO achievement_definitions (id, code, status, created_by_admin_id)
SELECT a.id::uuid, a.code, 'public', 'd0000000-0000-4000-8000-000000000001'
  FROM (VALUES
    ('d0000000-0000-4000-8000-000000000201', 'first_goal'),
    ('d0000000-0000-4000-8000-000000000202', 'missions_10'),
    ('d0000000-0000-4000-8000-000000000203', 'missions_50'),
    ('d0000000-0000-4000-8000-000000000204', 'exercise_20'),
    ('d0000000-0000-4000-8000-000000000205', 'streak_7'),
    ('d0000000-0000-4000-8000-000000000206', 'challenge_1')
  ) AS a(id, code)
ON CONFLICT (code) DO NOTHING;

INSERT INTO achievement_badge_images
    (id, achievement_id, version_no, r2_object_key, mime_type, size_bytes, uploaded_at, created_by_admin_id)
SELECT b.id::uuid, b.achievement_id::uuid, 1,
       'dev/assets/badges/' || b.achievement_id || '/v1.png',
       'image/png', 70, timestamptz '2026-01-01 00:00:00+09', 'd0000000-0000-4000-8000-000000000001'
  FROM (VALUES
    ('d0000000-0000-4000-8000-000000000211', 'd0000000-0000-4000-8000-000000000201'),
    ('d0000000-0000-4000-8000-000000000212', 'd0000000-0000-4000-8000-000000000202'),
    ('d0000000-0000-4000-8000-000000000213', 'd0000000-0000-4000-8000-000000000203'),
    ('d0000000-0000-4000-8000-000000000214', 'd0000000-0000-4000-8000-000000000204'),
    ('d0000000-0000-4000-8000-000000000215', 'd0000000-0000-4000-8000-000000000205'),
    ('d0000000-0000-4000-8000-000000000216', 'd0000000-0000-4000-8000-000000000206')
  ) AS b(id, achievement_id)
ON CONFLICT (id) DO NOTHING;

INSERT INTO achievement_versions
    (id, achievement_id, version_no, title, description, rarity, condition_type, target_count,
     category_id, reward_points, reward_user_xp, reward_pet_xp, badge_image_id, effective_at, created_by_admin_id)
SELECT v.id::uuid, v.achievement_id::uuid, 1, v.title, v.description, v.rarity, v.condition_type, v.target_count,
       (SELECT id FROM goal_categories WHERE code = v.category_code),
       v.points, v.points, 0, v.badge_id::uuid,
       timestamptz '2026-01-01 00:00:00+09', 'd0000000-0000-4000-8000-000000000001'
  FROM (VALUES
    ('d0000000-0000-4000-8000-000000000221', 'd0000000-0000-4000-8000-000000000201', '첫 목표 달성', '목표를 처음으로 완료했어요', 'common', 'first_goal_completed', 1, NULL, 100, 'd0000000-0000-4000-8000-000000000211'),
    ('d0000000-0000-4000-8000-000000000222', 'd0000000-0000-4000-8000-000000000202', '미션 10개', '미션을 10개 완료했어요', 'common', 'approved_mission_count', 10, NULL, 100, 'd0000000-0000-4000-8000-000000000212'),
    ('d0000000-0000-4000-8000-000000000223', 'd0000000-0000-4000-8000-000000000203', '미션 50개', '미션을 50개 완료했어요', 'rare', 'approved_mission_count', 50, NULL, 300, 'd0000000-0000-4000-8000-000000000213'),
    ('d0000000-0000-4000-8000-000000000224', 'd0000000-0000-4000-8000-000000000204', '운동 20회', '운동 미션을 20개 완료했어요', 'rare', 'category_approved_mission_count', 20, 'exercise', 200, 'd0000000-0000-4000-8000-000000000214'),
    ('d0000000-0000-4000-8000-000000000225', 'd0000000-0000-4000-8000-000000000205', '7일 연속', '7일 연속으로 미션을 해냈어요', 'rare', 'streak_milestone', 7, NULL, 0, 'd0000000-0000-4000-8000-000000000215'),
    ('d0000000-0000-4000-8000-000000000226', 'd0000000-0000-4000-8000-000000000206', '첫 챌린지 완주', '챌린지를 처음으로 완주했어요', 'legendary', 'challenge_completed', 1, NULL, 0, 'd0000000-0000-4000-8000-000000000216')
  ) AS v(id, achievement_id, title, description, rarity, condition_type, target_count, category_code, points, badge_id)
ON CONFLICT (achievement_id, version_no) DO NOTHING;

-- ---------- 관리자 미션 틀 10개 ----------
INSERT INTO mission_definitions
    (id, origin, title, description, category_id, difficulty_id, estimated_duration_seconds,
     target_value, target_unit, verification_method, exercise_code, publication_status,
     base_points, base_user_xp, base_pet_xp)
SELECT d.id::uuid, 'admin', d.title, d.description,
       (SELECT id FROM goal_categories WHERE code = d.category_code),
       (SELECT id FROM difficulty_levels WHERE code = d.difficulty_code),
       d.seconds, d.target_value, d.target_unit, d.method, d.exercise_code, 'public',
       d.points, d.points, d.pet_xp
  FROM (VALUES
    ('d0000000-0000-4000-8000-000000000301', '스쿼트 20회', '무릎이 발끝을 넘지 않게 천천히', 'exercise', 'normal', 180, 20, 'reps', 'camera', 'squat', 20, 10),
    ('d0000000-0000-4000-8000-000000000302', '푸시업 10회', '몸을 일자로 유지해요', 'exercise', 'normal', 120, 10, 'reps', 'camera', 'push_up', 20, 10),
    ('d0000000-0000-4000-8000-000000000303', '런지 20회', '양쪽 다리를 번갈아 10회씩', 'exercise', 'normal', 180, 20, 'reps', 'camera', 'lunge', 20, 10),
    ('d0000000-0000-4000-8000-000000000304', '버피 테스트 10회', '엎드렸다 점프까지 한 번', 'exercise', 'normal', 180, 10, 'reps', 'camera', 'burpee', 20, 10),
    ('d0000000-0000-4000-8000-000000000305', '플랭크 30초', '허리가 처지지 않게 버텨요', 'exercise', 'normal', 60, 30, 'seconds', 'camera', 'plank', 20, 10),
    ('d0000000-0000-4000-8000-000000000306', '러닝 2km', '편한 속도로 달려요', 'exercise', 'normal', 900, 2000, 'meters', 'sensor', 'running', 20, 10),
    ('d0000000-0000-4000-8000-000000000307', '독서 20분', '읽은 페이지를 사진으로 남겨요', 'study', 'easy', 1200, 1, 'times', 'camera', NULL, 10, 5),
    ('d0000000-0000-4000-8000-000000000308', '영단어 30개', '외운 단어장을 사진으로 남겨요', 'study', 'easy', 1200, 1, 'times', 'camera', NULL, 10, 5),
    ('d0000000-0000-4000-8000-000000000309', '물 2L 마시기', '마신 물병을 사진으로 남겨요', 'lifestyle', 'easy', 60, 1, 'times', 'camera', NULL, 10, 5),
    ('d0000000-0000-4000-8000-000000000310', '취침 전 스트레칭', '스트레칭하는 모습을 사진으로', 'lifestyle', 'easy', 300, 1, 'times', 'camera', NULL, 10, 5)
  ) AS d(id, title, description, category_code, difficulty_code, seconds, target_value, target_unit, method, exercise_code, points, pet_xp)
ON CONFLICT (id) DO NOTHING;

-- ---------- 상점 상품 ----------
INSERT INTO shop_items (id, code, name, description, item_kind, display_order) VALUES
    ('d0000000-0000-4000-8000-000000000401', 'pet_snack', '펫 간식', '펫이 좋아하는 간식', 'consumable', 1),
    ('d0000000-0000-4000-8000-000000000402', 'pet_hat',   '펫 모자', '펫에게 씌워 줄 모자', 'permanent', 2)
ON CONFLICT (code) DO NOTHING;

INSERT INTO shop_item_price_versions (id, item_id, version_no, price_points, effective_at, created_by_admin_id) VALUES
    ('d0000000-0000-4000-8000-000000000411', 'd0000000-0000-4000-8000-000000000401', 1, 250,
     timestamptz '2026-01-01 00:00:00+09', 'd0000000-0000-4000-8000-000000000001'),
    ('d0000000-0000-4000-8000-000000000412', 'd0000000-0000-4000-8000-000000000402', 1, 1000,
     timestamptz '2026-01-01 00:00:00+09', 'd0000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ---------- 오늘의 인사 문구 ----------
INSERT INTO recommendation_messages
    (id, message, condition_type, condition_params, priority, created_by_admin_id, updated_by_admin_id) VALUES
    ('d0000000-0000-4000-8000-000000000501', '오늘도 건강한 하루예요!', 'always', '{}', 10,
     'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001'),
    ('d0000000-0000-4000-8000-000000000502', '오늘 할 미션을 하나 골라볼까요?', 'no_mission_today', '{}', 50,
     'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001'),
    ('d0000000-0000-4000-8000-000000000503', '연속 기록이 끊기기 전에 미션 하나만 해요!', 'streak_at_risk', '{}', 90,
     'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ---------- 개발 사용자 (휴대폰 01000000001 / devuser1234) ----------
INSERT INTO users (id) VALUES ('d0000000-0000-4000-8000-000000000601') ON CONFLICT DO NOTHING;
INSERT INTO profiles (user_id, nickname, notification_enabled)
VALUES ('d0000000-0000-4000-8000-000000000601', '개발유저', true) ON CONFLICT DO NOTHING;
INSERT INTO phone_credentials (user_id, phone_e164, password_hash, verified_at, password_changed_at)
VALUES ('d0000000-0000-4000-8000-000000000601', '+821000000001', :'user_password_hash', now(), now())
ON CONFLICT DO NOTHING;
INSERT INTO consent_records (id, user_id, document_version_id, granted)
SELECT gen_random_uuid(), 'd0000000-0000-4000-8000-000000000601', p.id, true
  FROM policy_document_versions p
 WHERE p.version = 'dev-1'
   AND NOT EXISTS (SELECT 1 FROM consent_records c
                    WHERE c.user_id = 'd0000000-0000-4000-8000-000000000601'
                      AND c.document_version_id = p.id);
INSERT INTO point_wallets (user_id) VALUES ('d0000000-0000-4000-8000-000000000601') ON CONFLICT DO NOTHING;
INSERT INTO user_experience (user_id, level_policy_version_id)
SELECT 'd0000000-0000-4000-8000-000000000601', id FROM user_level_policy_versions WHERE version_no = 1
ON CONFLICT DO NOTHING;
INSERT INTO streak_states (user_id) VALUES ('d0000000-0000-4000-8000-000000000601') ON CONFLICT DO NOTHING;
INSERT INTO user_pets (id, user_id, species_id, species_version_id, level_policy_version_id, nickname)
SELECT 'd0000000-0000-4000-8000-000000000611', 'd0000000-0000-4000-8000-000000000601',
       'd0000000-0000-4000-8000-000000000101', 'd0000000-0000-4000-8000-000000000111', id, '꾸준이'
  FROM pet_level_policy_versions WHERE version_no = 1
ON CONFLICT DO NOTHING;
UPDATE profiles SET representative_pet_id = 'd0000000-0000-4000-8000-000000000611'
 WHERE user_id = 'd0000000-0000-4000-8000-000000000601' AND representative_pet_id IS NULL;

-- ---------- 공개 챌린지 (시드 실행일 + 2일 시작, 7일) ----------
INSERT INTO challenges
    (id, origin, created_by_admin_id, title, description, category_id, difficulty_id,
     verification_method, exercise_code, target_value, target_unit, estimated_duration_seconds,
     start_date, end_date, required_success_days, publication_status, published_at)
SELECT 'd0000000-0000-4000-8000-000000000701', 'admin', 'd0000000-0000-4000-8000-000000000001',
       '7일 스쿼트 챌린지', '7일 동안 매일 스쿼트 20회, 6일 이상 성공하면 완주',
       (SELECT id FROM goal_categories WHERE code = 'exercise'),
       (SELECT id FROM difficulty_levels WHERE code = 'normal'),
       'camera', 'squat', 20, 'reps', 180,
       (now() AT TIME ZONE 'Asia/Seoul')::date + 2, (now() AT TIME ZONE 'Asia/Seoul')::date + 8,
       6, 'public', now()
ON CONFLICT (id) DO NOTHING;
INSERT INTO challenge_reward_packages (challenge_id, points, user_xp, pet_xp)
VALUES ('d0000000-0000-4000-8000-000000000701', 500, 100, 50)
ON CONFLICT DO NOTHING;

COMMIT;
