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
    // status=all: 인증 기록(읽기 전용 이력) 화면이 모든 상태를 본다. 생략하면 예전처럼 review_required
    const picked = pickEnum(query, 'status', [
      'all',
      'review_required',
      'approved',
      'rejected',
      'submitted',
    ]);
    const status = picked === 'all' ? null : (picked ?? 'review_required');
    const method = pickEnum(query, 'method', ['camera', 'sensor']);
    const userId = query.userId ? idOf(query.userId) : undefined;
    const paging = parseAdminPage(query, {
      // 제출 전(녹화 중·업로드 중·중단) 기록은 submitted_at이 없어 시작 시각으로 대신 정렬
      'submittedAt,desc':
        'COALESCE(r.submitted_at, r.started_at) DESC, r.id DESC',
      'submittedAt,asc': 'COALESCE(r.submitted_at, r.started_at) ASC, r.id ASC',
    });
    const { page, completedToday } = await this.reviews.list({
      status,
      method,
      userId,
      member: query.member,
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

  /** 러닝 회차의 경로 그림 데이터 (원본 GPS 파일로 계산, 저장 안 함) */
  @Get(':id/route')
  @Bind(Param('id'))
  route(id) {
    return this.reviews.getRoute(idOf(id));
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
