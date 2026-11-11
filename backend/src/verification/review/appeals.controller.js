import { idOf, oneOf, string, validateBody } from '../../common/validation.js';
import { AdminReviewService } from './admin-review.service.js';
import { AppealsService } from './appeals.service.js';
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
  UseInterceptors,
} from '@nestjs/common';
import { AdminOnly } from '../../common/auth/admin-auth.guard.js';
import {
  parseAdminPage,
  pickEnum,
} from '../../common/pagination/admin-page.js';
import { readIdempotencyKey } from '../../common/idempotency/admin-idempotency.service.js';
import {
  Idempotent,
  UserIdempotencyInterceptor,
} from '../../common/idempotency/user-idempotency.interceptor.js';

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
  file(request, id, body) {
    const { reason } = validateBody(body, { reason: reasonRule() });
    return this.appeals.fileAppeal(
      request.auth.userId,
      idOf(id),
      reason.trim(),
    );
  }

  /** A46: 거절된 현재 판정에 7일 안에, 사유 10~500자 */
  @Post('verification-results/:id/appeals')
  @Idempotent()
  @Bind(Req(), Param('id'), Body())
  fileByResult(request, id, body) {
    const { reason } = validateBody(body, {
      reason: string({ min: 10, max: 500, pattern: /\S/ }),
    });
    return this.appeals.fileAppealByResult(
      request.auth.userId,
      idOf(id),
      reason.trim(),
    );
  }

  @Get('records/:id/appeals')
  @Bind(Req(), Param('id'))
  list(request, id) {
    return this.appeals.listForRecord(request.auth.userId, idOf(id));
  }
}

/** 관리자 전용 이의 제기 처리 M33~M35, 변경 요청은 Idempotency-Key 헤더가 필요 */
@Controller('admin/v1/appeals')
@AdminOnly()
@Dependencies(AppealsService, AdminReviewService)
export class AdminAppealsController {
  constructor(appeals, reviews) {
    this.appeals = appeals;
    this.reviews = reviews;
  }

  /** M34 */
  @Get()
  @Bind(Query())
  list(query) {
    const status =
      pickEnum(query, 'status', ['open', 'accepted', 'rejected']) ?? 'open';
    const paging = parseAdminPage(query, {
      'filedAt,asc': 'a.filed_at ASC, a.id ASC',
    });
    return this.appeals.list({ status, paging });
  }

  /** M35 */
  @Get(':id')
  @Bind(Param('id'))
  async get(id) {
    const { view, recordId } = await this.appeals.getForAdmin(idOf(id));
    return {
      appeal: view,
      verification: await this.reviews.getRecord(recordId),
    };
  }

  /** M33: approved = 이의 인정(판정 변경), rejected = 기각(판정 유지) */
  @Post(':id/resolution')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Body())
  resolve(request, id, body) {
    const data = validateBody(body, {
      decision: oneOf(['approved', 'rejected']),
      reason: reasonRule(),
    });
    return this.appeals.resolve(request.auth.adminId, {
      appealId: idOf(id),
      outcome: data.decision === 'approved' ? 'accepted' : 'rejected',
      reason: data.reason.trim(),
      key: readIdempotencyKey(request),
    });
  }
}
