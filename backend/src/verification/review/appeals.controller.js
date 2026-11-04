import { idOf, oneOf, string, validateBody } from '../../common/validation.js';
import { AppealsService } from './appeals.service.js';
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
import { AdminOnly } from '../../common/auth/admin-auth.guard.js';
import { readIdempotencyKey } from '../../common/idempotency/admin-idempotency.service.js';
import {
  Idempotent,
  UserIdempotencyInterceptor,
} from '../../common/idempotency/user-idempotency.interceptor.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const reasonRule = () =>
  string({
    min: 1,
    max: 1000,
    pattern: /\S/,
    patternMessage: '공백만 입력할 수 없음',
  });

/**
 * 사용자 이의 제기: 이용 제한 중에도 접수할 수 있다(분쟁 수단이라서 @RequireActive()를 붙이지 않음)
 */
@Controller()
@Dependencies(AppealsService)
@UseInterceptors(UserIdempotencyInterceptor)
export class AppealsController {
  constructor(appeals) {
    this.appeals = appeals;
  }

  @Post('records/:id/appeals')
  @Idempotent()
  @Bind(Req(), Param('id'), Body())
  file(req, id, body) {
    const { reason } = validateBody(body, { reason: reasonRule() });
    return this.appeals.fileAppeal(req.auth.userId, idOf(id), reason.trim());
  }

  @Get('records/:id/appeals')
  @Bind(Req(), Param('id'))
  list(req, id) {
    return this.appeals.listForRecord(req.auth.userId, idOf(id));
  }
}

/** 관리자 전용 이의 제기 처리, 변경 요청은 Idempotency-Key 헤더가 필요 */
@Controller('admin/v1/verification/appeals')
@AdminOnly()
@Dependencies(AppealsService)
export class AdminAppealsController {
  constructor(appeals) {
    this.appeals = appeals;
  }

  @Get()
  @Bind(Query())
  queue(query) {
    const filters = validateBody(query, {
      status: oneOf(['open', 'accepted', 'rejected'], { optional: true }),
      cursor: string({ min: 1, max: 500, optional: true }),
    });
    let limit = DEFAULT_LIMIT;
    if (query.limit !== undefined) {
      limit = Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw new BadRequestException([`limit: 1~${MAX_LIMIT} 정수여야 함`]);
      }
    }
    return this.appeals.listQueue({ ...filters, limit });
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Body())
  resolve(req, id, body) {
    const data = validateBody(body, {
      outcome: oneOf(['accepted', 'rejected']),
      reason: reasonRule(),
    });
    return this.appeals.resolve(req.auth.adminId, {
      appealId: idOf(id),
      outcome: data.outcome,
      reason: data.reason.trim(),
      key: readIdempotencyKey(req),
    });
  }
}
