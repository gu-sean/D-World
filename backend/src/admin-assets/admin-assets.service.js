import { newId } from '../common/ids.js';
import { Dependencies, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { conflict, notFound } from '../common/errors/http-errors.js';
import { badgeImageKey, petImageKey } from '../media/storage/keys.js';
import { OBJECT_STORAGE } from '../media/storage/object-storage.js';
import { DatabaseService } from '../database/database.service.js';

export const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const EXTENSIONS = {
  'image/png': 'png',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
};
const VIEW_URL_TTL_SEC = 3600;

/** "image/png; charset=x" 같은 값을 비교용으로 정규화 (media 모듈과 같은 규칙) */
const normalizeType = (value) =>
  String(value ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();

/**
 * 관리자 이미지(배지·펫 단계) 업로드 티켓과 등록
 * 업로드 티켓(M84) → 저장소 확인(M85) → 업적/펫 종류 등록 때 이미지 행으로 확정
 * 새 업적·펫 종류는 아직 없으므로 티켓의 ownerId를 미리 정한 id로 받는다
 */
@Injectable()
@Dependencies(ConfigService, OBJECT_STORAGE, DatabaseService)
export class AdminAssetsService {
  constructor(config, storage, database) {
    this.config = config;
    this.storage = storage;
    this.database = database;
  }

  viewUrl(key) {
    return this.storage.presignGet({ key, expiresInSec: VIEW_URL_TTL_SEC });
  }

  /** M84: 업로드 티켓 발급 */
  async createTicket(tx, { adminId, assetKind, ownerId, mimeType, sizeBytes }) {
    const assetId = newId();
    const extension = EXTENSIONS[mimeType];
    const prefix = this.config.get('R2_KEY_PREFIX');
    let versionNo = null;
    let objectKey;
    if (assetKind === 'badge') {
      const { rows } = await tx.query(
        `SELECT GREATEST(
                  COALESCE((SELECT max(version_no) FROM achievement_badge_images
                             WHERE achievement_id = $1), 0),
                  COALESCE((SELECT max(version_no) FROM admin_asset_uploads
                             WHERE asset_kind = 'badge' AND owner_id = $1), 0)
                ) + 1 AS next`,
        [ownerId],
      );
      versionNo = rows[0].next;
      objectKey = badgeImageKey({
        prefix,
        achievementId: ownerId,
        versionNo,
        extension,
      });
    } else {
      objectKey = petImageKey({
        prefix,
        speciesId: ownerId,
        stageCode: 'stage',
        imageId: assetId,
        extension,
      });
    }
    await tx.query(
      `INSERT INTO admin_asset_uploads
         (id, asset_kind, owner_id, version_no, object_key, mime_type,
          size_bytes, created_by_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        assetId,
        assetKind,
        ownerId,
        versionNo,
        objectKey,
        mimeType,
        sizeBytes,
        adminId,
      ],
    );
    const ttl = this.config.get('R2_UPLOAD_URL_TTL_SEC');
    const { url, headers } = await this.storage.presignPut({
      key: objectKey,
      contentType: mimeType,
      contentLength: sizeBytes,
      expiresInSec: ttl,
    });
    return {
      assetId,
      assetKind,
      ownerId,
      uploadUrl: url,
      uploadHeaders: headers,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  }

  /**
   * M85 앞단: 저장소 확인(head)은 DB 트랜잭션·잠금 밖에서 한 번 수행
   * 이미 확인된 티켓이면 저장소를 다시 부르지 않음. 반환값을 completeTicket에 넘김
   */
  async inspectUpload(assetId) {
    const { rows } = await this.database.query(
      'SELECT object_key, uploaded_at FROM admin_asset_uploads WHERE id = $1',
      [assetId],
    );
    if (rows.length === 0) {
      throw notFound('asset_not_found', '이미지를 찾을 수 없음');
    }
    if (rows[0].uploaded_at) return { alreadyUploaded: true, head: null };
    return {
      alreadyUploaded: false,
      head: await this.storage.head(rows[0].object_key),
    };
  }

  /** M85: 확인 결과를 기록, 주인이 이미 있으면 이미지 행까지 만듦 */
  async completeTicket(tx, assetId, { head }) {
    const ticket = await this.lockTicket(tx, assetId);
    if (!ticket.uploaded_at) {
      if (!head) {
        throw conflict('ADMIN_STATE_CONFLICT', '업로드된 파일이 없어요.');
      }
      if (
        Number(head.size) !== Number(ticket.size_bytes) ||
        normalizeType(head.contentType) !== ticket.mime_type
      ) {
        throw conflict(
          'ADMIN_STATE_CONFLICT',
          '신고한 형식·크기와 올린 파일이 달라요.',
        );
      }
      await tx.query(
        'UPDATE admin_asset_uploads SET uploaded_at = now() WHERE id = $1',
        [assetId],
      );
      ticket.uploaded_at = new Date();
    }
    if (!ticket.consumed_at && (await this.ownerExists(tx, ticket))) {
      await this.consume(tx, ticket);
    }
    return { assetId, imageUrl: await this.viewUrl(ticket.object_key) };
  }

  async ownerExists(tx, ticket) {
    const table =
      ticket.asset_kind === 'badge' ? 'achievement_definitions' : 'pet_species';
    const { rows } = await tx.query(`SELECT 1 FROM ${table} WHERE id = $1`, [
      ticket.owner_id,
    ]);
    return rows.length > 0;
  }

  async lockTicket(tx, assetId) {
    const { rows } = await tx.query(
      'SELECT * FROM admin_asset_uploads WHERE id = $1 FOR UPDATE',
      [assetId],
    );
    if (rows.length === 0) {
      throw notFound('asset_not_found', '이미지를 찾을 수 없음');
    }
    return rows[0];
  }

  /** 이미지 행 삽입(주인이 있어야 함)과 사용 처리 */
  async consume(tx, ticket) {
    if (ticket.asset_kind === 'badge') {
      await tx.query(
        `INSERT INTO achievement_badge_images
           (id, achievement_id, version_no, r2_object_key, mime_type,
            size_bytes, uploaded_at, created_by_admin_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          ticket.id,
          ticket.owner_id,
          ticket.version_no,
          ticket.object_key,
          ticket.mime_type,
          ticket.size_bytes,
          ticket.uploaded_at,
          ticket.created_by_admin_id,
        ],
      );
    } else {
      await tx.query(
        `INSERT INTO pet_stage_images
           (id, species_id, r2_object_key, mime_type, size_bytes, uploaded_at,
            created_by_admin_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          ticket.id,
          ticket.owner_id,
          ticket.object_key,
          ticket.mime_type,
          ticket.size_bytes,
          ticket.uploaded_at,
          ticket.created_by_admin_id,
        ],
      );
    }
    await tx.query(
      'UPDATE admin_asset_uploads SET consumed_at = now() WHERE id = $1',
      [ticket.id],
    );
  }

  /**
   * 업적·펫 종류 등록에서 쓸 이미지 확정, 주인(ownerId)이 이미 만들어져 있어야 함
   * 업로드가 끝나지 않았거나 다른 주인의 이미지면 거절
   */
  async useAsset(tx, { assetId, assetKind, ownerId }) {
    const ticket = await this.lockTicket(tx, assetId);
    if (ticket.asset_kind !== assetKind || ticket.owner_id !== ownerId) {
      throw conflict(
        'ADMIN_STATE_CONFLICT',
        '이 항목에 올린 이미지가 아니에요.',
      );
    }
    if (!ticket.uploaded_at) {
      throw conflict(
        'ADMIN_STATE_CONFLICT',
        '이미지 업로드를 먼저 완료해 주세요.',
      );
    }
    if (!ticket.consumed_at) await this.consume(tx, ticket);
    return ticket.id;
  }

  /** 새 항목의 미리 정한 id: 이미지가 하나라도 있어야 하고 모두 같은 주인이어야 함 */
  async ownerOfNewItem(tx, assetKind, assetIds) {
    const { rows } = await tx.query(
      `SELECT DISTINCT owner_id FROM admin_asset_uploads
        WHERE asset_kind = $1 AND id = ANY($2::short_id[])`,
      [assetKind, assetIds],
    );
    if (rows.length === 0) {
      throw notFound('asset_not_found', '이미지를 찾을 수 없음');
    }
    if (rows.length > 1) {
      throw conflict(
        'ADMIN_STATE_CONFLICT',
        '서로 다른 항목용으로 올린 이미지가 섞여 있어요.',
      );
    }
    return rows[0].owner_id;
  }
}
