-- smoke 007, 샘플 데이터는 롤백
BEGIN;
INSERT INTO users(id) VALUES ('00000701');
INSERT INTO profiles(user_id,nickname) VALUES
 ('00000701','PetHero07');
INSERT INTO admin_accounts(id,login_id,email,password_hash) VALUES
 ('00000702','owner07','owner07@example.com','hash');
INSERT INTO goal_categories(id,code,name,display_order) VALUES
 ('00000703','fitness07','운동07',1);
INSERT INTO user_level_policy_versions(id,version_no,effective_at,created_by_admin_id) VALUES
 ('00000704',1,now()-interval '1 day','00000702');
INSERT INTO user_level_thresholds(policy_version_id,level_no,min_total_xp) VALUES
 ('00000704',1,0),
 ('00000704',2,100);
INSERT INTO pet_level_policy_versions(id,version_no,effective_at,created_by_admin_id) VALUES
 ('00000705',1,now()-interval '1 day','00000702');
INSERT INTO pet_level_thresholds(policy_version_id,level_no,min_total_xp) VALUES
 ('00000705',1,0),
 ('00000705',2,100);
INSERT INTO user_experience(user_id,level_policy_version_id) VALUES
 ('00000701','00000704');
INSERT INTO pet_species(id,code,name,status,created_by_admin_id) VALUES
 ('00000706','starter07','시작 펫','public','00000702');
INSERT INTO pet_stage_images(id,species_id,r2_object_key,mime_type,size_bytes,uploaded_at,created_by_admin_id) VALUES
 ('00000707','00000706','pets/starter07/egg.webp','image/webp',100,now()-interval '1 day','00000702'),
 ('00000708','00000706','pets/starter07/baby.webp','image/webp',100,now()-interval '1 day','00000702'),
 ('00000709','00000706','pets/starter07/adult.webp','image/webp',100,now()-interval '1 day','00000702');
INSERT INTO pet_species_versions(id,species_id,version_no,name,category_id,unlock_condition_type,hatch_mission_count,effective_at,created_by_admin_id) VALUES
 ('00000710','00000706',1,'시작 펫','00000703','none',0,now()-interval '1 day','00000702');
INSERT INTO pet_stage_versions(species_version_id,species_id,stage_no,stage_code,min_total_xp,bonus_basis_points,image_id) VALUES
 ('00000710','00000706',1,'egg',0,1000,'00000707'),
 ('00000710','00000706',2,'baby',50,1500,'00000708'),
 ('00000710','00000706',3,'adult',150,2000,'00000709');
INSERT INTO user_pets(id,user_id,species_id,species_version_id,level_policy_version_id,nickname) VALUES
 ('00000711','00000701','00000706','00000710','00000705','다람이');
UPDATE profiles SET representative_pet_id='00000711'
 WHERE user_id='00000701';

DO $$ BEGIN
  BEGIN
    UPDATE user_experience SET total_xp=100 WHERE user_id='00000701';
    RAISE EXCEPTION 'wrong user level accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE user_pets SET stage_no=2 WHERE id='00000711';
    RAISE EXCEPTION 'premature pet stage accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    DELETE FROM user_pets WHERE id='00000711';
    RAISE EXCEPTION 'direct pet deletion accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

UPDATE user_experience SET total_xp=100,level_no=2
 WHERE user_id='00000701';
UPDATE user_pets SET total_xp=50,level_no=1,stage_no=2
 WHERE id='00000711';
INSERT INTO pet_evolution_events(id,user_pet_id,from_stage_no,to_stage_no,total_xp_after,reason) VALUES
 ('00000712','00000711',1,2,50,'growth');
ROLLBACK;

-- smoke: 보류 XP 펫 배정 (샘플 데이터는 롤백)
BEGIN;

INSERT INTO users(id) VALUES ('00001701');
INSERT INTO profiles(user_id,nickname) VALUES
 ('00001701','PetHero17');
INSERT INTO admin_accounts(id,login_id,email,password_hash) VALUES
 ('00001702','owner17','owner17@example.com','hash');
INSERT INTO goal_categories(id,code,name,display_order) VALUES
 ('00001703','fitness17','운동17',1);
