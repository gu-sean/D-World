-- 기본 업적(배지) 6개: 원래 개발 콘텐츠 시드(002_dev_content)에 있던 획득 조건·보상을 그대로 복원
-- 사용자 XP는 관리자 화면에서 정하지 않으므로 0, 펫 XP도 원래대로 0. 포인트 보상만 준다
-- 001_dev_reference.sql(관리자 d...001, 분야) 다음에 실행한다. 값의 근거는 docs/11 §9
-- 배지 이미지는 자리만 잡아 둔다 (파일은 관리자 웹에서 새 버전으로 올려 바꾼다)

BEGIN;


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
       v.points, 0, 0, v.badge_id::uuid,
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

COMMIT;
