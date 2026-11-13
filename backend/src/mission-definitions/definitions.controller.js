import {
  idOf,
  integer,
  number,
  oneOf,
  string,
  shortId,
  validateBody,
} from '../common/validation.js';
import { VERIFICATION_METHODS } from '../missions/missions.constants.js';
import { PUBLICATION_STATUSES } from './definitions.constants.js';
import { DefinitionsService } from './definitions.service.js';
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
import { parseLimit } from '../common/pagination/limit.js';

const EXERCISE_CODES = [
  'push_up',
  'burpee',
  'squat',
  'lunge',
  'plank',
  'running',
];

const DEFAULT_LIMIT = 20;
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
const targetValue = () =>
  number({ min: 0.01, max: 99_999_999.99, optional: true });
const targetUnit = () =>
  string({ min: 1, max: 20, pattern: /\S/, optional: true });
const duration = () => integer({ min: 1, max: 86_400, optional: true });

@Controller()
@Dependencies(DefinitionsService)
export class DefinitionsController {
  constructor(definitions) {
    this.definitions = definitions;
  }

  /** scope=public(기본): 공개 원형 탐색, scope=mine: 내가 만든 원형(검수 상태 포함) */
  @Get('mission-definitions')
  @Bind(Req(), Query())
  list(request, query) {
    const filters = validateBody(query, {
      scope: oneOf(['public', 'mine'], { optional: true }),
      categoryId: shortId({ optional: true }),
      difficultyId: shortId({ optional: true }),
      exerciseCode: oneOf(EXERCISE_CODES, { optional: true }),
      sort: oneOf(['recent', 'duration'], { optional: true }),
      status: oneOf(PUBLICATION_STATUSES, { optional: true }),
      cursor: string({ min: 1, max: 500, optional: true }),
    });
    const limit = parseLimit(query, DEFAULT_LIMIT, MAX_LIMIT);
    if (filters.scope === 'mine') {
      return this.definitions.listMine(request.auth.userId, {
        status: filters.status,
        cursor: filters.cursor,
        limit,
      });
    }
    if (filters.status !== undefined) {
      throw new BadRequestException(['status는 scope=mine에서만 쓸 수 있음']);
    }
    return this.definitions.listPublic({
      categoryId: filters.categoryId,
      difficultyId: filters.difficultyId,
      exerciseCode: filters.exerciseCode,
      sort: filters.sort,
      cursor: filters.cursor,
      limit,
    });
  }

  /** A36 다음에 할 미션 추천 (최대 10) */
  @Get('recommendations/next-missions')
  @Bind(Req(), Query())
  nextMissions(request, query) {
    const { source } = validateBody(query, {
      source: oneOf(['ai', 'interest', 'all'], { optional: true }),
    });
    return this.definitions.nextMissions(request.auth.userId, source ?? 'all');
  }

  @Get('mission-definitions/:id')
  @Bind(Req(), Param('id'))
  get(request, id) {
    return this.definitions.getDefinition(request.auth.userId, idOf(id));
  }

  @Post('me/mission-definitions')
  @RequireActive()
  @Bind(Req(), Body())
  create(request, body) {
    return this.definitions.createDefinition(
      request.auth.userId,
      validateBody(body, {
        title: title(),
        description: description(),
        categoryId: shortId(),
        difficultyId: shortId(),
        verificationMethod: oneOf(VERIFICATION_METHODS),
        targetValue: targetValue(),
        targetUnit: targetUnit(),
        estimatedDurationSeconds: duration(),
      }),
    );
  }

  @Patch('me/mission-definitions/:id')
  @Bind(Req(), Param('id'), Body())
  update(request, id, body) {
    return this.definitions.updateDefinition(
      request.auth.userId,
      idOf(id),
      validateBody(body, {
        title: title({ optional: true }),
        description: description(),
        categoryId: shortId({ optional: true }),
        difficultyId: shortId({ optional: true }),
        verificationMethod: oneOf(VERIFICATION_METHODS, { optional: true }),
        targetValue: targetValue(),
        targetUnit: targetUnit(),
        estimatedDurationSeconds: duration(),
      }),
    );
  }

  @Delete('me/mission-definitions/:id')
  @HttpCode(204)
  @Bind(Req(), Param('id'))
  async remove(request, id) {
    await this.definitions.deleteDefinition(request.auth.userId, idOf(id));
  }

  @Post('me/mission-definitions/:id/publication-request')
  @HttpCode(200)
  @RequireActive()
  @Bind(Req(), Param('id'))
  requestPublication(request, id) {
    return this.definitions.requestPublication(request.auth.userId, idOf(id));
  }
}
