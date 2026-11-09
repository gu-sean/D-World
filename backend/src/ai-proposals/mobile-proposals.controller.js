import {
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  HttpCode,
  Param,
  Post,
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
  idOf,
  integer,
  jsonObject,
  string,
  validateBody,
} from '../common/validation.js';
import { MobileProposalsService } from './mobile-proposals.service.js';
import { planSpec } from './proposals.controller.js';

/** 모바일 클라이언트 계획 제안 API A25~A28 */
@Controller()
@Dependencies(MobileProposalsService)
@UseInterceptors(UserIdempotencyInterceptor)
export class MobileProposalsController {
  constructor(proposals) {
    this.proposals = proposals;
  }

  /** A25: 새 제안(draft)을 만든다 */
  @Post('goals/:goalId/plan-proposals')
  @Idempotent()
  @RequireActive()
  @Bind(Req(), Param('goalId'))
  generate(request, goalId) {
    return this.proposals.generate(request.auth.userId, idOf(goalId));
  }

  /** A26: 가장 최근 제안, 없으면 404 */
  @Get('goals/:goalId/plan-proposals/latest')
  @Bind(Req(), Param('goalId'))
  latest(request, goalId) {
    return this.proposals.latest(request.auth.userId, idOf(goalId));
  }

  /** A27: steps를 보내면 사용자가 고친 계획, 없으면 제안 그대로 */
  @Post('plan-proposals/:proposalId/accept')
  @Idempotent()
  @RequireActive()
  @Bind(Req(), Param('proposalId'), Body())
  accept(request, proposalId, body) {
    const data = validateBody(body, {
      generationNo: integer({ min: 1 }),
      steps: array(jsonObject(), { max: 30, optional: true }),
    });
    return this.proposals.accept(
      request.auth.userId,
      idOf(proposalId),
      data,
      (plan) => validateBody({ plan }, { plan: planSpec }).plan,
    );
  }

  /** A28: draft만 거절, 본문 없이 204 */
  @Post('plan-proposals/:proposalId/reject')
  @HttpCode(204)
  @Bind(Req(), Param('proposalId'), Body())
  async reject(request, proposalId, body) {
    validateBody(body ?? {}, { reason: string({ max: 500, optional: true }) });
    await this.proposals.reject(request.auth.userId, idOf(proposalId));
  }
}