INSERT INTO difficulty_levels(id,code,name,display_order) VALUES
 ('00001704','basic17','기본17',1);

-- 펫 (experience_pets_smoke와 같은 최소 구성)
INSERT INTO user_level_policy_versions(id,version_no,effective_at,created_by_admin_id) VALUES
 ('00001705',1,now()-interval '1 day','00001702');
INSERT INTO user_level_thresholds(policy_version_id,level_no,min_total_xp) VALUES
 ('00001705',1,0);
INSERT INTO pet_level_policy_versions(id,version_no,effective_at,created_by_admin_id) VALUES
 ('00001706',1,now()-interval '1 day','00001702');
INSERT INTO pet_level_thresholds(policy_version_id,level_no,min_total_xp) VALUES
 ('00001706',1,0);
INSERT INTO user_experience(user_id,level_policy_version_id) VALUES
 ('00001701','00001705');
INSERT INTO pet_species(id,code,name,status,created_by_admin_id) VALUES
 ('00001707','starter17','시작 펫','public','00001702');
INSERT INTO pet_stage_images(id,species_id,r2_object_key,mime_type,size_bytes,uploaded_at,created_by_admin_id) VALUES
 ('00001708','00001707','pets/starter17/egg.webp','image/webp',100,now()-interval '1 day','00001702'),
 ('00001709','00001707','pets/starter17/baby.webp','image/webp',100,now()-interval '1 day','00001702'),
 ('00001710','00001707','pets/starter17/adult.webp','image/webp',100,now()-interval '1 day','00001702');
INSERT INTO pet_species_versions(id,species_id,version_no,name,category_id,unlock_condition_type,hatch_mission_count,effective_at,created_by_admin_id) VALUES
 ('00001711','00001707',1,'시작 펫','00001703','none',0,now()-interval '1 day','00001702');
INSERT INTO pet_stage_versions(species_version_id,species_id,stage_no,stage_code,min_total_xp,bonus_basis_points,image_id) VALUES
 ('00001711','00001707',1,'egg',0,1000,'00001708'),
 ('00001711','00001707',2,'baby',50,1500,'00001709'),
 ('00001711','00001707',3,'adult',150,2000,'00001710');
INSERT INTO user_pets(id,user_id,species_id,species_version_id,level_policy_version_id,nickname) VALUES
 ('00001712','00001701','00001707','00001711','00001706','다람이');

-- 업적 지급(보상 XP 0): 대표 펫 없이 보류된 XP 보상의 원천
INSERT INTO goals
    (id, user_id, category_id, difficulty_id, title,
     start_date, end_date, status, completed_at)
VALUES ('00001713',
        '00001701',
        '00001703',
        '00001704',
        '첫 목표', CURRENT_DATE - 1, CURRENT_DATE + 1,
        'completed', now() - interval '1 hour');
INSERT INTO achievement_definitions (id, code, status, created_by_admin_id)
VALUES ('00001714',
        'first_goal_17', 'public', '00001702');
INSERT INTO achievement_badge_images
    (id, achievement_id, version_no, r2_object_key,
     mime_type, size_bytes, uploaded_at, created_by_admin_id)
VALUES ('00001715',
        '00001714',
        1, 'badges/first-goal-17/v1.webp', 'image/webp', 1024,
        now() - interval '2 days', '00001702');
INSERT INTO achievement_versions
    (id, achievement_id, version_no, title, description, rarity,
     condition_type, target_count, reward_points,
     badge_image_id, effective_at, created_by_admin_id)
VALUES ('00001716',
        '00001714',
        1, '첫 목표 달성', '첫 목표를 완료한다', 'common',
        'first_goal_completed', 1, 0,
        '00001715',
        now() - interval '2 days', '00001702');
INSERT INTO user_achievements
    (id, user_id, achievement_id, achievement_version_id,
     badge_image_id, source_type, source_id,
     first_achieved_at, awarded_points, paid_points)
VALUES ('00001717',
        '00001701',
        '00001714',
        '00001716',
        '00001715',
        'goal', '00001713',
        now() - interval '1 hour', 0, 0);

