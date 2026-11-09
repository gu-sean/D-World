import {
  Bind,
  Controller,
  Dependencies,
  Get,
  HttpCode,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import {
  Idempotent,
  UserIdempotencyInterceptor,
} from '../common/idempotency/user-idempotency.interceptor.js';
import { UserWithdrawalService } from './user-withdrawal.service.js';

/** 앱 탈퇴 요청 API (이용 제한 중에도 탈퇴할 수 있어야 하므로 @RequireActive 없음) */
@Controller()
@UseInterceptors(UserIdempotencyInterceptor)
@Dependencies(UserWithdrawalService)
export class UserWithdrawalController {
  constructor(withdrawal) {
    this.withdrawal = withdrawal;
  }

  @Get('me/withdrawal')
  @Bind(Req())
  current(request) {
    return this.withdrawal.getCurrent(request.auth.userId);
  }

  @Post('me/withdrawal')
  @Idempotent()
  @Bind(Req())
  request(request) {
    return this.withdrawal.request(request.auth.userId);
  }

  /** 모바일 A14: 202 + { requestId, status } */
  @Post('me/withdrawal-requests')
  @Idempotent()
  @HttpCode(202)
  @Bind(Req())
  async requestMobile(request) {
    const { request: made } = await this.withdrawal.request(
      request.auth.userId,
    );
    return { requestId: made.id, status: made.status };
  }

  @Post('me/withdrawal/cancel')
  @HttpCode(200)
  @Bind(Req())
  cancel(request) {
    return this.withdrawal.cancel(request.auth.userId);
  }
}
