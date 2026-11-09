import { randomUUID } from 'node:crypto';
import {
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AdminMutationService } from '../admin-auth/admin-mutation.service.js';
import { AdminOnly } from '../common/auth/admin-auth.guard.js';
import { conflict, notFound } from '../common/errors/http-errors.js';
import { readIdempotencyKey } from '../common/idempotency/admin-idempotency.service.js';
import {
  adminPage,
  parseAdminPage,
  pickEnum,
} from '../common/pagination/admin-page.js';
import {
  boolean,
  idOf,
  oneOf,
  string,
  timestamp,
  validateBody,
} from '../common/validation.js';
import { DatabaseService } from '../database/database.service.js';
import { REASON_RULE_OPTIONS } from '../admin-members/admin-members.service.js';

const TYPES = ['terms', 'privacy', 'marketing'];

const view = (row) => ({
  id: row.id,
  documentType: row.document_type,
  version: row.version,
  body: row.body,
  effectiveAt: row.effective_at,
  requiresReconsent: row.requires_reconsent,
  publishedAt: row.published_at,
});

/** 관리자 약관 문서 API: 목록(M95), 새 버전 등록(M96), 게시(M97) */
@Controller('admin/v1/policy-documents')
@AdminOnly()
@Dependencies(DatabaseService, AdminMutationService)
export class AdminPolicyDocumentsController {
  constructor(database, mutation) {
    this.database = database;
    this.mutation = mutation;
  }

  /** M95 */
  @Get()
  @Bind(Query())
  async list(query) {
    const documentType = pickEnum(query, 'documentType', TYPES);
    const published = pickEnum(query, 'published', ['true', 'false']);
    const paging = parseAdminPage(query, {
      'effectiveAt,desc': 'effective_at DESC, id DESC',
      'effectiveAt,asc': 'effective_at ASC, id ASC',
    });
    const params = [
      documentType ?? null,
      published === undefined ? null : published === 'true',
    ];
    const where = `($1::text IS NULL OR document_type = $1)
      AND ($2::boolean IS NULL OR $2 = (published_at IS NOT NULL))`;
    const [{ rows }, count] = await Promise.all([
      this.database.query(
        `SELECT * FROM policy_document_versions WHERE ${where}
          ORDER BY ${paging.orderBy} LIMIT $3 OFFSET $4`,
        [...params, paging.size, paging.offset],
      ),
      this.database.query(
        `SELECT count(*) AS n FROM policy_document_versions WHERE ${where}`,
        params,
      ),
    ]);
    return adminPage(rows.map(view), paging, count.rows[0].n);
  }

  /** M96: 게시 전 상태로 등록 */
  @Post()
  @Bind(Req(), Body())
  create(request, body) {
    const input = validateBody(body, {
      documentType: oneOf(TYPES),
      version: string({ min: 1, max: 40, pattern: /\S/ }),
      body: string({ min: 1, max: 200_000, pattern: /\S/ }),
      effectiveAt: timestamp(),
      requiresReconsent: boolean(),
      reason: string(REASON_RULE_OPTIONS),
    });
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'policy.create',
      payload: input,
      reason: input.reason.trim(),
      run: async (tx) => {
        const { rows } = await tx.query(
          `INSERT INTO policy_document_versions
             (id, document_type, version, body, effective_at, requires_reconsent)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [
            randomUUID(),
            input.documentType,
            input.version.trim(),
            input.body,
            input.effectiveAt,
            input.requiresReconsent,
          ],
        );
        const result = view(rows[0]);
        return {
          result,
          after: {
            id: result.id,
            documentType: result.documentType,
            version: result.version,
          },
        };
      },
    });
  }

  /** M97: 게시하면 더는 고칠 수 없음 */
  @Post(':versionId/publish')
  @HttpCode(200)
  @Bind(Req(), Param('versionId'), Body())
  publish(request, versionId, body) {
    const id = idOf(versionId);
    const input = validateBody(body, { reason: string(REASON_RULE_OPTIONS) });
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'policy.publish',
      payload: { versionId: id, ...input },
      reason: input.reason.trim(),
      run: async (tx) => {
        const { rows } = await tx.query(
          'SELECT * FROM policy_document_versions WHERE id = $1 FOR UPDATE',
          [id],
        );
        if (rows.length === 0) {
          throw notFound('policy_not_found', '약관 문서를 찾을 수 없음');
        }
        if (rows[0].published_at) {
          throw conflict(
            'ADMIN_STATE_CONFLICT',
            '지금 상태에서는 할 수 없는 작업이에요.',
          );
        }
        const updated = await tx.query(
          `UPDATE policy_document_versions SET published_at = now()
            WHERE id = $1 RETURNING *`,
          [id],
        );
        return {
          result: view(updated.rows[0]),
          before: { publishedAt: null },
          after: { publishedAt: updated.rows[0].published_at },
        };
      },
    });
  }
}
