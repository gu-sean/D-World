import { newId } from '../common/ids.js';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from '../admin-auth/audit.service.js';
import { AdminIdempotencyService } from '../common/idempotency/admin-idempotency.service.js';
import { adminPage } from '../common/pagination/admin-page.js';
import { AppException } from '../common/errors/app-exception.js';
import { DatabaseService } from '../database/database.service.js';
import { definitionNotFound } from './definitions.service.js';

/** 관리자용 미션 틀 조회 컬럼(별칭 d), 목록·단건이 같은 뷰를 쓰도록 공용 */
export const ADMIN_DEFINITION_SELECT = `
  SELECT d.id, d.origin, d.title, d.description, d.category_id, d.difficulty_id,
         d.exercise_code, d.estimated_duration_seconds, d.target_value, d.target_unit,
         d.verification_method, d.publication_status, d.created_by_user_id,
         d.created_at, d.updated_at,
         p.nickname AS author_nickname,
         (SELECT max(r.created_at) FROM mission_publication_reviews r
           WHERE r.definition_id = d.id AND r.decision = 'submitted') AS submitted_at
    FROM mission_definitions d
    LEFT JOIN profiles p ON p.user_id = d.created_by_user_id`;

export const adminDefinitionView = (row) => ({
  id: row.id,
  origin: row.origin,
  title: row.title,
  description: row.description,
  categoryId: row.category_id,
  difficultyId: row.difficulty_id,
  exerciseCode: row.exercise_code,
  estimatedDurationSeconds: row.estimated_duration_seconds,
  targetValue: row.target_value === null ? null : Number(row.target_value),
  targetUnit: row.target_unit,
  verificationMethod: row.verification_method,
  publicationStatus: row.publication_status,
  authorId: row.created_by_user_id,
  authorNickname: row.author_nickname,
  submittedAt: row.submitted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

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
 * 미션 틀 공개 검수 (관리자 쪽)
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

  /**
   * M42 미션 틀 목록(AdminPage): 출처·공개 상태·분야·검색어 필터
   * 검수 대기열은 origin=user&publicationStatus=review_pending 조합
   */
  async listAdmin({ origin, publicationStatus, categoryId, query, paging }) {
    const params = [
      origin ?? null,
      publicationStatus ?? null,
      categoryId ?? null,
      query ? `%${query.replace(/[\\%_]/g, '\\$&')}%` : null,
    ];
    const where = `d.deleted_at IS NULL
          AND ($1::text IS NULL OR d.origin = $1)
          AND ($2::text IS NULL OR d.publication_status = $2)
          AND ($3::short_id IS NULL OR d.category_id = $3)
          AND ($4::text IS NULL OR d.title ILIKE $4)`;
    const [{ rows }, count] = await Promise.all([
      this.database.query(
        `${ADMIN_DEFINITION_SELECT}
          WHERE ${where}
          ORDER BY ${paging.orderBy}
          LIMIT $5 OFFSET $6`,
        [...params, paging.size, paging.offset],
      ),
      this.database.query(
        `SELECT count(*) AS n FROM mission_definitions d WHERE ${where}`,
        params,
      ),
    ]);
    return adminPage(rows.map(adminDefinitionView), paging, count.rows[0].n);
  }

  /** approve | reject | hide, 같은 Idempotency-Key로 다시 보내면 저장된 응답을 재생 */
  decide(adminId, { definitionId, action, reason, key }) {
    const rule = ACTIONS[action];
    return this.idempotency.run(
      adminId,
      {
        key,
        operation: 'mission_definition.review',
        payload: { definitionId, action, reason },
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
            newId(),
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
          action: 'mission_definition.review',
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
