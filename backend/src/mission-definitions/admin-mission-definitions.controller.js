import {
  idOf,
  integer,
  number,
  oneOf,
  string,
  shortId,
  validateBody,
} from '../common/validation.js';
import { EXERCISE_CODES } from '../challenges/challenges.constants.js';
import { VERIFICATION_METHODS } from '../missions/missions.constants.js';
import { AdminDefinitionsService } from './admin-definitions.service.js';
import { parseAdminPage, pickEnum } from '../common/pagination/admin-page.js';
import { PUBLICATION_STATUSES } from './definitions.constants.js';
import { DefinitionReviewService } from './definition-review.service.js';
import {
  BadRequestException,
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AdminOnly } from '../common/auth/admin-auth.guard.js';
import { readIdempotencyKey } from '../common/idempotency/admin-idempotency.service.js';

const DECISION_ACTIONS = {
  approved: 'approve',
  rejected: 'reject',
  hidden: 'hide',
};

// 관리자가 정할 수 있는 공개 상태(검수 흐름의 review_pending·rejected는 사용자 틀 전용)
const ADMIN_STATUSES = ['draft', 'public', 'hidden'];

const definitionRules = (optional) => ({
  title: string({
    min: 1,
    max: 200,
    pattern: /\S/,
    patternMessage: '공백만 입력할 수 없음',
    optional,
  }),
  description: string({ min: 0, max: 2000, optional: true }),
  categoryId: shortId({ optional }),
  difficultyId: shortId({ optional }),
  exerciseCode: oneOf(EXERCISE_CODES, { optional: true }),
  verificationMethod: oneOf(VERIFICATION_METHODS, { optional }),
  targetValue: number({ min: 0.01, max: 99_999_999.99, optional: true }),
  targetUnit: string({ min: 1, max: 20, pattern: /\S/, optional: true }),
  estimatedDurationSeconds: integer({ min: 1, max: 86_400, optional: true }),
  publicationStatus: oneOf(ADMIN_STATUSES, { optional: true }),
});

const reason = (options) =>
  string({
    min: 1,
    max: 500,
    pattern: /\S/,
    patternMessage: '공백만 입력할 수 없음',
    ...options,
  });

/** 관리자 전용 미션 틀 API(M42, M44), 변경 요청은 모두 Idempotency-Key 헤더와 reason이 필요 */
@Controller('admin/v1/mission-definitions')
@AdminOnly()
@Dependencies(DefinitionReviewService, AdminDefinitionsService)
export class AdminMissionDefinitionsController {
  constructor(reviews, definitions) {
    this.reviews = reviews;
    this.definitions = definitions;
  }

  /** M40: 관리자 미션 틀 등록, 공개 상태 기본값은 public */
  @Post()
  @Bind(Req(), Body())
  create(request, body) {
    const { reason: why, ...input } = validateBody(body, {
      ...definitionRules(false),
      reason: reason(),
    });
    return this.definitions.create(
      request.auth.adminId,
      { publicationStatus: 'public', ...input },
      readIdempotencyKey(request),
      why.trim(),
    );
  }

  /** M41: 보낸 필드만 수정, 이미 만들어진 미션에는 영향 없음 */
  @Patch(':id')
  @Bind(Req(), Param('id'), Body())
  update(request, id, body) {
    const { reason: why, ...patch } = validateBody(body, {
      ...definitionRules(true),
      reason: reason(),
    });
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException(['바꿀 항목이 없음']);
    }
    return this.definitions.update(
      request.auth.adminId,
      idOf(id),
      patch,
      readIdempotencyKey(request),
      why.trim(),
    );
  }

  /** M43 */
  @Get(':id')
  @Bind(Param('id'))
  get(id) {
    return this.definitions.get(idOf(id));
  }

  /** M42 */
  @Get()
  @Bind(Query())
  list(query) {
    const filters = validateBody(query, {
      categoryId: shortId({ optional: true }),
    });
    return this.reviews.listAdmin({
      origin: pickEnum(query, 'origin', ['admin', 'user']),
      publicationStatus: pickEnum(
        query,
        'publicationStatus',
        PUBLICATION_STATUSES,
      ),
      categoryId: filters.categoryId,
      query: typeof query.query === 'string' ? query.query.trim() : undefined,
      paging: parseAdminPage(query, {
        'createdAt,desc': 'd.created_at DESC, d.id DESC',
        'createdAt,asc': 'd.created_at ASC, d.id ASC',
      }),
    });
  }

  /** M44: approved(공개) / rejected(반려) / hidden(숨김) */
  @Post(':id/reviews')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Body())
  review(request, id, body) {
    const input = validateBody(body, {
      decision: oneOf(['approved', 'rejected', 'hidden']),
      reason: reason(),
    });
    return this.reviews.decide(request.auth.adminId, {
      definitionId: idOf(id),
      action: DECISION_ACTIONS[input.decision],
      reason: input.reason,
      key: readIdempotencyKey(request),
    });
  }
}
