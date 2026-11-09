import { randomUUID } from 'node:crypto';
import {
  Dependencies,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from } from 'rxjs';
import { DatabaseService } from '../../database/database.service.js';
import { sha256Hex } from '../crypto/crypto.js';
import { AppException } from '../errors/app-exception.js';
import {
  readIdempotencyKey,
  stableStringify,
} from './admin-idempotency.service.js';

const IDEMPOTENT = 'idempotent';
// 서버가 죽어 in_progress로 남은 요청을 다시 실행해도 되는 경과 시간
const STALE_AFTER = "interval '5 minutes'";

/** 앱 API 변경 요청에 Idempotency-Key 필수 처리를 붙임 (팀 문서 05 §5.1) */
// optional: true면 헤더가 있을 때만 멱등 처리(없으면 그냥 실행), 모바일이 키를 보내지만 서버가 강제하지 않는 요청용
export const Idempotent = ({ optional = false } = {}) =>
  SetMetadata(IDEMPOTENT, { optional });

/**
 * 앱 API 멱등 처리 (009 user_idempotency_keys)
 * 1. request_hash = sha256(method + path + 정렬한 본문)
 * 2. (user_id, 키) 행이 없으면 in_progress로 넣고 처리, 성공하면 completed + 응답 저장
 *    실패(4xx·5xx)하면 행을 지워 같은 키로 다시 시도할 수 있게 함
 * 3. 행이 있고 hash가 다르면 409 COMMON_IDEMPOTENCY_KEY_REUSED
 * 4. completed면 저장된 상태·본문 재생, in_progress면 409 COMMON_REQUEST_IN_PROGRESS
 * 처리와 완료 기록은 별도 트랜잭션: 사이에 서버가 죽으면 5분 뒤 같은 키로 재실행됨
 */
@Injectable()
@Dependencies(Reflector, DatabaseService)
export class UserIdempotencyInterceptor {
  constructor(reflector, database) {
    this.reflector = reflector;
    this.database = database;
  }

  intercept(context, next) {
    const options = this.reflector.get(IDEMPOTENT, context.getHandler());
    if (!options) return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest();
    if (options.optional && !request.headers?.['idempotency-key']) {
      return next.handle();
    }
    // 응답 상태는 인터셉터 이후에 Nest가 정하므로 @HttpCode 또는 기본값(POST 201)을 직접 계산
    const status =
      Reflect.getMetadata('__httpCode__', context.getHandler()) ??
      (request.method === 'POST' ? HttpStatus.CREATED : HttpStatus.OK);
    return from(
      this.execute(
        request,
        status,
        () =>
          new Promise((resolve, reject) =>
            next.handle().subscribe({
              next: resolve,
              error: reject,
              // 본문 없는 응답(204)도 완료로 처리
              complete: () => resolve(undefined),
            }),
          ),
      ),
    );
  }

  async execute(request, status, handle) {
    const key = readIdempotencyKey(request);
    const userId = request.auth.userId;
    const path = (request.originalUrl ?? request.url).split('?')[0];
    const operation = `${request.method} ${path}`.slice(0, 80);
    const requestHash = sha256Hex(
      `${request.method}\n${path}\n${stableStringify(request.body ?? null)}`,
    );

    const started = await this.begin(userId, key, operation, requestHash);
    if (started.replay) return started.replay.body;

    let body;
    try {
      body = await handle();
    } catch (error) {
      await this.database.query(
        'DELETE FROM user_idempotency_keys WHERE id = $1 AND status = $2',
        [started.id, 'in_progress'],
      );
      throw error;
    }
    await this.database.query(
      `UPDATE user_idempotency_keys
          SET status = 'completed', response_status = $2,
              response_body = $3::jsonb, completed_at = now()
        WHERE id = $1`,
      [started.id, status, JSON.stringify(body ?? null)],
    );
    return body;
  }

  async begin(userId, key, operation, requestHash) {
    const id = randomUUID();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const inserted = await this.database.query(
        `INSERT INTO user_idempotency_keys
                (id, user_id, idempotency_key, operation, request_hash)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, idempotency_key) DO NOTHING
         RETURNING id`,
        [id, userId, key, operation, requestHash],
      );
      if (inserted.rows[0]) return { id };

      const { rows } = await this.database.query(
        `SELECT id, request_hash, status, response_status, response_body,
                created_at < now() - ${STALE_AFTER} AS stale
           FROM user_idempotency_keys WHERE user_id = $1 AND idempotency_key = $2`,
        [userId, key],
      );
      const existing = rows[0];
      // 조회 사이에 지워진 행(다른 요청이 실패해 정리)은 한 번 더 시도
      if (!existing) continue;
      if (existing.request_hash !== requestHash) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'idempotency_key_reused',
          '같은 Idempotency-Key로 다른 요청을 보냄',
        );
      }
      if (existing.status === 'completed') {
        return { replay: { body: existing.response_body } };
      }
      if (!existing.stale) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'request_in_progress',
          '같은 요청을 처리하는 중',
        );
      }
      // 오래 멈춘 요청은 지우고 다시 시도(동시에 여러 요청이면 삽입 경쟁에서 1건만 통과)
      await this.database.query(
        `DELETE FROM user_idempotency_keys
          WHERE id = $1 AND status = 'in_progress'`,
        [existing.id],
      );
    }
    throw new AppException(
      HttpStatus.CONFLICT,
      'request_in_progress',
      '같은 요청을 처리하는 중',
    );
  }
}
