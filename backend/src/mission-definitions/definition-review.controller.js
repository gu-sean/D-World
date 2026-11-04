import { idOf, oneOf, string, validateBody } from '../common/validation.js';
import { PUBLICATION_STATUSES } from './definitions.constants.js';
import { readLimit } from './definitions.controller.js';
import { DefinitionReviewService } from './definition-review.service.js';
import {
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
} from '@nestjs/common';
import { AdminOnly } from '../common/auth/admin-auth.guard.js';
import { readIdempotencyKey } from '../common/idempotency/admin-idempotency.service.js';

const reason = (options) =>
  string({
    min: 1,
    max: 1000,
    pattern: /\S/,
    patternMessage: '공백만 입력할 수 없음',
    ...options,
  });

/** 관리자 전용 검수 API, 변경 요청은 모두 Idempotency-Key 헤더가 필요 */
@Controller('admin/v1/mission-definitions')
@AdminOnly()
@Dependencies(DefinitionReviewService)
export class DefinitionReviewController {
  constructor(reviews) {
    this.reviews = reviews;
  }

  @Get('reviews')
  @Bind(Query())
  queue(query) {
    const filters = validateBody(query, {
      status: oneOf(PUBLICATION_STATUSES, { optional: true }),
      cursor: string({ min: 1, max: 500, optional: true }),
    });
    return this.reviews.listQueue({ ...filters, limit: readLimit(query) });
  }

  @Post(':id/approve')
  @HttpCode(200)
  @Bind(Req(), Param('id'))
  approve(req, id) {
    return this.reviews.decide(req.auth.adminId, {
      definitionId: idOf(id),
      action: 'approve',
      key: readIdempotencyKey(req),
    });
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Body())
  reject(req, id, body) {
    return this.reviews.decide(req.auth.adminId, {
      definitionId: idOf(id),
      action: 'reject',
      reason: validateBody(body, { reason: reason() }).reason,
      key: readIdempotencyKey(req),
    });
  }

  @Post(':id/hide')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Body())
  hide(req, id, body) {
    return this.reviews.decide(req.auth.adminId, {
      definitionId: idOf(id),
      action: 'hide',
      reason: validateBody(body, { reason: reason() }).reason,
      key: readIdempotencyKey(req),
    });
  }
}
