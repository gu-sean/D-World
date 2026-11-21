-- 세부 미션 보상 통일 (2026-11): 관리자 미션 틀의 보상도 모든 세부 미션과 같게 30P · 펫 XP 30으로 맞춘다.
--   미션 틀로 만든 미션은 틀의 base_* 값을 그대로 복사한다(validate_mission_reward 트리거가 틀의 값과 같아야 통과시킨다).
--   그래서 틀의 값이 다르면 같은 세부 미션인데 보상이 달라진다. 보상표(022)와 같은 값으로 맞춘다.
--   이미 만들어진 미션의 보상은 만들 때 고정이라(lock_mission_reward) 바뀌지 않고, 앞으로 만드는 미션부터 적용된다.
--   사용자 XP는 쓰지 않아 0. 사용자가 만든 틀(origin='user')은 보상표를 쓰므로 건드리지 않는다.
BEGIN;

UPDATE mission_definitions
   SET base_points = 30, base_user_xp = 0, base_pet_xp = 30
 WHERE origin = 'admin'
   AND (base_points <> 30 OR base_user_xp <> 0 OR base_pet_xp <> 30);

COMMIT;
