-- 관리자 이미지 업로드 티켓 (M84 발급 → M85 완료 → 업적/펫 종류 등록 때 사용)
-- 새 업적·펫 종류는 이미지보다 늦게 만들어지므로 owner_id는 FK 없이 미리 정한 UUID를 받는다
BEGIN;

CREATE TABLE admin_asset_uploads (
    id uuid PRIMARY KEY,
    asset_kind varchar(12) NOT NULL CHECK (asset_kind IN ('badge', 'pet_stage')),
    owner_id uuid NOT NULL,
    version_no integer CHECK (version_no > 0),
    object_key text NOT NULL UNIQUE CHECK (length(btrim(object_key)) > 0),
    mime_type varchar(40) NOT NULL
        CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
    size_bytes bigint NOT NULL CHECK (size_bytes > 0),
    created_by_admin_id uuid NOT NULL
        REFERENCES admin_accounts(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    uploaded_at timestamptz,
    consumed_at timestamptz,
    CHECK ((asset_kind = 'badge') = (version_no IS NOT NULL)),
    CHECK (consumed_at IS NULL OR uploaded_at IS NOT NULL)
);

CREATE INDEX admin_asset_uploads_owner_idx
    ON admin_asset_uploads (asset_kind, owner_id);
CREATE INDEX admin_asset_uploads_admin_idx
    ON admin_asset_uploads (created_by_admin_id);

COMMIT;
