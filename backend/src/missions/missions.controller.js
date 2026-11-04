import {
  BadRequestException,
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
} from '@nestjs/common';
import { RequireActive } from '../accounts/active-account.guard.js';
import {
  array,
  boolean,
  dateString,
  integer,
  number,
  oneOf,
  string,
  timestamp,
  uuid,
  validateBody,
} from '../common/validation.js';
import { addDays } from '../common/time/kst.js';
import {
  MAX_DATES_PER_REQUEST,
  MAX_RANGE_DAYS,
  MISSION_STATUSES,
  VERIFICATION_METHODS,
} from './missions.constants.js';
import { MissionsService } from './missions.service.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const title = (options) =>
  string({
    min: 1,
    max: 200,
    pattern: /\S/,
    patternMessage: '공백만 입력할 수 없음',
    ...options,
  });
// 빈 문자열은 값 삭제를 뜻함
const text = (max) => string({ min: 0, max, optional: true });
const targetValue = (options) =>
  number({ min: 0.01, max: 99_999_999.99, ...options });
const targetUnit = (options) =>
  string({ min: 1, max: 20, pattern: /\S/, ...options });
const duration = (options) => integer({ min: 1, max: 86_400, ...options });

const CREATE_COMMON = {
  scheduledDates: array(dateString(), { min: 1, max: MAX_DATES_PER_REQUEST }),
  goalId: uuid({ optional: true }),
  stepId: uuid({ optional: true }),
  isRequired: boolean({ optional: true }),
  memo: text(1000),
};

@Controller('missions')
@Dependencies(MissionsService)
export class MissionsController {
  constructor(missions) {
    this.missions = missions;
  }

  /** definitionId가 있으면 원형 복사(템플릿), 없으면 직접 생성 */
  @Post()
  @RequireActive()
  @Bind(Req(), Body())
  async create(req, body) {
    const input =
      body && typeof body === 'object' && body.definitionId !== undefined
        ? validateBody(body, { definitionId: uuid(), ...CREATE_COMMON })
        : validateBody(body, {
            title: title(),
            description: text(2000),
            categoryId: uuid({ optional: true }),
            difficultyId: uuid({ optional: true }),
            verificationMethod: oneOf(VERIFICATION_METHODS),
            targetValue: targetValue({ optional: true }),
            targetUnit: targetUnit({ optional: true }),
            estimatedDurationSeconds: duration({ optional: true }),
            dueAt: timestamp({ optional: true }),
            ...CREATE_COMMON,
          });
    return {
      items: await this.missions.createMissions(req.auth.userId, input),
    };
  }

  @Get()
  @Bind(Req(), Query())
  list(req, query) {
    const filters = validateBody(query, {
      date: dateString({ optional: true }),
      from: dateString({ optional: true }),
      to: dateString({ optional: true }),
      goalId: uuid({ optional: true }),
      stepId: uuid({ optional: true }),
      status: oneOf(MISSION_STATUSES, { optional: true }),
      cursor: string({ min: 1, max: 500, optional: true }),
    });
    if ((filters.from === undefined) !== (filters.to === undefined)) {
      throw new BadRequestException(['from과 to는 함께 지정해야 함']);
    }
    if (filters.date && filters.from) {
      throw new BadRequestException(['date와 from/to는 함께 쓸 수 없음']);
    }
    if (filters.from) {
      if (
        filters.to < filters.from ||
        filters.to > addDays(filters.from, MAX_RANGE_DAYS - 1)
      ) {
        throw new BadRequestException([`날짜 범위는 최대 ${MAX_RANGE_DAYS}일`]);
      }
    }
    let limit = DEFAULT_LIMIT;
    if (query.limit !== undefined) {
      limit = Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw new BadRequestException([`limit: 1~${MAX_LIMIT} 정수여야 함`]);
      }
    }
    return this.missions.listMissions(req.auth.userId, { ...filters, limit });
  }

  @Get(':id')
  @Bind(Req(), Param('id'))
  get(req, id) {
    return this.missions.getMission(
      req.auth.userId,
      validateBody({ id }, { id: uuid() }).id,
    );
  }

  /** 시작 전에는 전체 필드, 시작 후에는 memo만(서비스가 판단). stepId: null이면 단계 연결 해제 */
  @Patch(':id')
  @Bind(Req(), Param('id'), Body())
  update(req, id, body) {
    if (
      body &&
      (body.categoryId !== undefined || body.difficultyId !== undefined)
    ) {
      throw new BadRequestException([
        '카테고리와 난이도는 바꿀 수 없음(보상이 고정됨), 취소하고 새로 만들어야 함',
      ]);
    }
    const clearStep = body && body.stepId === null;
    const patch = validateBody(body, {
      title: title({ optional: true }),
      description: text(2000),
      targetValue: targetValue({ optional: true }),
      targetUnit: targetUnit({ optional: true }),
      estimatedDurationSeconds: duration({ optional: true }),
      verificationMethod: oneOf(VERIFICATION_METHODS, { optional: true }),
      scheduledDate: dateString({ optional: true }),
      dueAt: timestamp({ optional: true }),
      isRequired: boolean({ optional: true }),
      stepId: uuid({ optional: true }),
      memo: text(1000),
    });
    if (clearStep) patch.stepId = null;
    return this.missions.updateMission(
      req.auth.userId,
      validateBody({ id }, { id: uuid() }).id,
      patch,
    );
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  cancel(req, id) {
    return this.missions.cancelMission(
      req.auth.userId,
      validateBody({ id }, { id: uuid() }).id,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @Bind(Req(), Param('id'))
  async remove(req, id) {
    await this.missions.deleteMission(
      req.auth.userId,
      validateBody({ id }, { id: uuid() }).id,
    );
  }
}
