import {
  Bind,
  Body,
  Controller,
  Dependencies,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminOnly } from '../common/auth/admin-auth.guard.js';
import { Public } from '../common/auth/public.decorator.js';
import { string, validateBody } from '../common/validation.js';
import { AdminAuthService } from './admin-auth.service.js';

const STRICT = { default: { limit: 10, ttl: 60_000 } };

/** 관리자 경로 전체가 관리자 토큰 필요, 로그인·갱신만 공개 */
@Controller('admin/v1/auth')
@AdminOnly()
@Dependencies(AdminAuthService)
export class AdminAuthController {
  constructor(adminAuth) {
    this.adminAuth = adminAuth;
  }

  @Public()
  @Throttle(STRICT)
  @Post('login')
  @HttpCode(200)
  @Bind(Body())
  login(body) {
    return this.adminAuth.login(
      validateBody(body, {
        identifier: string({ max: 255 }),
        password: string({ max: 200 }),
      }),
    );
  }

  @Public()
  @Throttle(STRICT)
  @Post('refresh')
  @HttpCode(200)
  @Bind(Body())
  refresh(body) {
    return this.adminAuth.refresh(
      validateBody(body, { refreshToken: string({ max: 200 }) }),
    );
  }

  @Post('logout')
  @HttpCode(204)
  @Bind(Req())
  async logout(req) {
    await this.adminAuth.logout(req.auth.adminId, req.auth.sessionId);
  }
}
