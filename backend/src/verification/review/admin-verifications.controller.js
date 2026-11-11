import { idOf, oneOf, string, validateBody } from '../../common/validation.js';
import { AdminReviewService } from './admin-review.service.js';
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
  Res,
} from '@nestjs/common';
import { AdminOnly } from '../../common/auth/admin-auth.guard.js';
import {
  parseAdminPage,
  pickEnum,
} from '../../common/pagination/admin-page.js';
import { readIdempotencyKey } from '../../common/idempotency/admin-idempotency.service.js';

/** 관리자 전용 인증 검수 API M30~M32, 변경 요청은 Idempotency-Key 헤더가 필요 */
@Controller('admin/v1/verifications')
@AdminOnly()
@Dependencies(AdminReviewService)
export class AdminVerificationsController {
  constructor(reviews) {
    this.reviews = reviews;
  }

  /** M30: 본문은 AdminPage, 오늘 관리자 판정 수는 X-Completed-Today 헤더 */
  @Get()
  @Bind(Query(), Res({ passthrough: true }))
  async list(query, response) {
    const status =
      pickEnum(query, 'status', [
        'review_required',
        'approved',
        'rejected',
        'submitted',
      ]) ?? 'review_required';
    const method = pickEnum(query, 'method', ['camera', 'sensor']);
    const userId = query.userId ? idOf(query.userId) : undefined;
    const paging = parseAdminPage(query, {
      'submittedAt,asc': 'r.submitted_at ASC, r.id ASC',
      'submittedAt,desc': 'r.submitted_at DESC, r.id DESC',
    });
    const { page, completedToday } = await this.reviews.list({
      status,
      method,
      userId,
      paging,
    });
    response.setHeader('X-Completed-Today', String(completedToday));
    return page;
  }

  /** M32 */
  @Get(':id')
  @Bind(Param('id'))
  get(id) {
    return this.reviews.getRecord(idOf(id));
  }

  /** M31 */
  @Post(':id/decisions')
  @HttpCode(200)
  @Bind(Req(), Param('id'), Body())
  decide(request, id, body) {
    const data = validateBody(body, {
      decision: oneOf(['approved', 'rejected']),
      reason: string({
        min: 1,
        max: 1000,
        pattern: /\S/,
        patternMessage: '공백만 입력할 수 없음',
      }),
    });
    return this.reviews.decide(request.auth.adminId, {
      recordId: idOf(id),
      ...data,
      key: readIdempotencyKey(request),
    });
  }
}
