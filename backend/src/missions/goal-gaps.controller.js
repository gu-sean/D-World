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
import { array, dateString, idOf, validateBody } from '../common/validation.js';
import { GoalGapsService } from './goal-gaps.service.js';

/** 목표의 빈 주 (세부 미션이 "주 N회"보다 적은 주) 조회와 채우기 */
@Controller('goals')
@UseInterceptors(UserIdempotencyInterceptor)
@Dependencies(GoalGapsService)
export class GoalGapsController {
  constructor(gaps) {
    this.gaps = gaps;
  }

  @Get(':goalId/gaps')
  @Bind(Req(), Param('goalId'))
  list(request, goalId) {
    return this.gaps.listGaps(request.auth.userId, idOf(goalId));
  }

  /** weekStarts: 채울 주의 시작일(목록의 from), 생략하면 모든 빈 주 */
  @Post(':goalId/gaps/fill')
  @Idempotent({ optional: true })
  @RequireActive()
  @HttpCode(200)
  @Bind(Req(), Param('goalId'), Body())
  fill(request, goalId, body) {
    const input = validateBody(body ?? {}, {
      weekStarts: array(dateString(), { max: 60, optional: true }),
    });
    return this.gaps.fillGaps(request.auth.userId, idOf(goalId), input);
  }
}
