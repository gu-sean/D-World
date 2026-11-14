import {
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { AdminMutationService } from '../admin-auth/admin-mutation.service.js';
import { AdminOnly } from '../common/auth/admin-auth.guard.js';
import { readIdempotencyKey } from '../common/idempotency/admin-idempotency.service.js';
import {
  adminPage,
  parseAdminPage,
  pickEnum,
} from '../common/pagination/admin-page.js';
import {
  integer,
  oneOf,
  string,
  timestamp,
  uuid,
  validateBody,
} from '../common/validation.js';
import { notFound } from '../common/errors/http-errors.js';
import {
  memberQueryParams,
  memberWhere,
  nicknameOf,
} from '../common/member-query.js';
import { DatabaseService } from '../database/database.service.js';
import { PointsService } from './points.service.js';

const KINDS = [
  'auto_award',
  'award_offset',
  'spend',
  'refund',
  'refund_offset',
  'recovery',
  'recovery_claim',
  'recovery_settlement',
  'recovery_cancel',
  'reinstatement',
  'manual_grant',
  'manual_recovery',
];
const SOURCE_TYPES = [
  'mission',
  'streak',
  'achievement',
  'challenge',
  'shop_order',
  'admin_adjustment',
];
const MAX_ADJUST_POINTS = 1_000_000;

const view = (row) => ({
  id: row.id,
  userId: row.user_id,
  nickname: row.nickname ?? null,
  kind: row.kind,
  availableDelta: Number(row.available_delta),
  outstandingDelta: Number(row.outstanding_delta),
  balanceAfter: Number(row.balance_after),
  outstandingAfter: Number(row.outstanding_after),
  sourceType: row.source_type,
  sourceId: row.source_id,
  reason: row.reason,
  createdByAdminId: row.created_by_admin_id,
  occurredAt: row.occurred_at,
});

const COLUMNS = `id, user_id, kind, available_delta, outstanding_delta, balance_after,
  outstanding_after, source_type, source_id, reason, created_by_admin_id, occurred_at`;

/** 관리자 포인트 API: 거래 조회(M70)와 수동 조정(M71) */
@Controller('admin/v1')
@AdminOnly()
@Dependencies(DatabaseService, PointsService, AdminMutationService)
export class AdminPointsController {
  constructor(database, points, mutation) {
    this.database = database;
    this.points = points;
    this.mutation = mutation;
  }

  /** M70: 헤더 X-Pending-Points = 검수 대기 회차의 보상 합(사용자 지정 시 그 사용자만) */
  @Get('point-transactions')
  @Bind(Query(), Res({ passthrough: true }))
  async list(query, response) {
    const filters = validateBody(query, {
      userId: uuid({ optional: true }),
      from: timestamp({ optional: true }),
      to: timestamp({ optional: true }),
    });
    // member: 닉네임 또는 회원 ID (common/member-query.js, 회원 목록과 같은 규칙)
    const member = memberQueryParams(query.member);
    const memberId = filters.userId ?? member.id;
    const kind = pickEnum(query, 'kind', KINDS);
    const sourceType = pickEnum(query, 'sourceType', SOURCE_TYPES);
    const paging = parseAdminPage(query, {
      'occurredAt,desc': 'occurred_at DESC, id DESC',
      'occurredAt,asc': 'occurred_at ASC, id ASC',
    });
    const params = [
      memberId ?? null,
      filters.from ?? null,
      filters.to ?? null,
      kind ?? null,
      sourceType ?? null,
      member.like,
    ];
    const where = `${memberWhere('user_id', '$6', '$1')}
          AND ($2::timestamptz IS NULL OR occurred_at >= $2)
          AND ($3::timestamptz IS NULL OR occurred_at < $3)
          AND ($4::text IS NULL OR kind = $4)
          AND ($5::text IS NULL OR source_type = $5)`;
    const [{ rows }, count, pending] = await Promise.all([
      this.database.query(
        `SELECT ${COLUMNS}, ${nicknameOf('point_transactions.user_id')} AS nickname
           FROM point_transactions
          WHERE ${where}
          ORDER BY ${paging.orderBy}
          LIMIT $7 OFFSET $8`,
        [...params, paging.size, paging.offset],
      ),
      this.database.query(
        `SELECT count(*) AS n FROM point_transactions WHERE ${where}`,
        params,
      ),
      this.database.query(
        `SELECT COALESCE(sum(m.reward_points), 0) AS total
           FROM mission_records r
           JOIN missions m ON m.id = r.mission_id
          WHERE r.status = 'review_required'
            AND ${memberWhere('r.user_id', '$2', '$1')}`,
        [memberId ?? null, member.like],
      ),
    ]);
    response.setHeader('X-Pending-Points', String(pending.rows[0].total));
    return adminPage(rows.map(view), paging, count.rows[0].n);
  }

  /** M71: 수동 지급·회수(월 한도 제외), 회수는 가용 잔액까지만 가능 */
  @Post('point-adjustments')
  @Bind(Req(), Body())
  adjust(request, body) {
    const input = validateBody(body, {
      userId: uuid(),
      kind: oneOf(['manual_grant', 'manual_recovery']),
      amount: integer({ min: 1, max: MAX_ADJUST_POINTS }),
      reason: string({
        min: 1,
        max: 500,
        pattern: /\S/,
        patternMessage: '공백만 입력할 수 없음',
      }),
    });
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'point.adjust',
      payload: input,
      reason: input.reason.trim(),
      run: async (tx) => {
        const { rows: user } = await tx.query(
          'SELECT 1 FROM users WHERE id = $1',
          [input.userId],
        );
        if (user.length === 0) {
          throw notFound('user_not_found', '회원을 찾을 수 없음');
        }
        const { adjustmentId } = await this.points.manualAdjust(tx, {
          adminId,
          userId: input.userId,
          kind: input.kind,
          amount: input.amount,
          reason: input.reason.trim(),
        });
        const { rows } = await tx.query(
          `SELECT ${COLUMNS} FROM point_transactions
            WHERE source_type = 'admin_adjustment' AND source_id = $1
              AND kind IN ('manual_grant', 'manual_recovery')`,
          [adjustmentId],
        );
        return { result: view(rows[0]), targetUserId: input.userId };
      },
    });
  }
}
