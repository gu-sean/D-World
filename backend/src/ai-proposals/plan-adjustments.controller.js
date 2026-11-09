import {
  BadRequestException,
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
  UseInterceptors,
} from '@nestjs/common';
import { RequireActive } from '../accounts/active-account.guard.js';
import {
  Idempotent,
  UserIdempotencyInterceptor,
} from '../common/idempotency/user-idempotency.interceptor.js';
import { parseLimit } from '../common/pagination/limit.js';
import {
  array,
  idOf,
  jsonObject,
  string,
  uuid,
  validateBody,
} from '../common/validation.js';
import { PlanAdjustmentsService } from './plan-adjustments.service.js';
import { planSpec } from './proposals.controller.js';

const STATUSES = ['proposed', 'accepted', 'rejected', 'expired'];

/** 계획 재조정 제안 API A50~A53 */
@Controller('plan-adjustments')
@UseInterceptors(UserIdempotencyInterceptor)
@Dependencies(PlanAdjustmentsService)
export class PlanAdjustmentsController {
  constructor(adjustments) {
    this.adjustments = adjustments;
  }

  @Get()
  @Bind(Req(), Query())
  list(request, query) {
    const filters = validateBody(query, {
      goalId: uuid({ optional: true }),
      status: string({ min: 1, max: 60, optional: true }),
      cursor: string({ min: 1, max: 500, optional: true }),
    });
    // 여러 값 필터 `?status=a,b` (05 §6)
    const statuses = filters.status
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (statuses?.some((value) => !STATUSES.includes(value))) {
      throw new BadRequestException([
        `status: ${STATUSES.join(', ')} 중 하나 이상이어야 함`,
      ]);
    }
    return this.adjustments.list(request.auth.userId, {
      goalId: filters.goalId,
      statuses,
      cursor: filters.cursor,
      limit: parseLimit(query, 20, 50),
    });
  }

  @Get(':id')
  @Bind(Req(), Param('id'))
  get(request, id) {
    return this.adjustments.get(request.auth.userId, idOf(id));
  }

  /** plan(PlanStep[])을 보내면 사용자가 고친 계획으로 수락 */
  @Post(':id/accept')
  @Idempotent()
  @RequireActive()
  @Bind(Req(), Param('id'), Body())
  accept(request, id, body) {
    const data = validateBody(body ?? {}, {
      plan: array(jsonObject(), { max: 30, optional: true }),
    });
    return this.adjustments.accept(
      request.auth.userId,
      idOf(id),
      data,
      (plan) => validateBody({ plan }, { plan: planSpec }).plan,
    );
  }

  @Post(':id/reject')
  @HttpCode(204)
  @Bind(Req(), Param('id'))
  async reject(request, id) {
    await this.adjustments.reject(request.auth.userId, idOf(id));
  }
}
