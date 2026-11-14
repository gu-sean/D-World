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
  UseInterceptors,
} from '@nestjs/common';
import { RequireActive } from '../accounts/active-account.guard.js';
import {
  Idempotent,
  UserIdempotencyInterceptor,
} from '../common/idempotency/user-idempotency.interceptor.js';
import {
  array,
  boolean,
  dateString,
  integer,
  number,
  oneOf,
  string,
  timestamp,
  shortId,
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

const EXERCISE_CODES = [
  'push_up',
  'burpee',
  'squat',
  'lunge',
  'plank',
  'running',
];

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
  goalId: shortId({ optional: true }),
  stepId: shortId({ optional: true }),
  isRequired: boolean({ optional: true }),
  memo: text(1000),
};

@Controller('missions')
@UseInterceptors(UserIdempotencyInterceptor)
@Dependencies(MissionsService)
export class MissionsController {
  constructor(missions) {
    this.missions = missions;
  }

  /**
   * Idempotency-Key가 있으면 같은 키의 재시도는 같은 결과를 돌려준다(없어도 동작)
   * definitionId가 있으면 원형 복사(템플릿), 없으면 직접 생성
   * - scheduledDates(여러 날짜) → { items } (기존 API)
   * - scheduledDate(한 날짜) → Mission 하나 (모바일 08 A31)
   */
  @Post()
  @Idempotent({ optional: true })
  @RequireActive()
  @Bind(Req(), Body())
  async create(request, rawBody) {
    let body = rawBody;
    const single =
      body &&
      typeof body === 'object' &&
      body.scheduledDate !== undefined &&
      body.scheduledDates === undefined;
    if (body && typeof body === 'object') {
      const { scheduledDate, goalStepId, ...rest } = body;
      body = { ...rest };
      if (single) body.scheduledDates = [scheduledDate];
      if (goalStepId !== undefined && rest.stepId === undefined) {
        body.stepId = goalStepId;
      }
    }
    const input =
      body && typeof body === 'object' && body.definitionId !== undefined
        ? validateBody(body, { definitionId: shortId(), ...CREATE_COMMON })
        : validateBody(body, {
            title: title(),
            description: text(2000),
            categoryId: shortId({ optional: true }),
            difficultyId: shortId({ optional: true }),
            exerciseCode: oneOf(EXERCISE_CODES, { optional: true }),
            // 모바일 미션 만들기 폼(08 A31 MissionInput)은 인증 방식을 보내지 않음 → 생략하면 서버가 정함
            verificationMethod: oneOf(VERIFICATION_METHODS, { optional: true }),
            targetValue: targetValue({ optional: true }),
            targetUnit: targetUnit({ optional: true }),
            estimatedDurationSeconds: duration({ optional: true }),
            dueAt: timestamp({ optional: true }),
            ...CREATE_COMMON,
          });
    const items = await this.missions.createMissions(
      request.auth.userId,
      input,
    );
    if (single) {
      await this.missions.attachChallengeIds(items);
      return items[0];
    }
    return { items };
  }

  /**
   * 미션 난이도·보상 미리 보기 (저장하지 않음)
   * 직접 만드는 미션은 난이도를 고르지 않고 이 규칙으로 정해진다 (difficulty-rules.js)
   */
  @Post('difficulty-preview')
  @HttpCode(200)
  @Bind(Req(), Body())
  previewDifficulty(request, body) {
    const input = validateBody(body, {
      goalId: shortId({ optional: true }),
      categoryId: shortId({ optional: true }),
      exerciseCode: oneOf(EXERCISE_CODES, { optional: true }),
      targetValue: targetValue({ optional: true }),
      targetUnit: targetUnit({ optional: true }),
      estimatedDurationSeconds: duration({ optional: true }),
    });
    return this.missions.previewDifficulty(request.auth.userId, input);
  }

  @Get()
  @Bind(Req(), Query())
  async list(request, query) {
    const filters = validateBody(query, {
      date: dateString({ optional: true }),
      from: dateString({ optional: true }),
      to: dateString({ optional: true }),
      goalId: shortId({ optional: true }),
      stepId: shortId({ optional: true }),
      categoryId: shortId({ optional: true }),
      status: string({ min: 1, max: 100, optional: true }),
      cursor: string({ min: 1, max: 500, optional: true }),
    });
    // 여러 값 필터 `?status=a,b` (05 §6)
    if (filters.status !== undefined) {
      const statuses = filters.status.split(',').map((value) => value.trim());
      if (statuses.some((value) => !MISSION_STATUSES.includes(value))) {
        throw new BadRequestException([
          `status: ${MISSION_STATUSES.join(', ')} 중 하나 이상이어야 함`,
        ]);
      }
      filters.statuses = statuses;
      delete filters.status;
    }
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
    const page = await this.missions.listMissions(request.auth.userId, {
      ...filters,
      limit,
    });
    await this.missions.attachChallengeIds(page.items);
    return page;
  }

  @Get(':id')
  @Bind(Req(), Param('id'))
  get(request, id) {
    return this.missions.getDetail(
      request.auth.userId,
      validateBody({ id }, { id: shortId() }).id,
    );
  }

  /** 시작 전에는 전체 필드, 시작 후에는 memo만(서비스가 판단). stepId: null이면 단계 연결 해제 */
  @Patch(':id')
  @Idempotent({ optional: true })
  @Bind(Req(), Param('id'), Body())
  async update(request, id, body) {
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
      stepId: shortId({ optional: true }),
      memo: text(1000),
    });
    if (clearStep) patch.stepId = null;
    const view = await this.missions.updateMission(
      request.auth.userId,
      validateBody({ id }, { id: shortId() }).id,
      patch,
    );
    return this.missions.toDetail(view);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Idempotent({ optional: true })
  @Bind(Req(), Param('id'))
  async cancel(request, id) {
    const view = await this.missions.cancelMission(
      request.auth.userId,
      validateBody({ id }, { id: shortId() }).id,
    );
    return this.missions.attachChallengeIds(view);
  }

  @Delete(':id')
  @HttpCode(204)
  @Bind(Req(), Param('id'))
  async remove(request, id) {
    await this.missions.deleteMission(
      request.auth.userId,
      validateBody({ id }, { id: shortId() }).id,
    );
  }
}
