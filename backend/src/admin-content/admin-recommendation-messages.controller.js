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
  jsonObject,
  oneOf,
  string,
  timestamp,
  shortId,
  validateBody,
} from '../common/validation.js';
import { DatabaseService } from '../database/database.service.js';
import { REASON_RULE_OPTIONS } from '../admin-members/admin-members.service.js';

const CONDITIONS = [
  'always',
  'no_mission_today',
  'streak_at_risk',
  'inactive_days',
  'time_slot',
];

/** null이면 값을 비움(PATCH), 없으면 그대로 */
const nullable = (rule) => (raw) =>
  raw === null ? { value: null } : rule(raw);

const view = (row) => ({
  id: row.id,
  message: row.message,
  conditionType: row.condition_type,
  conditionParams: row.condition_params,
  categoryId: row.category_id,
  priority: row.priority,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  isActive: row.is_active,
  createdByAdminId: row.created_by_admin_id,
  updatedByAdminId: row.updated_by_admin_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** 조건 종류별 conditionParams 규칙(DB CHECK와 같음)을 필드별 오류로 돌려줌 */
function assertCondition({ conditionType, conditionParams, startsAt, endsAt }) {
  const errors = [];
  const keys = Object.keys(conditionParams);
  const int = (value, min, max) =>
    Number.isInteger(value) && value >= min && value <= max;
  if (
    ['always', 'no_mission_today', 'streak_at_risk'].includes(conditionType)
  ) {
    if (keys.length > 0) {
      errors.push(`conditionParams: ${conditionType}은 비어 있어야 함`);
    }
  } else if (conditionType === 'inactive_days') {
    if (keys.join() !== 'days' || !int(conditionParams.days, 1, 365)) {
      errors.push('conditionParams: {days: 1~365 정수}만 가능');
    }
  } else if (conditionType === 'time_slot') {
    const { start_hour: start, end_hour: end } = conditionParams;
    if (
      keys.length !== 2 ||
      !int(start, 0, 23) ||
      !int(end, 0, 23) ||
      start === end
    ) {
      errors.push(
        'conditionParams: {start_hour, end_hour} 0~23 정수, 서로 달라야 함',
      );
    }
  }
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    errors.push('endsAt: startsAt보다 늦어야 함');
  }
  if (errors.length > 0) throw new BadRequestException(errors);
}

/** 관리자 상황 추천 문구 API: 목록(M98), 등록(M99), 수정(M100) */
@Controller('admin/v1/recommendation-messages')
@AdminOnly()
@Dependencies(DatabaseService, AdminMutationService)
export class AdminRecommendationMessagesController {
  constructor(database, mutation) {
    this.database = database;
    this.mutation = mutation;
  }

  /** M98 */
  @Get()
  @Bind(Query())
  async list(query) {
    const active = pickEnum(query, 'isActive', ['true', 'false']);
    const conditionType = pickEnum(query, 'conditionType', CONDITIONS);
    const paging = parseAdminPage(query, {
      'priority,desc': 'priority DESC, created_at DESC, id DESC',
      'createdAt,desc': 'created_at DESC, id DESC',
    });
    const params = [
      active === undefined ? null : active === 'true',
      conditionType ?? null,
    ];
    const where = `($1::boolean IS NULL OR is_active = $1)
      AND ($2::text IS NULL OR condition_type = $2)`;
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
      conditionType: oneOf(CONDITIONS),
      conditionParams: jsonObject({ optional: true }),
      categoryId: shortId({ optional: true }),
      priority: integer({ min: 0, max: 100, optional: true }),
      startsAt: timestamp({ optional: true }),
      endsAt: timestamp({ optional: true }),
      isActive: boolean({ optional: true }),
      reason: string(REASON_RULE_OPTIONS),
    });
    const params = input.conditionParams ?? {};
    assertCondition({ ...input, conditionParams: params });
    const adminId = request.auth.adminId;
    return this.mutation.run(adminId, {
      key: readIdempotencyKey(request),
      operation: 'recommendation_message.create',
      payload: input,
      reason: input.reason.trim(),
      run: async (tx) => {
        const { rows } = await tx.query(
          `INSERT INTO recommendation_messages
             (id, message, condition_type, condition_params, category_id, priority,
              starts_at, ends_at, is_active, created_by_admin_id, updated_by_admin_id)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $10)
           RETURNING *`,
          [
            newId(),
            input.message.trim(),
            input.conditionType,
            JSON.stringify(params),
            input.categoryId ?? null,
            input.priority ?? 50,
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
            conditionType: result.conditionType,
            message: result.message,
          },
        };
      },
    });
  }

  /** M100: 보낸 필드만 바꿈, 시작·종료 시각과 분야는 null로 비울 수 있음 */
  @Patch(':messageId')
  @Bind(Req(), Param('messageId'), Body())
  update(request, messageId, body) {
    const id = idOf(messageId);
    const input = validateBody(body, {
      message: string({ min: 1, max: 200, pattern: /\S/, optional: true }),
      conditionType: oneOf(CONDITIONS, { optional: true }),
      conditionParams: jsonObject({ optional: true }),
      categoryId: nullable(shortId({ optional: true })),
      priority: integer({ min: 0, max: 100, optional: true }),
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
          conditionType: pick('conditionType', current.condition_type),
          conditionParams:
            input.conditionParams ??
            (input.conditionType &&
            input.conditionType !== current.condition_type
              ? {}
              : current.condition_params),
          categoryId: clearsCategory
            ? null
            : pick('categoryId', current.category_id),
          priority: pick('priority', current.priority),
          startsAt: pick('startsAt', current.starts_at),
          endsAt: pick('endsAt', current.ends_at),
          isActive: pick('isActive', current.is_active),
        };
        assertCondition(next);
        const updated = await tx.query(
          `UPDATE recommendation_messages
              SET message = $2, condition_type = $3, condition_params = $4::jsonb,
                  category_id = $5, priority = $6, starts_at = $7, ends_at = $8,
                  is_active = $9, updated_by_admin_id = $10, updated_at = now()
            WHERE id = $1 RETURNING *`,
          [
            id,
            next.message,
            next.conditionType,
            JSON.stringify(next.conditionParams),
            next.categoryId,
            next.priority,
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
            conditionType: current.condition_type,
            isActive: current.is_active,
          },
          after: {
            message: next.message,
            conditionType: next.conditionType,
            isActive: next.isActive,
          },
        };
      },
    });
  }
}
