import {
  Bind,
  Controller,
  Delete,
  Dependencies,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { RequireActive } from '../accounts/active-account.guard.js';
import {
  Idempotent,
  UserIdempotencyInterceptor,
} from '../common/idempotency/user-idempotency.interceptor.js';
import { idOf } from '../common/validation.js';
import { limitOf } from './challenges.validation.js';
import { MobileChallengesService } from './mobile-challenges.service.js';

/** 모바일 클라이언트 챌린지 API A102·A103·A105·A107 */
@Controller()
@UseInterceptors(UserIdempotencyInterceptor)
@Dependencies(MobileChallengesService)
export class MobileChallengesController {
  constructor(challenges) {
    this.challenges = challenges;
  }

  /** A102 참여 신청 → MyChallenge (201) */
  @Post('challenges/:id/participations')
  @Idempotent()
  @RequireActive()
  @Bind(Req(), Param('id'))
  join(request, id) {
    return this.challenges.join(request.auth.userId, idOf(id));
  }

  /** A103 중도 포기, 이용 제한 중에도 가능 */
  @Delete('challenges/:id/participations/me')
  @Idempotent()
  @HttpCode(204)
  @Bind(Req(), Param('id'))
  async leave(request, id) {
    await this.challenges.leave(request.auth.userId, idOf(id));
  }

  /** A105 */
  @Get('challenges/:id/rankings')
  @Bind(Req(), Param('id'), Query())
  ranking(request, id, query) {
    return this.challenges.ranking(
      request.auth.userId,
      idOf(id),
      limitOf(query),
    );
  }

  /** A107 */
  @Get('me/challenges/:id/result')
  @Bind(Req(), Param('id'))
  result(request, id) {
    return this.challenges.result(request.auth.userId, idOf(id));
  }
}
