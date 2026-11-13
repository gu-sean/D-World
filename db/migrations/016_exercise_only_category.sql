-- 카테고리를 운동 하나로 정리: 학습(study)·생활습관(lifestyle) 데이터 제거, 펫은 운동 카테고리로 이동
-- 사용자 데이터(목표·미션·챌린지·펫 보유 등)가 해당 카테고리에 연결돼 있으면 중단한다 (아무것도 바꾸지 않음)
BEGIN;

DO $$
DECLARE linked text;
BEGIN
    SELECT string_agg(t.name, ', ') INTO linked FROM (
        SELECT 'goals' AS name WHERE EXISTS (SELECT 1 FROM goals g JOIN goal_categories c ON c.id = g.category_id WHERE c.code IN ('study', 'lifestyle'))
        UNION ALL SELECT 'missions' WHERE EXISTS (SELECT 1 FROM missions m JOIN goal_categories c ON c.id = m.category_id WHERE c.code IN ('study', 'lifestyle'))
        UNION ALL SELECT 'challenges' WHERE EXISTS (SELECT 1 FROM challenges h JOIN goal_categories c ON c.id = h.category_id WHERE c.code IN ('study', 'lifestyle'))
        UNION ALL SELECT 'achievement_versions' WHERE EXISTS (SELECT 1 FROM achievement_versions a JOIN goal_categories c ON c.id = a.category_id WHERE c.code IN ('study', 'lifestyle'))
        UNION ALL SELECT 'recommendation_messages' WHERE EXISTS (SELECT 1 FROM recommendation_messages r JOIN goal_categories c ON c.id = r.category_id WHERE c.code IN ('study', 'lifestyle'))
        UNION ALL SELECT 'user_pets' WHERE EXISTS (
            SELECT 1 FROM user_pets p JOIN pet_species_versions v ON v.id = p.species_version_id
              JOIN goal_categories c ON c.id = v.category_id WHERE c.code IN ('study', 'lifestyle'))
    ) t;
    IF linked IS NOT NULL THEN
        RAISE EXCEPTION 'study/lifestyle 카테고리에 연결된 데이터가 있어 중단: %', linked;
    END IF;
END $$;

-- 1) 학습·생활습관 미션 정의
DELETE FROM mission_definitions
 WHERE category_id IN (SELECT id FROM goal_categories WHERE code IN ('study', 'lifestyle'));

-- 2) 보상표·인증 기준 (정책 표라 수정·삭제 방지 트리거를 이 문장 동안만 끔)
ALTER TABLE mission_reward_rate_versions DISABLE TRIGGER mission_reward_rates_no_change;
DELETE FROM mission_reward_rate_versions
 WHERE category_id IN (SELECT id FROM goal_categories WHERE code IN ('study', 'lifestyle'));
ALTER TABLE mission_reward_rate_versions ENABLE TRIGGER mission_reward_rates_no_change;

ALTER TABLE verification_criteria_versions DISABLE TRIGGER verification_criteria_no_change;
DELETE FROM verification_criteria_versions
 WHERE category_id IN (SELECT id FROM goal_categories WHERE code IN ('study', 'lifestyle'));
ALTER TABLE verification_criteria_versions ENABLE TRIGGER verification_criteria_no_change;

-- 3) 펫: 학습·생활습관 펫을 운동 펫으로 재편 (보유한 사용자가 없음을 위에서 확인)
UPDATE pet_species SET name = '새벽 부엉이', description = '운동을 좋아하는 부엉이'
 WHERE code = 'book_owl' AND name = '책벌레 부엉이';
UPDATE pet_species SET description = '운동하며 쑥쑥 자라는 새싹'
 WHERE code = 'sprout' AND description = '좋은 습관을 좋아하는 새싹';

ALTER TABLE pet_species_versions DISABLE TRIGGER pet_species_versions_no_change;
UPDATE pet_species_versions v
   SET category_id = (SELECT id FROM goal_categories WHERE code = 'exercise'),
       name        = CASE s.code WHEN 'book_owl' THEN '새벽 부엉이' ELSE v.name END,
       description = '운동 미션을 하면 빨리 자라요',
       world_text  = CASE s.code WHEN 'book_owl' THEN '체육관 꼭대기에 살아요'
                                 WHEN 'sprout'   THEN '햇살 좋은 공원에 살아요'
                                 ELSE v.world_text END
  FROM pet_species s
 WHERE s.id = v.species_id
   AND v.category_id IN (SELECT id FROM goal_categories WHERE code IN ('study', 'lifestyle'));
ALTER TABLE pet_species_versions ENABLE TRIGGER pet_species_versions_no_change;

-- 4) 카테고리
DELETE FROM goal_categories WHERE code IN ('study', 'lifestyle');

COMMIT;
