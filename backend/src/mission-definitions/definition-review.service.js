import { randomUUID } from 'node:crypto';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from '../admin-auth/audit.service.js';
import { AdminIdempotencyService } from '../common/idempotency/admin-idempotency.service.js';
import { AppException } from '../common/errors/app-exception.js';
import { DatabaseService } from '../database/database.service.js';
import { definitionNotFound } from './definitions.service.js';

/** 검수 처리: 동작 → 허용하는 현재 상태, 새 상태, 검수 이력의 decision, 사유 필수 여부 */
const ACTIONS = {
  approve: {
    from: ['review_pending'],
    to: 'public',
    decision: 'approved',
    reasonRequired: false,
  },
  reject: {
    from: ['review_pending'],
    to: 'rejected',
    decision: 'rejected',
    reasonRequired: true,
  },
  hide: {
    from: ['review_pending', 'public'],
    to: 'hidden',
    decision: 'hidden',
    reasonRequired: true,
  },
};

/**
 * 미션 원형 공개 검수 (3-B-3, 관리자 쪽)
 * 처리마다 mission_publication_reviews에 새 행을 남기고, 상태 변경·검수 이력·감사 로그·멱등 기록이
 * 한 트랜잭션. 숨김은 기존 미션에 영향 없이 새 사용만 차단
 */
@Injectable()
@Dependencies(DatabaseService, AuditService, AdminIdempotencyService)
export class DefinitionReviewService {
  constructor(database, audit, idempotency) {
    this.database = database;
    this.audit = audit;
    this.idempotency = idempotency;
  }

  /** 검수 대기열(기본 review_pending), 오래 기다린 순서 */
  async listQueue({ status = 'review_pending', cursor, limit }) {
    let after = null;
    if (cursor) {
      try {
        after = JSON.parse(Buffer.from(cursor, 'base64url').toString());
        if (typeof after.t !== 'string' || typeof after.id !== 'string')
          throw new Error();
      } catch {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          'bad_request',
          '잘못된 cursor',
        );
      }
    }

    const { rows } = await this.database.query(
      `SELECT d.id, d.title, d.description, d.category_id, d.difficulty_id,
              d.estimated_duration_seconds, d.target_value, d.target_unit,
              d.verification_method, d.publication_status, d.created_by_user_id,
              d.updated_at, d.updated_at::text AS updated_at_raw,
              p.nickname AS author_nickname,
              (SELECT max(r.created_at) FROM mission_publication_reviews r
                WHERE r.definition_id = d.id AND r.decision = 'submitted') AS submitted_at
         FROM mission_definitions d
         LEFT JOIN profiles p ON p.user_id = d.created_by_user_id
        WHERE d.origin = 'user' AND d.deleted_at IS NULL AND d.publication_status = $1
          AND ($2::timestamptz IS NULL OR (d.updated_at, d.id) > ($2::timestamptz, $3::uuid))
        ORDER BY d.updated_at, d.id
        LIMIT $4`,
      [status, after?.t ?? null, after?.id ?? null, limit + 1],
    );

    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        categoryId: row.category_id,
        difficultyId: row.difficulty_id,
        estimatedDurationSeconds: row.estimated_duration_seconds,
        targetValue:
          row.target_value === null ? null : Number(row.target_value),
        targetUnit: row.target_unit,
        verificationMethod: row.verification_method,
        publicationStatus: row.publication_status,
        authorId: row.created_by_user_id,
        authorNickname: row.author_nickname,
        submittedAt: row.submitted_at,
        updatedAt: row.updated_at,
      })),
      nextCursor:
        rows.length > limit
          ? Buffer.from(
              JSON.stringify({ t: last.updated_at_raw, id: last.id }),
            ).toString('base64url')
          : null,
    };
  }

  /** approve | reject | hide, 같은 Idempotency-Key로 다시 보내면 저장된 응답을 재생 */
  decide(adminId, { definitionId, action, reason, key }) {
    const rule = ACTIONS[action];
    return this.idempotency.run(
      adminId,
      {
        key,
        operation: `mission_definition.${action}`,
        payload: { definitionId, reason },
      },
      async (tx) => {
        const { rows } = await tx.query(
          `SELECT id, publication_status, created_by_user_id
             FROM mission_definitions
            WHERE id = $1 AND origin = 'user' AND deleted_at IS NULL FOR UPDATE`,
          [definitionId],
        );
        const definition = rows[0];
        if (!definition) throw definitionNotFound();
        if (!rule.from.includes(definition.publication_status)) {
          throw new AppException(
            HttpStatus.CONFLICT,
            'invalid_transition',
            '현재 상태에서 할 수 없는 처리',
            { details: { status: definition.publication_status, action } },
          );
        }

        await tx.query(
          `UPDATE mission_definitions SET publication_status = $2, updated_at = now() WHERE id = $1`,
          [definitionId, rule.to],
        );
        // 요청자 열에 작성자를 채워 둬야 탈퇴 때 사유가 함께 지워짐(users 삭제 트리거)
        const { rows: review } = await tx.query(
          `INSERT INTO mission_publication_reviews
                  (id, definition_id, requested_by_user_id, reviewed_by_admin_id, decision, reason)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING created_at`,
          [
            randomUUID(),
            definitionId,
            definition.created_by_user_id,
            adminId,
            rule.decision,
            reason ?? null,
          ],
        );
        await this.audit.record(tx, {
          adminId,
          targetUserId: definition.created_by_user_id,
          action: `mission_definition.${action}`,
          result: 'success',
          reason: reason ?? null,
          before: { publicationStatus: definition.publication_status },
          after: { publicationStatus: rule.to },
        });
        return {
          id: definitionId,
          publicationStatus: rule.to,
          decidedAt: review[0].created_at,
        };
      },
    );
  }
}