-- 보류 보상(수령 펫 없음)
INSERT INTO experience_awards
    (id, user_id, source_type, source_id, base_user_xp, base_pet_xp, status)
VALUES ('00001718',
        '00001701',
        'achievement', '00001717', 0, 0, 'active');

DO $$
BEGIN
    -- 배정 전에도 원천·수량은 불변
    BEGIN
        UPDATE experience_awards SET base_user_xp = 5
         WHERE id = '00001718';
        RAISE EXCEPTION 'pending award amount was changed';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 스냅샷 없이 펫만 채우는 배정은 테이블 CHECK가 거절
    BEGIN
        UPDATE experience_awards
           SET recipient_pet_id = '00001712'
         WHERE id = '00001718';
        RAISE EXCEPTION 'assignment without pet snapshot was accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 보류 배정에는 버프가 붙을 수 없음
    BEGIN
        UPDATE experience_awards
           SET recipient_pet_id = '00001712',
               pet_species_version_id = '00001711',
               pet_stage_no = 1,
               bonus_basis_points = 1000
         WHERE id = '00001718';
        RAISE EXCEPTION 'pending assignment carried a buff';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;

-- 배정은 한 번 허용
UPDATE experience_awards
   SET recipient_pet_id = '00001712',
       pet_species_version_id = '00001711',
       pet_stage_no = 1
 WHERE id = '00001718';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM experience_awards
                    WHERE id = '00001718'
                      AND recipient_pet_id = '00001712') THEN
        RAISE EXCEPTION 'pending assignment was not applied';
    END IF;

    -- 배정 뒤에는 수령 펫·단계·버프 불변
    BEGIN
        UPDATE experience_awards SET pet_stage_no = 2
         WHERE id = '00001718';
        RAISE EXCEPTION 'assigned award stage was changed';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE experience_awards SET recipient_pet_id = NULL,
               pet_species_version_id = NULL, pet_stage_no = NULL
         WHERE id = '00001718';
        RAISE EXCEPTION 'assigned award was unassigned';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- 회귀 방지: 함수가 챌린지 분기(008)와 보류 배정 규칙을 함께 가져야 함
    IF pg_get_functiondef('guard_experience_award()'::regprocedure)
           NOT LIKE '%challenge XP must retain settlement pet recipient%' THEN
        RAISE EXCEPTION 'guard_experience_award lost the challenge branch from 008';
    END IF;
    IF pg_get_functiondef('guard_experience_award()'::regprocedure)
           NOT LIKE '%XP award recipient is fixed once assigned%' THEN
        RAISE EXCEPTION 'guard_experience_award lost the pending-assignment rule';
    END IF;
END;
$$;

-- (구 smoke 015)
INSERT INTO admin_accounts (id, login_id, email, password_hash)
VALUES ('000f0151', 'smoke015', 'smoke015@example.com', 'x');

-- 배지는 version_no가 필요하고 펫 단계 이미지는 version_no가 없어야 함
DO $$
BEGIN
    BEGIN
        INSERT INTO admin_asset_uploads
            (id, asset_kind, owner_id, version_no, object_key, mime_type,
             size_bytes, created_by_admin_id)
        VALUES (new_short_id(), 'badge', new_short_id(), NULL, 'k1',
                'image/png', 10, '000f0151');
        RAISE EXCEPTION 'badge ticket without version_no accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO admin_asset_uploads
            (id, asset_kind, owner_id, version_no, object_key, mime_type,
             size_bytes, created_by_admin_id)
        VALUES (new_short_id(), 'pet_stage', new_short_id(), 1, 'k2',
                'image/png', 10, '000f0151');
        RAISE EXCEPTION 'pet_stage ticket with version_no accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    -- 올리기 전에는 사용 처리할 수 없음
    BEGIN
        INSERT INTO admin_asset_uploads
            (id, asset_kind, owner_id, version_no, object_key, mime_type,
             size_bytes, created_by_admin_id, consumed_at)
        VALUES (new_short_id(), 'badge', new_short_id(), 1, 'k3',
                'image/png', 10, '000f0151', now());
        RAISE EXCEPTION 'consumed ticket without upload accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END $$;

ROLLBACK;
