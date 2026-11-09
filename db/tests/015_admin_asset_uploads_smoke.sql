-- smoke 015: 이미지 업로드 티켓의 종류별 제약과 사용 순서 확인
BEGIN;

INSERT INTO admin_accounts (id, login_id, email, password_hash)
VALUES ('00000000-0000-0000-0000-0000000f0151', 'smoke015', 'smoke015@example.com', 'x');

-- 배지는 version_no가 필요하고 펫 단계 이미지는 version_no가 없어야 함
DO $$
BEGIN
    BEGIN
        INSERT INTO admin_asset_uploads
            (id, asset_kind, owner_id, version_no, object_key, mime_type,
             size_bytes, created_by_admin_id)
        VALUES (gen_random_uuid(), 'badge', gen_random_uuid(), NULL, 'k1',
                'image/png', 10, '00000000-0000-0000-0000-0000000f0151');
        RAISE EXCEPTION 'badge ticket without version_no accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO admin_asset_uploads
            (id, asset_kind, owner_id, version_no, object_key, mime_type,
             size_bytes, created_by_admin_id)
        VALUES (gen_random_uuid(), 'pet_stage', gen_random_uuid(), 1, 'k2',
                'image/png', 10, '00000000-0000-0000-0000-0000000f0151');
        RAISE EXCEPTION 'pet_stage ticket with version_no accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    -- 올리기 전에는 사용 처리할 수 없음
    BEGIN
        INSERT INTO admin_asset_uploads
            (id, asset_kind, owner_id, version_no, object_key, mime_type,
             size_bytes, created_by_admin_id, consumed_at)
        VALUES (gen_random_uuid(), 'badge', gen_random_uuid(), 1, 'k3',
                'image/png', 10, '00000000-0000-0000-0000-0000000f0151', now());
        RAISE EXCEPTION 'consumed ticket without upload accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END $$;

ROLLBACK;
