import { newId } from '../common/ids.js';
import {
  BadRequestException,
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AdminMutationService } from '../admin-auth/admin-mutation.service.js';
import { AdminOnly } from '../common/auth/admin-auth.guard.js';
import { notFound } from '../common/errors/http-errors.js';
import { readIdempotencyKey } from '../common/idempotency/admin-idempotency.service.js';
import {
  adminPage,
  parseAdminPage,
  pickEnum,
} from '../common/pagination/admin-page.js';
import {
  boolean,
  idOf,
  integer,
  string,
  timestamp,
  shortId,
  validateBody,
} from '../common/validation.js';
import { DatabaseService } from '../database/database.service.js';
import { REASON_RULE_OPTIONS } from '../admin-members/admin-members.service.js';

/** null이면 값을 비움(PATCH), 없으면 그대로 */
const nullable = (rule) => (raw) =>
  raw === null ? { value: null } : rule(raw);

/** 요일: 1=월 … 7=일, null이면 매일 */
const weekdayRule = () => integer({ min: 1, max: 7, optional: true });

const view = (row) => ({
  id: row.id,
  message: row.message,
  weekday: row.weekday,
  categoryId: row.category_id,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  isActive: row.is_active,
  createdByAdminId: row.created_by_admin_id,
  updatedByAdminId: row.updated_by_admin_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function assertPeriod({ startsAt, endsAt }) {
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    throw new BadRequestException(['endsAt: startsAt보다 늦어야 함']);
  }
}

/**
 * 관리자 추천 문구 API: 목록(M98), 등록(M99), 수정(M100)
 * 문구는 요일별로 정한다(weekday 1=월 … 7=일, null=매일). 홈 화면은 오늘 요일의 문구를 보여 준다.
 */
@Controller('admin/v1/recommendation-messages')
@AdminOnly()
@Dependencies(DatabaseService, AdminMutationService)
export class AdminRecommendationMessagesController {
  constructor(database, mutation) {
    this.database = database;
    this.mutation = mutation;
  }

  /** M98: 기본 정렬은 매일 문구 → 월~일 순 */
  @Get()
  @Bind(Query())
  async list(query) {
    const active = pickEnum(query, 'isActive', ['true', 'false']);
    const weekday = pickEnum(query, 'weekday', [
      'all',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
    ]);
    const paging = parseAdminPage(query, {
      'weekday,asc': 'weekday ASC NULLS FIRST, created_at DESC, id DESC',
      'createdAt,desc': 'created_at DESC, id DESC',
    });
    const params = [
      active === undefined ? null : active === 'true',
      // all: 매일(요일 없음) 문구만, 1~7: 그 요일 문구만, 생략: 전부
      weekday ?? null,
    ];
    const where = `($1::boolean IS NULL OR is_active = $1)
      AND ($2::text IS NULL
           OR ($2 = 'all' AND weekday IS NULL)
           OR ($2 <> 'all' AND weekday = $2::smallint))`;
    const [{ rows }, count] = await Promise.all([
      this.database.query(
        `SELECT * FROM recommendation_messages WHERE ${where}
          ORDER BY ${paging.orderBy} LIMIT $3 OFFSET $4`,
        [...params, paging.size, paging.offset],
      ),
      this.database.query(
        `SELECT count(*) AS n FROM recommendation_messages WHERE ${where}`,
        params,
      ),
    ]);
    return adminPage(rows.map(view), paging, count.rows[0].n);
  }

  /** M99: categoryCode는 전역 인터셉터가 categoryId(ID)로 바꿔 줌 */
  @Post()
  @Bind(Req(), Body())
  create(request, body) {
    const input = validateBody(body, {
      message: string({ min: 1, max: 200, pattern: /\S/ }),
      weekday: nullable(weekdayRule()),
      categoryId: shortId({ optional: true }),
      startsAt: timestamp({ optional: true }),
      endsAt: timestamp({ optional: true }),
      isActive: boolean({ optional: true }),
      reason: string(REASON_RULE_OPTIONS),
    });
    assertPeriod(input);
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'recommendation_message.create',
      payload: input,
      reason: input.reason.trim(),
      run: async (tx) => {
        const { rows } = await tx.query(
          `INSERT INTO recommendation_messages
             (id, message, weekday, category_id, starts_at, ends_at, is_active,
              created_by_admin_id, updated_by_admin_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
           RETURNING *`,
          [
            newId(),
            input.message.trim(),
            input.weekday ?? null,
            input.categoryId ?? null,
            input.startsAt ?? null,
            input.endsAt ?? null,
            input.isActive ?? true,
            adminId,
          ],
        );
        const result = view(rows[0]);
        return {
          result,
          after: {
            id: result.id,
            weekday: result.weekday,
            message: result.message,
          },
        };
      },
    });
  }

  /** M100: 보낸 필드만 바꿈, 요일·시작·종료 시각과 분야는 null로 비울 수 있음(요일 null = 매일) */
  @Patch(':messageId')
  @Bind(Req(), Param('messageId'), Body())
  update(request, messageId, body) {
    const id = idOf(messageId);
    const input = validateBody(body, {
      message: string({ min: 1, max: 200, pattern: /\S/, optional: true }),
      weekday: nullable(weekdayRule()),
      categoryId: nullable(shortId({ optional: true })),
      startsAt: nullable(timestamp({ optional: true })),
      endsAt: nullable(timestamp({ optional: true })),
      isActive: boolean({ optional: true }),
      reason: string(REASON_RULE_OPTIONS),
    });
    // categoryCode: null로 분야를 비우는 요청은 인터셉터가 바꾸지 않으므로 직접 처리
    const clearsCategory = body?.categoryCode === null;
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'recommendation_message.update',
      payload: { messageId: id, ...input, clearsCategory },
      reason: input.reason.trim(),
      run: async (tx) => {
        const { rows } = await tx.query(
          'SELECT * FROM recommendation_messages WHERE id = $1 FOR UPDATE',
          [id],
        );
        if (rows.length === 0) {
          throw notFound('message_not_found', '추천 문구를 찾을 수 없음');
        }
        const current = rows[0];
        const pick = (key, fallback) =>
          input[key] === undefined ? fallback : input[key];
        const next = {
          message: pick('message', current.message).trim(),
          weekday: pick('weekday', current.weekday),
          categoryId: clearsCategory
            ? null
            : pick('categoryId', current.category_id),
          startsAt: pick('startsAt', current.starts_at),
          endsAt: pick('endsAt', current.ends_at),
          isActive: pick('isActive', current.is_active),
        };
        assertPeriod(next);
        const updated = await tx.query(
          `UPDATE recommendation_messages
              SET message = $2, weekday = $3, category_id = $4, starts_at = $5,
                  ends_at = $6, is_active = $7, updated_by_admin_id = $8, updated_at = now()
            WHERE id = $1 RETURNING *`,
          [
            id,
            next.message,
            next.weekday,
            next.categoryId,
            next.startsAt,
            next.endsAt,
            next.isActive,
            adminId,
          ],
        );
        return {
          result: view(updated.rows[0]),
          before: {
            message: current.message,
            weekday: current.weekday,
            isActive: current.is_active,
          },
          after: {
            message: next.message,
            weekday: next.weekday,
            isActive: next.isActive,
          },
        };
      },
    });
  }
}
