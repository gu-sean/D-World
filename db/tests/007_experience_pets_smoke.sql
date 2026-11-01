-- smoke 007, 샘플 데이터는 롤백
BEGIN;
INSERT INTO users(id) VALUES ('00000000-0000-0000-0000-000000000701');
INSERT INTO profiles(user_id,nickname) VALUES
 ('00000000-0000-0000-0000-000000000701','PetHero07');
INSERT INTO admin_accounts(id,login_id,email,password_hash) VALUES
 ('00000000-0000-0000-0000-000000000702','owner07','owner07@example.com','hash');
INSERT INTO goal_categories(id,code,name,display_order) VALUES
 ('00000000-0000-0000-0000-000000000703','fitness07','운동07',1);
INSERT INTO user_level_policy_versions(id,version_no,effective_at,created_by_admin_id) VALUES
 ('00000000-0000-0000-0000-000000000704',1,now()-interval '1 day','00000000-0000-0000-0000-000000000702');
INSERT INTO user_level_thresholds(policy_version_id,level_no,min_total_xp) VALUES
 ('00000000-0000-0000-0000-000000000704',1,0),
 ('00000000-0000-0000-0000-000000000704',2,100);
INSERT INTO pet_level_policy_versions(id,version_no,effective_at,created_by_admin_id) VALUES
 ('00000000-0000-0000-0000-000000000705',1,now()-interval '1 day','00000000-0000-0000-0000-000000000702');
INSERT INTO pet_level_thresholds(policy_version_id,level_no,min_total_xp) VALUES
 ('00000000-0000-0000-0000-000000000705',1,0),
 ('00000000-0000-0000-0000-000000000705',2,100);
INSERT INTO user_experience(user_id,level_policy_version_id) VALUES
 ('00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000704');
INSERT INTO pet_species(id,code,name,status,created_by_admin_id) VALUES
 ('00000000-0000-0000-0000-000000000706','starter07','시작 펫','public','00000000-0000-0000-0000-000000000702');
INSERT INTO pet_stage_images(id,species_id,r2_object_key,mime_type,size_bytes,uploaded_at,created_by_admin_id) VALUES
 ('00000000-0000-0000-0000-000000000707','00000000-0000-0000-0000-000000000706','pets/starter07/egg.webp','image/webp',100,now()-interval '1 day','00000000-0000-0000-0000-000000000702'),
 ('00000000-0000-0000-0000-000000000708','00000000-0000-0000-0000-000000000706','pets/starter07/baby.webp','image/webp',100,now()-interval '1 day','00000000-0000-0000-0000-000000000702'),
 ('00000000-0000-0000-0000-000000000709','00000000-0000-0000-0000-000000000706','pets/starter07/adult.webp','image/webp',100,now()-interval '1 day','00000000-0000-0000-0000-000000000702');
INSERT INTO pet_species_versions(id,species_id,version_no,name,category_id,unlock_condition_type,hatch_mission_count,effective_at,created_by_admin_id) VALUES
 ('00000000-0000-0000-0000-000000000710','00000000-0000-0000-0000-000000000706',1,'시작 펫','00000000-0000-0000-0000-000000000703','none',0,now()-interval '1 day','00000000-0000-0000-0000-000000000702');
INSERT INTO pet_stage_versions(species_version_id,species_id,stage_no,stage_code,min_total_xp,bonus_basis_points,image_id) VALUES
 ('00000000-0000-0000-0000-000000000710','00000000-0000-0000-0000-000000000706',1,'egg',0,1000,'00000000-0000-0000-0000-000000000707'),
 ('00000000-0000-0000-0000-000000000710','00000000-0000-0000-0000-000000000706',2,'baby',50,1500,'00000000-0000-0000-0000-000000000708'),
 ('00000000-0000-0000-0000-000000000710','00000000-0000-0000-0000-000000000706',3,'adult',150,2000,'00000000-0000-0000-0000-000000000709');
INSERT INTO user_pets(id,user_id,species_id,species_version_id,level_policy_version_id,nickname) VALUES
 ('00000000-0000-0000-0000-000000000711','00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000706','00000000-0000-0000-0000-000000000710','00000000-0000-0000-0000-000000000705','다람이');
UPDATE profiles SET representative_pet_id='00000000-0000-0000-0000-000000000711'
 WHERE user_id='00000000-0000-0000-0000-000000000701';

DO $$ BEGIN
  BEGIN
    UPDATE user_experience SET total_xp=100 WHERE user_id='00000000-0000-0000-0000-000000000701';
    RAISE EXCEPTION 'wrong user level accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE user_pets SET stage_no=2 WHERE id='00000000-0000-0000-0000-000000000711';
    RAISE EXCEPTION 'premature pet stage accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    DELETE FROM user_pets WHERE id='00000000-0000-0000-0000-000000000711';
    RAISE EXCEPTION 'direct pet deletion accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

UPDATE user_experience SET total_xp=100,level_no=2
 WHERE user_id='00000000-0000-0000-0000-000000000701';
UPDATE user_pets SET total_xp=50,level_no=1,stage_no=2
 WHERE id='00000000-0000-0000-0000-000000000711';
INSERT INTO pet_evolution_events(id,user_pet_id,from_stage_no,to_stage_no,total_xp_after,reason) VALUES
 ('00000000-0000-0000-0000-000000000712','00000000-0000-0000-0000-000000000711',1,2,50,'growth');
ROLLBACK;
