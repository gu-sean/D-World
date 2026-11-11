import {
  Bind,
  Body,
  Controller,
  Delete,
  Dependencies,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { RequireActive } from '../accounts/active-account.guard.js';
import {
  dateString,
  integer,
  oneOf,
  string,
  uuid,
  validateBody,
} from '../common/validation.js';
import { GOAL_STATUSES } from './goals.constants.js';
import { GoalsService } from './goals.service.js';
import { StepsService } from './steps.service.js';
import {
  Idempotent,
  UserIdempotencyInterceptor,
} from '../common/idempotency/user-idempotency.interceptor.js';

const MAX_LIMIT = 50;

const title = (options) =>
  string({
    min: 1,
    max: 200,
    pattern: /\S/,
    patternMessage: '공백만 입력할 수 없음',
    ...options,
  });
// 빈 문자열은 설명 삭제를 뜻함
const description = () => string({ min: 0, max: 2000, optional: true });
const idParams = (params) =>
  validateBody(
    params,
    Object.fromEntries(Object.keys(params).map((k) => [k, uuid()])),
  );

@Controller('goals')
@Dependencies(GoalsService, StepsService)
@UseInterceptors(UserIdempotencyInterceptor)
export class GoalsController {
  constructor(goals, steps) {
    this.goals = goals;
    this.steps = steps;
  }

  @Post()
  @Idempotent()
  @RequireActive()
  @Bind(Req(), Body())
  create(request, body) {
    return this.goals.createGoal(
      request.auth.userId,
      validateBody(body, {
        title: title(),
        description: description(),
        categoryId: uuid(),
        difficultyId: uuid(),
        startDate: dateString(),
        endDate: dateString(),
        targetFrequency: integer({ min: 1, max: 7, optional: true }),
        dailyAvailableMinutes: integer({ min: 5, max: 240, optional: true }),
      }),
    );
  }

  @Get()
  @Bind(Req(), Query())
  list(request, query) {
    const { categoryId, status: statusText } = validateBody(query, {
      status: string({ min: 1, max: 60, optional: true }),
      categoryId: uuid({ optional: true }),
    });
    // 여러 값 필터 `?status=a,b` (05 §6)
    const statuses = statusText
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (statuses?.some((value) => !GOAL_STATUSES.includes(value))) {
      throw new BadRequestException([
        `status: ${GOAL_STATUSES.join(', ')} 중 하나 이상이어야 함`,
      ]);
    }
    let limit = 20;
    if (query.limit !== undefined) {
      limit = Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw new BadRequestException([`limit: 1~${MAX_LIMIT} 정수여야 함`]);
      }
    }
    if (query.cursor !== undefined && typeof query.cursor !== 'string') {
      throw new BadRequestException(['cursor: 문자열이어야 함']);
    }
    return this.goals.listGoals(request.auth.userId, {
      statuses,
      categoryId,
      cursor: query.cursor,
      limit,
    });
  }

  @Get(':id')
  @Bind(Req(), Param('id'))
  get(request, id) {
    return this.goals.getGoal(request.auth.userId, idParams({ id }).id);
  }

  /**
   * 목표 수정. 본문에 status가 있으면 상태도 바꾼다(active·paused·completed)
   * 응답은 GoalDetail
   */
  @Patch(':id')
  @Idempotent({ optional: true })
  @Bind(Req(), Param('id'), Body())
  async update(request, id, rawBody) {
    const goalId = idParams({ id }).id;
    const { status: wanted, ...body } = rawBody ?? {};
    if (wanted !== undefined && !GOAL_STATUSES.includes(wanted)) {
      throw new BadRequestException([
        `status: ${GOAL_STATUSES.join(', ')} 중 하나여야 함`,
      ]);
    }
    const hasFields = Object.keys(body).length > 0;
    if (hasFields || wanted === undefined) {
      await this.updateFields(request.auth.userId, goalId, body);
    }
    if (wanted !== undefined) {
      await this.changeStatus(request.auth.userId, goalId, wanted);
    }
    return this.goals.getGoal(request.auth.userId, goalId);
  }

  async changeStatus(userId, goalId, wanted) {
    const current = (await this.goals.getGoal(userId, goalId)).status;
    if (current === wanted) return;
    const action = {
      'active:paused': 'pause',
      'paused:active': 'resume',
      'active:completed': 'complete',
      'paused:completed': 'complete',
      'completed:active': 'reopen',
    }[`${current}:${wanted}`];
    if (!action) {
      throw new BadRequestException([
        `status: ${current}에서 ${wanted}로 바꿀 수 없음`,
      ]);
    }
    await this.goals.transition(userId, goalId, action);
  }

  updateFields(userId, goalId, body) {
    return this.goals.updateGoal(
      userId,
      goalId,
      validateBody(body, {
        title: title({ optional: true }),
        description: description(),
        categoryId: uuid({ optional: true }),
        difficultyId: uuid({ optional: true }),
        startDate: dateString({ optional: true }),
        endDate: dateString({ optional: true }),
        targetFrequency: integer({ min: 1, max: 7, optional: true }),
        dailyAvailableMinutes: integer({ min: 5, max: 240, optional: true }),
      }),
    );
  }

  @Post(':id/pause')
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  pause(request, id) {
    return this.goals.transition(
      request.auth.userId,
      idParams({ id }).id,
      'pause',
    );
  }

  @Post(':id/resume')
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  resume(request, id) {
    return this.goals.transition(
      request.auth.userId,
      idParams({ id }).id,
      'resume',
    );
  }

  // 완료 확정은 업적(첫 목표 완료)과 보상을 일으키므로 새 활동으로 보고 이용 제한을 적용
  @Post(':id/complete')
  @HttpCode(200)
  @RequireActive()
  @Bind(Req(), Param('id'))
  complete(request, id) {
    return this.goals.transition(
      request.auth.userId,
      idParams({ id }).id,
      'complete',
    );
  }

  @Post(':id/reopen')
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  reopen(request, id) {
    return this.goals.transition(
      request.auth.userId,
      idParams({ id }).id,
      'reopen',
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @Idempotent({ optional: true })
  @Bind(Req(), Param('id'))
  async remove(request, id) {
    await this.goals.removeGoal(request.auth.userId, idParams({ id }).id);
  }

  @Post(':id/steps')
  @RequireActive()
  @Bind(Req(), Param('id'), Body())
  createStep(request, id, body) {
    return this.steps.createStep(
      request.auth.userId,
      idParams({ id }).id,
      validateBody(body, {
        title: title(),
        description: description(),
        dueDate: dateString(),
      }),
    );
  }

  @Patch(':id/steps/:stepId')
  @Bind(Req(), Param('id'), Param('stepId'), Body())
  updateStep(request, id, stepId, body) {
    const ids = idParams({ id, stepId });
    return this.steps.updateStep(
      request.auth.userId,
      ids.id,
      ids.stepId,
      validateBody(body, {
        title: title({ optional: true }),
        description: description(),
        dueDate: dateString({ optional: true }),
      }),
    );
  }

  @Delete(':id/steps/:stepId')
  @HttpCode(204)
  @Bind(Req(), Param('id'), Param('stepId'))
  async removeStep(request, id, stepId) {
    const ids = idParams({ id, stepId });
    await this.steps.removeStep(request.auth.userId, ids.id, ids.stepId);
  }
}
