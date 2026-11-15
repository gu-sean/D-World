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
  boolean,
  idOf,
  number,
  oneOf,
  shortId,
  validateBody,
} from '../common/validation.js';
import { RecommendationsService } from './recommendations.service.js';

/** 상황 추천 API A90~A93 (경로 `recommendations/next-missions`는 미션 틀 모듈이 맡음) */
@Controller('recommendations')
@UseInterceptors(UserIdempotencyInterceptor)
@Dependencies(RecommendationsService)
export class RecommendationsController {
  constructor(recommendations) {
    this.recommendations = recommendations;
  }

  /** A90 */
  @Post('situational')
  @Idempotent()
  @RequireActive()
  @Bind(Req(), Body())
  request(request, body) {
    const input = validateBody(body, {
      kind: oneOf(['location', 'moving', 'weather']),
      latitude: number({ min: -90, max: 90, optional: true }),
      longitude: number({ min: -180, max: 180, optional: true }),
      isMoving: boolean({ optional: true }),
    });
    return this.recommendations.request(request.auth.userId, input);
  }

  /** A93 */
  @Get('active')
  @Bind(Req())
  active(request) {
    return this.recommendations.active(request.auth.userId);
  }

  /** LLM 추천 목록에서 여러 미션을 골라 한 번에 추가한다. */
  @Post('accept-batch')
  @Idempotent()
  @RequireActive()
  @Bind(Req(), Body())
  acceptBatch(request, body) {
    const input = validateBody(body, {
      recommendationIds: array(shortId(), { min: 1, max: 3 }),
      goalId: shortId({ optional: true }),
    });
    return this.recommendations.acceptBatch(request.auth.userId, input);
  }

  /** A91 */
  @Post(':id/accept')
  @Idempotent()
  @RequireActive()
  @Bind(Req(), Param('id'))
  accept(request, id) {
    return this.recommendations.accept(request.auth.userId, idOf(id));
  }

  /** A92 */
  @Post(':id/dismiss')
  @HttpCode(204)
  @Bind(Req(), Param('id'))
  async dismiss(request, id) {
    await this.recommendations.dismiss(request.auth.userId, idOf(id));
  }
}
