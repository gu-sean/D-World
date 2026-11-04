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
  create(req, body) {
    return this.goals.createGoal(
      req.auth.userId,
      validateBody(body, {
        title: title(),
        description: description(),
        categoryId: uuid(),
        difficultyId: uuid(),
        startDate: dateString(),
        endDate: dateString(),
        targetFrequency: integer({ min: 1, max: 7, optional: true }),
      }),
    );
  }

  @Get()
  @Bind(Req(), Query())
  list(req, query) {
    const { status } = validateBody(query, {
      status: oneOf(GOAL_STATUSES, { optional: true }),
    });
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
    return this.goals.listGoals(req.auth.userId, {
      status,
      cursor: query.cursor,
      limit,
    });
  }

  @Get(':id')
  @Bind(Req(), Param('id'))
  get(req, id) {
    return this.goals.getGoal(req.auth.userId, idParams({ id }).id);
  }

  @Patch(':id')
  @Bind(Req(), Param('id'), Body())
  update(req, id, body) {
    return this.goals.updateGoal(
      req.auth.userId,
      idParams({ id }).id,
      validateBody(body, {
        title: title({ optional: true }),
        description: description(),
        categoryId: uuid({ optional: true }),
        difficultyId: uuid({ optional: true }),
        startDate: dateString({ optional: true }),
        endDate: dateString({ optional: true }),
        targetFrequency: integer({ min: 1, max: 7, optional: true }),
      }),
    );
  }

  @Post(':id/pause')
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  pause(req, id) {
    return this.goals.transition(req.auth.userId, idParams({ id }).id, 'pause');
  }

  @Post(':id/resume')
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  resume(req, id) {
    return this.goals.transition(
      req.auth.userId,
      idParams({ id }).id,
      'resume',
    );
  }

  // 완료 확정은 업적(첫 목표 완료)과 보상을 일으키므로 새 활동으로 보고 이용 제한을 적용
  @Post(':id/complete')
  @HttpCode(200)
  @RequireActive()
  @Bind(Req(), Param('id'))
  complete(req, id) {
    return this.goals.transition(
      req.auth.userId,
      idParams({ id }).id,
      'complete',
    );
  }

  @Post(':id/reopen')
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  reopen(req, id) {
    return this.goals.transition(
      req.auth.userId,
      idParams({ id }).id,
      'reopen',
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @Bind(Req(), Param('id'))
  async remove(req, id) {
    await this.goals.deleteGoal(req.auth.userId, idParams({ id }).id);
  }

  @Post(':id/steps')
  @RequireActive()
  @Bind(Req(), Param('id'), Body())
  createStep(req, id, body) {
    return this.steps.createStep(
      req.auth.userId,
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
  updateStep(req, id, stepId, body) {
    const ids = idParams({ id, stepId });
    return this.steps.updateStep(
      req.auth.userId,
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
  async removeStep(req, id, stepId) {
    const ids = idParams({ id, stepId });
    await this.steps.deleteStep(req.auth.userId, ids.id, ids.stepId);
  }
}
