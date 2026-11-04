import { idOf, oneOf, string, validateBody } from '../../common/validation.js';
import { AdminReviewService } from './admin-review.service.js';
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
} from '@nestjs/common';
import { AdminOnly } from '../../common/auth/admin-auth.guard.js';
import { readIdempotencyKey } from '../../common/idempotency/admin-idempotency.service.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** 관리자 전용 보류 검수 API, 변경 요청은 Idempotency-Key 헤더가 필요 */
@Controller('admin/v1/verification')
@AdminOnly()
@Dependencies(AdminReviewService)
export class AdminReviewController {
  constructor(reviews) {
    this.reviews = reviews;
  }

  @Get('queue')
  @Bind(Query())
  queue(query) {
    const { cursor } = validateBody(query, {
      cursor: string({ min: 1, max: 500, optional: true }),
    });
    let limit = DEFAULT_LIMIT;
    if (query.limit !== undefined) {
      limit = Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw new BadRequestException([`limit: 1~${MAX_LIMIT} 정수여야 함`]);
      }
    }
    return this.reviews.listQueue({ cursor, limit });
  }

  @Get('records/:id')
  @Bind(Param('id'))
  record(id) {
    return this.reviews.getRecord(idOf(id));
  }

  @Post('records/:id/decisions')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Body())
  decide(req, id, body) {
    const data = validateBody(body, {
      decision: oneOf(['approved', 'rejected']),
      reason: string({
        min: 1,
        max: 1000,
        pattern: /\S/,
        patternMessage: '공백만 입력할 수 없음',
      }),
    });
    return this.reviews.decide(req.auth.adminId, {
      recordId: idOf(id),
      ...data,
      key: readIdempotencyKey(req),
    });
  }
}
