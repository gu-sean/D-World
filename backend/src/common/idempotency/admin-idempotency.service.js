import { randomUUID } from 'node:crypto';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { sha256Hex } from '../crypto/crypto.js';
import { AppException } from '../errors/app-exception.js';
import { toErrorBody } from '../errors/error-response.js';

// 서버가 죽어 in_progress로 남은 요청을 다시 실행해도 되는 경과 시간
const STALE_AFTER = "interval '5 minutes'";
const KEY_PATTERN = /^[\x21-\x7e]{8,128}$/;

/** 키 순서와 무관하게 같은 요청이면 같은 문자열 */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Idempotency-Key 헤더 값 검증 */
export function readIdempotencyKey(request) {
  const key = request.headers?.['idempotency-key'];
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      'idempotency_key_required',
      'Idempotency-Key 헤더가 필요해요.',
    );
  }
  return key;
}

/**
 * 관리자 변경 요청의 멱등 처리 (009 admin_idempotency_keys)
 * - 같은 (관리자, 키)에 같은 요청이면 저장된 응답을 재생하고, 요청 내용이 다르면 409
 * - 처리와 완료 기록은 한 트랜잭션이라 "처리됐지만 기록이 없는" 상태가 생기지 않음
 * - 4xx로 끝난 요청은 같은 오류를 재생, 5xx로 끝났거나 오래 멈춘 요청은 같은 키로 다시 실행
 * 응답 상태 코드는 엔드포인트의 @HttpCode로 고정되므로 재생 때도 본문만 돌려줌
 */
@Injectable()
@Dependencies(DatabaseService)
export class AdminIdempotencyService {
  constructor(database) {
    this.database = database;
  }

  /** handler(tx)가 반환한 값을 응답 본문으로 저장하고 돌려줌 */
  async run(adminId, { key, operation, payload }, handler) {
    const requestHash = sha256Hex(
      `${operation}\n${stableStringify(payload ?? null)}`,
    );
    const started = await this.begin(adminId, key, operation, requestHash);
    if (started.replay) return started.replay.body;

    try {
      return await this.database.withTransaction(async (tx) => {
        const body = await handler(tx);
        await tx.query(
          `UPDATE admin_idempotency_keys
              SET status = 'completed', response_status = 200,
                  response_body = $2::jsonb, completed_at = now()
            WHERE id = $1`,
          [started.id, JSON.stringify(body ?? null)],
        );
        return body;
      });
    } catch (err) {
      await this.markFailed(started.id, err);
      throw err;
    }
  }

  async begin(adminId, key, operation, requestHash) {
    const id = randomUUID();
    const inserted = await this.database.query(
      `INSERT INTO admin_idempotency_keys
              (id, admin_id, idempotency_key, operation, request_hash)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (admin_id, idempotency_key) DO NOTHING
       RETURNING id`,
      [id, adminId, key, operation, requestHash],
    );
    if (inserted.rows[0]) return { id };

    const { rows } = await this.database.query(
      `SELECT id, operation, request_hash, status, response_status, response_body,
              created_at < now() - ${STALE_AFTER} AS stale
         FROM admin_idempotency_keys WHERE admin_id = $1 AND idempotency_key = $2`,
      [adminId, key],
    );
    const existing = rows[0];
    if (
      existing.request_hash !== requestHash ||
      existing.operation !== operation
    ) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'idempotency_key_reused',
        '같은 Idempotency-Key로 다른 요청을 보냄',
      );
    }
    if (existing.status === 'completed') {
      return { replay: { body: existing.response_body } };
    }

    let failedStatus = existing.response_status;
    if (existing.status === 'in_progress') {
      if (!existing.stale) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'request_in_progress',
          '같은 요청을 처리하는 중',
        );
      }
      // 오래 멈춘 요청은 실패로 돌린 뒤 아래에서 재실행
      await this.database.query(
        `UPDATE admin_idempotency_keys
            SET status = 'failed', response_status = 503, completed_at = now()
          WHERE id = $1 AND status = 'in_progress'`,
        [existing.id],
      );
      failedStatus = 503;
    }

    if (failedStatus >= 400 && failedStatus < 500) {
      const stored = existing.response_body ?? {};
      throw new AppException(
        failedStatus,
        stored.code ?? 'error',
        stored.message ?? '요청 실패',
        stored.details ? { details: stored.details } : {},
      );
    }

    // 5xx로 끝난 요청은 같은 키로 재실행, 동시 요청이어도 1건만 재개
    const reopened = await this.database.query(
      `UPDATE admin_idempotency_keys
          SET status = 'in_progress', response_status = NULL, response_body = NULL,
              completed_at = NULL
        WHERE id = $1 AND status = 'failed' RETURNING id`,
      [existing.id],
    );
    if (!reopened.rows[0]) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'request_in_progress',
        '같은 요청을 처리하는 중',
      );
    }
    return { id: existing.id };
  }

  async markFailed(id, err) {
    const body = toErrorBody(err);
    try {
      await this.database.query(
        `UPDATE admin_idempotency_keys
            SET status = 'failed', response_status = $2, response_body = $3::jsonb,
                completed_at = now()
          WHERE id = $1 AND status = 'in_progress'`,
        [id, body.statusCode, JSON.stringify(body.error)],
      );
    } catch {
      // 기록 실패가 원래 오류를 가리지 않게 함, in_progress로 남으면 시간이 지나 재실행됨
    }
  }
}
