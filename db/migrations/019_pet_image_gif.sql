-- 펫 단계 이미지에 GIF 허용
--   동물 이미지가 움직이는 GIF라서 펫 단계 이미지(pet_stage_images)와 업로드 티켓(admin_asset_uploads)이
--   image/gif를 받도록 형식 검사를 넓힌다. 배지 이미지(achievement_badge_images)는 그대로 PNG·JPEG·WebP만 받는다.
BEGIN;

ALTER TABLE pet_stage_images DROP CONSTRAINT pet_stage_images_mime_type_check;
ALTER TABLE pet_stage_images ADD CONSTRAINT pet_stage_images_mime_type_check
    CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif'));

ALTER TABLE admin_asset_uploads DROP CONSTRAINT admin_asset_uploads_mime_type_check;
ALTER TABLE admin_asset_uploads ADD CONSTRAINT admin_asset_uploads_mime_type_check
    CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')
           AND (asset_kind = 'pet_stage' OR mime_type <> 'image/gif'));

COMMIT;
