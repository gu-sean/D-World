import { randomUUID } from 'node:crypto';
import { Dependencies, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/errors/app-exception.js';
import { DatabaseService } from '../database/database.service.js';
import { DOWNLOAD_URL_TTL_SEC, MEDIA_RULES } from './media.constants.js';
import { OPEN_RECORD_STATUSES } from '../verification/records/records.constants.js';
import { recordMediaKey } from './storage/keys.js';
import { OBJECT_STORAGE } from './storage/object-storage.js';
import { conflict, unprocessable } from '../common/errors/http-errors.js';

const num = (value) => Number(value);

const recordNotFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'record_not_found',
    '수행 회차를 찾을 수 없음',
  );
const mediaNotFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'media_not_found',
    '파일을 찾을 수 없음',
  );

/** "image/jpeg; charset=x" 같은 값을 비교용으로 정규화 */
const normalizeType = (value) =>
  String(value ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();

const COLUMNS = `id, user_id, record_id, object_key, media_kind, mime_type, expected_size_bytes,
  actual_size_bytes, checksum_sha256, upload_status, upload_url_expires_at, uploaded_at,
  deleted_at, created_at`;

/**
 * 인증 원본(R2) 관리
 * - 객체 키는 서버가 생성, 응답에 노출 안 함
 * - R2와 DB는 원자적이지 않으므로 상태(pending → uploaded, uploaded → deleting → deleted)로 표현하고,
 *   R2 호출은 가능한 한 DB 잠금 밖, 실패한 정리는 상태에 남겨 작업이 재시도
 * - 잠금 순서: 미션 → 회차 → 파일 (판정 반영과 같은 순서라 교착이 생기지 않는다)
 */
@Injectable()
@Dependencies(DatabaseService, ConfigService, OBJECT_STORAGE)
export class MediaService {
  logger = new Logger(MediaService.name);

  constructor(database, config, storage) {
    this.database = database;
    this.config = config;
    this.storage = storage;
  }

  get uploadTtlSec() {
    return this.config.get('R2_UPLOAD_URL_TTL_SEC');
  }

  toView(row) {
    return {
      id: row.id,
      mediaId: row.id,
      recordId: row.record_id,
      uploadStatus: row.upload_status,
      mediaKind: row.media_kind,
      mimeType: row.mime_type,
      sizeBytes: num(row.expected_size_bytes),
      actualSizeBytes:
        row.actual_size_bytes === null ? null : num(row.actual_size_bytes),
      checksumSha256: row.checksum_sha256,
      status: row.upload_status,
      uploadUrlExpiresAt: row.upload_url_expires_at,
      uploadedAt: row.uploaded_at,
      createdAt: row.created_at,
    };
  }

  /** 미션 → 회차 순서로 잠그고 상태와 인증 방식을 돌려줌, 소유자가 아니면 404 */
  async lockRecord(tx, userId, recordId) {
    const { rows: owner } = await tx.query(
      userId === null
        ? 'SELECT mission_id FROM mission_records WHERE id = $1'
        : 'SELECT mission_id FROM mission_records WHERE id = $1 AND user_id = $2',
      userId === null ? [recordId] : [recordId, userId],
    );
    if (!owner[0]) throw recordNotFound();
    const { rows: mission } = await tx.query(
      'SELECT verification_method FROM missions WHERE id = $1 FOR UPDATE',
      [owner[0].mission_id],
    );
    const { rows } = await tx.query(
      'SELECT id, status FROM mission_records WHERE id = $1 FOR UPDATE',
      [recordId],
    );
    return {
      id: recordId,
      status: rows[0].status,
      method: mission[0].verification_method,
    };
  }

  assertOpen(record) {
    if (!OPEN_RECORD_STATUSES.includes(record.status)) {
      throw conflict(
        'record_not_open',
        '파일을 추가·변경할 수 없는 회차 상태',
        {
          status: record.status,
        },
      );
    }
  }

  /** 소유자 확인과 함께 파일 한 건, 다른 사람의 파일은 404 */
  async findOwned(db, userId, mediaId, { lock = false } = {}) {
    const { rows } = await db.query(
      `SELECT ${COLUMNS} FROM media_files WHERE id = $1 AND user_id = $2 ${lock ? 'FOR UPDATE' : ''}`,
      [mediaId, userId],
    );
    if (!rows[0]) throw mediaNotFound();
    return rows[0];
  }

  /**
   * 업로드 등록: media_files(pending)를 만들고 서명된 업로드 URL을 돌려줌
   * 종류·형식·크기·개수 검증, 첫 파일 등록 시 회차가 uploading으로 전이
   */
  async register(userId, recordId, input) {
    const rule = MEDIA_RULES[input.mediaKind];
    const extension = rule?.mimeTypes[normalizeType(input.mimeType)];
    if (!rule)
      throw unprocessable('unsupported_media', '지원하지 않는 파일 종류');
    if (!extension) {
      throw unprocessable('unsupported_media', '허용되지 않는 파일 형식', {
        reason: 'mime_type',
        allowed: Object.keys(rule.mimeTypes),
      });
    }
    if (input.sizeBytes > rule.maxBytes) {
      throw unprocessable('unsupported_media', '파일이 너무 큼', {
        reason: 'too_large',
        maxBytes: rule.maxBytes,
      });
    }

    return this.database.withTransaction(async (tx) => {
      const record = await this.lockRecord(tx, userId, recordId);
      this.assertOpen(record);
      if (record.method !== rule.method) {
        throw unprocessable(
          'unsupported_media',
          '이 미션의 인증 방식에 맞지 않는 파일 종류',
          {
            reason: 'kind_not_allowed_for_method',
            method: record.method,
          },
        );
      }

      // 실패·삭제된 파일은 개수에서 제외, 카메라 증거는 사진·영상을 합쳐 센다(AI는 파일 1개만 받음)
      const kinds = Object.entries(MEDIA_RULES)
        .filter(([, other]) => other.method === rule.method)
        .map(([kind]) => kind);
      const { rows: count } = await tx.query(
        `SELECT count(*) AS n FROM media_files
          WHERE record_id = $1 AND media_kind = ANY($2::text[])
            AND upload_status IN ('pending', 'uploaded')`,
        [recordId, kinds],
      );
      if (num(count[0].n) >= rule.maxPerRecord) {
        throw conflict(
          'media_limit_reached',
          `증거 파일은 회차당 최대 ${rule.maxPerRecord}개`,
          {
            mediaKind: input.mediaKind,
          },
        );
      }

      const id = randomUUID();
      const key = recordMediaKey({
        prefix: this.config.get('R2_KEY_PREFIX'),
        userId,
        recordId,
        mediaId: id,
        extension,
      });
      const { rows } = await tx.query(
        `INSERT INTO media_files
                (id, user_id, record_id, object_key, media_kind, mime_type,
                 expected_size_bytes, checksum_sha256, upload_url_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + ($9::int * interval '1 second'))
         RETURNING ${COLUMNS}`,
        [
          id,
          userId,
          recordId,
          key,
          input.mediaKind,
          normalizeType(input.mimeType),
          input.sizeBytes,
          input.checksumSha256?.toLowerCase() ?? null,
          this.uploadTtlSec,
        ],
      );
      if (record.status === 'recording') {
        await tx.query(
          `UPDATE mission_records SET status = 'uploading' WHERE id = $1 AND status = 'recording'`,
          [recordId],
        );
      }
      return {
        ...this.toView(rows[0]),
        upload: await this.presignUpload(rows[0]),
      };
    });
  }

  async presignUpload(row) {
    const { url, headers } = await this.storage.presignPut({
      key: row.object_key,
      contentType: row.mime_type,
      contentLength: num(row.expected_size_bytes),
      checksumSha256: row.checksum_sha256 ?? undefined,
      expiresInSec: this.uploadTtlSec,
    });
    return { url, headers, expiresAt: row.upload_url_expires_at };
  }

  /**
   * 업로드 확인: 클라이언트 통보를 신뢰하지 않고 서버가 R2에서 크기·형식·체크섬 확인
   * 미업로드면 422(상태 유지), 신고와 다른 파일이면 failed 처리 후 객체 삭제
   */
  async complete(userId, mediaId) {
    const before = await this.findOwned(this.database, userId, mediaId);
    if (before.upload_status === 'uploaded') return this.toView(before);
    if (before.upload_status !== 'pending') {
      throw conflict('media_not_pending', '업로드를 확인할 수 없는 파일 상태', {
        status: before.upload_status,
      });
    }

    // R2 호출은 DB 잠금 밖에서
    const head = await this.storage.head(before.object_key);

    const outcome = await this.database.withTransaction(async (tx) => {
      const record = await this.lockRecord(tx, userId, before.record_id);
      const media = await this.findOwned(tx, userId, mediaId, { lock: true });
      if (media.upload_status === 'uploaded')
        return { view: this.toView(media) };
      if (media.upload_status !== 'pending') {
        throw conflict(
          'media_not_pending',
          '업로드를 확인할 수 없는 파일 상태',
          {
            status: media.upload_status,
          },
        );
      }
      this.assertOpen(record);

      if (!head) {
        return {
          incomplete: {
            expired:
              new Date(media.upload_url_expires_at).getTime() < Date.now(),
          },
        };
      }
      const mismatch = this.findMismatch(media, head);
      if (mismatch) {
        await tx.query(
          `UPDATE media_files SET upload_status = 'failed', updated_at = now() WHERE id = $1`,
          [mediaId],
        );
        return { mismatch, key: media.object_key };
      }
      const { rows } = await tx.query(
        `UPDATE media_files
            SET upload_status = 'uploaded', actual_size_bytes = $2, uploaded_at = now(),
                checksum_sha256 = COALESCE($3, checksum_sha256), updated_at = now()
          WHERE id = $1 RETURNING ${COLUMNS}`,
        [mediaId, head.size, head.checksumSha256],
      );
      return { view: this.toView(rows[0]) };
    });

    if (outcome.view) return outcome.view;
    if (outcome.mismatch) {
      await this.deleteObjectQuietly(outcome.key);
      throw unprocessable(
        'upload_mismatch',
        '신고한 내용과 다른 파일이 올라옴',
        {
          reason: outcome.mismatch,
        },
      );
    }
    throw unprocessable(
      'upload_incomplete',
      '아직 업로드가 확인되지 않음',
      outcome.incomplete,
    );
  }

  /** 신고(크기·형식·체크섬)와 R2에서 확인한 값이 다른 이유, 같으면 null */
  findMismatch(media, head) {
    if (head.size !== num(media.expected_size_bytes)) return 'size';
    if (normalizeType(head.contentType) !== media.mime_type)
      return 'content_type';
    if (
      media.checksum_sha256 &&
      head.checksumSha256 &&
      media.checksum_sha256 !== head.checksumSha256
    ) {
      return 'checksum';
    }
    return null;
  }

  /** 만료됐거나 실패한 업로드를 새 URL로 다시 시도, 같은 객체 키를 재사용 */
  async retry(userId, mediaId) {
    const row = await this.database.withTransaction(async (tx) => {
      const probe = await this.findOwned(tx, userId, mediaId);
      const record = await this.lockRecord(tx, userId, probe.record_id);
      const media = await this.findOwned(tx, userId, mediaId, { lock: true });
      if (media.upload_status === 'uploaded') {
        throw conflict('media_already_uploaded', '이미 업로드가 확인된 파일');
      }
      if (!['pending', 'failed'].includes(media.upload_status)) {
        throw conflict('media_not_pending', '다시 시도할 수 없는 파일 상태', {
          status: media.upload_status,
        });
      }
      this.assertOpen(record);

      const { rows } = await tx.query(
        `UPDATE media_files
            SET upload_status = 'pending', upload_url_expires_at = now() + ($2::int * interval '1 second'),
                updated_at = now()
          WHERE id = $1 RETURNING ${COLUMNS}`,
        [mediaId, this.uploadTtlSec],
      );
      return rows[0];
    });
    // 이전 시도의 불완전한 객체를 지운 뒤 URL을 돌려줘서, 새 업로드를 지우는 일이 없게 함
    await this.deleteObjectQuietly(row.object_key);
    return { ...this.toView(row), upload: await this.presignUpload(row) };
  }

  /** 제출 전 회차에서 파일 삭제, 확인된 파일은 deleting을 거쳐 R2 삭제 확인 후 deleted */
  async remove(userId, mediaId) {
    const state = await this.database.withTransaction(async (tx) => {
      const probe = await this.findOwned(tx, userId, mediaId);
      if (probe.upload_status === 'deleted') return { done: true };
      const record = await this.lockRecord(tx, userId, probe.record_id);
      const media = await this.findOwned(tx, userId, mediaId, { lock: true });
      if (media.upload_status === 'deleted') return { done: true };
      this.assertOpen(record);

      if (media.upload_status === 'uploaded') {
        await tx.query(
          `UPDATE media_files SET upload_status = 'deleting', updated_at = now() WHERE id = $1`,
          [mediaId],
        );
        return { key: media.object_key, finish: true };
      }
      if (media.upload_status === 'deleting')
        return { key: media.object_key, finish: true };
      // 업로드가 확인되지 않은 파일은 바로 삭제 처리하고 남은 객체는 아래에서 지움
      await tx.query(
        `UPDATE media_files SET upload_status = 'deleted', deleted_at = now(), updated_at = now() WHERE id = $1`,
        [mediaId],
      );
      return { key: media.object_key, finish: false };
    });
    if (state.done) return;

    if (!state.finish) {
      await this.deleteObjectQuietly(state.key);
      return;
    }
    // R2 삭제 실패 시 deleting 유지, 작업(finishDeletions)이 재시도
    if (await this.deleteObjectQuietly(state.key)) {
      await this.database.query(
        `UPDATE media_files SET upload_status = 'deleted', deleted_at = now(), updated_at = now()
          WHERE id = $1 AND upload_status = 'deleting'`,
        [mediaId],
      );
    }
  }

  /** 회차의 파일 목록(삭제된 파일 제외), 객체 키는 노출하지 않음 */
  async list(userId, recordId) {
    const { rows: record } = await this.database.query(
      'SELECT 1 FROM mission_records WHERE id = $1 AND user_id = $2',
      [recordId, userId],
    );
    if (!record[0]) throw recordNotFound();
    const { rows } = await this.database.query(
      `SELECT ${COLUMNS} FROM media_files
        WHERE record_id = $1 AND user_id = $2 AND upload_status <> 'deleted'
        ORDER BY created_at, id`,
      [recordId, userId],
    );
    return { items: rows.map((row) => this.toView(row)) };
  }

  /** 소유자용 조회 URL(짧은 유효 시간), 업로드가 확인된 파일만 */
  async signedUrl(userId, mediaId) {
    return this.downloadUrl(
      await this.findOwned(this.database, userId, mediaId),
    );
  }

  /** 관리자 검수용 조회 URL, 호출하는 쪽이 관리자 권한을 확인해야 함 */
  async signedUrlForAdmin(mediaId) {
    const { rows } = await this.database.query(
      `SELECT ${COLUMNS} FROM media_files WHERE id = $1`,
      [mediaId],
    );
    if (!rows[0]) throw mediaNotFound();
    return this.downloadUrl(rows[0]);
  }

  async downloadUrl(row) {
    if (row.upload_status !== 'uploaded') {
      throw conflict(
        'media_not_uploaded',
        '업로드가 확인된 파일만 조회할 수 있음',
        {
          status: row.upload_status,
        },
      );
    }
    const url = await this.storage.presignGet({
      key: row.object_key,
      expiresInSec: DOWNLOAD_URL_TTL_SEC,
    });
    return {
      url,
      expiresAt: new Date(
        Date.now() + DOWNLOAD_URL_TTL_SEC * 1000,
      ).toISOString(),
    };
  }

  /** R2 객체 삭제, 실패해도 예외를 던지지 않고 성공 여부만 반환(호출자가 상태로 재시도 판단) */
  async deleteObjectQuietly(key) {
    try {
      await this.storage.delete(key);
      return true;
    } catch (error) {
      this.logger.warn(`R2 객체 삭제 실패 ${key}: ${error.message}`);
      return false;
    }
  }

  // ---- 작업(JobsModule이 호출): 스케줄러 연결 전에도 단독으로 호출·테스트할 수 있음 ----

  /**
   * 업로드 URL이 만료된 pending 정리
   * 객체가 신고와 맞게 올라와 있으면 uploaded로 확정(앱이 complete를 못 부르고 죽은 경우),
   * 없거나 다르면 failed로 바꾸고 남은 객체를 지움
   */
  async reconcileExpiredPending({ limit = 200 } = {}) {
    const { rows } = await this.database.query(
      `SELECT id, record_id FROM media_files
        WHERE upload_status = 'pending' AND upload_url_expires_at < now()
        ORDER BY upload_url_expires_at LIMIT $1`,
      [limit],
    );
    const result = { uploaded: 0, failed: 0 };
    for (const { id, record_id: recordId } of rows) {
      const { rows: current } = await this.database.query(
        `SELECT ${COLUMNS} FROM media_files WHERE id = $1`,
        [id],
      );
      const head = current[0]
        ? await this.storage.head(current[0].object_key)
        : null;

      const outcome = await this.database.withTransaction(async (tx) => {
        await this.lockRecord(tx, null, recordId);
        const { rows: locked } = await tx.query(
          `SELECT ${COLUMNS} FROM media_files WHERE id = $1 FOR UPDATE`,
          [id],
        );
        const media = locked[0];
        if (!media || media.upload_status !== 'pending') return null;
        if (head && !this.findMismatch(media, head)) {
          await tx.query(
            `UPDATE media_files
                SET upload_status = 'uploaded', actual_size_bytes = $2, uploaded_at = now(),
                    checksum_sha256 = COALESCE($3, checksum_sha256), updated_at = now()
              WHERE id = $1`,
            [id, head.size, head.checksumSha256],
          );
          return { uploaded: true };
        }
        await tx.query(
          `UPDATE media_files SET upload_status = 'failed', updated_at = now() WHERE id = $1`,
          [id],
        );
        return { uploaded: false, key: head ? media.object_key : null };
      });
      if (!outcome) continue;
      if (outcome.uploaded) result.uploaded += 1;
      else {
        result.failed += 1;
        if (outcome.key) await this.deleteObjectQuietly(outcome.key);
      }
    }
    return result;
  }

  /** deleting 상태에서 멈춘 파일의 R2 삭제를 마무리 */
  async finishDeletions({ limit = 200 } = {}) {
    const { rows } = await this.database.query(
      `SELECT id, object_key FROM media_files WHERE upload_status = 'deleting'
        ORDER BY updated_at LIMIT $1`,
      [limit],
    );
    return this.purgeRows(rows);
  }

  /** 탈퇴: 사용자의 모든 파일을 R2에서 지우고 deleted로, 다 끝나야 계정 삭제가 가능(DB 트리거) */
  async deleteAllForUser(userId, { limit = 200 } = {}) {
    return this.purgeWhere('user_id = $1', userId, limit);
  }

  /** 포기한 회차의 파일 정리 */
  async deleteAllForRecord(recordId, { limit = 200 } = {}) {
    return this.purgeWhere('record_id = $1', recordId, limit);
  }

  async purgeWhere(condition, value, limit) {
    // condition은 위 두 고정 문자열만 전달
    const { rows } = await this.database.query(
      `SELECT id, object_key, upload_status FROM media_files
        WHERE ${condition} AND upload_status <> 'deleted' ORDER BY created_at LIMIT $2`,
      [value, limit],
    );
    const result = await this.purgeRows(rows);
    const { rows: left } = await this.database.query(
      `SELECT count(*) AS n FROM media_files WHERE ${condition} AND upload_status <> 'deleted'`,
      [value],
    );
    return { ...result, remaining: num(left[0].n) };
  }

  /** 확인된 파일은 deleting을 거쳐서, 그렇지 않은 파일은 객체를 지운 뒤 deleted로 */
  async purgeRows(rows) {
    let deleted = 0;
    for (const row of rows) {
      await this.database.query(
        `UPDATE media_files SET upload_status = 'deleting', updated_at = now()
          WHERE id = $1 AND upload_status = 'uploaded'`,
        [row.id],
      );
      if (!(await this.deleteObjectQuietly(row.object_key))) continue;
      const { rowCount } = await this.database.query(
        `UPDATE media_files SET upload_status = 'deleted', deleted_at = now(), updated_at = now()
          WHERE id = $1 AND upload_status <> 'deleted'`,
        [row.id],
      );
      deleted += rowCount;
    }
    return { deleted };
  }
}
