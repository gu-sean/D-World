import {
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminOnly } from '../common/auth/admin-auth.guard.js';
import { Public } from '../common/auth/public.decorator.js';
import { AppException } from '../common/errors/app-exception.js';
import { ADMIN_REFRESH_TTL_SEC } from '../common/auth/sessions.service.js';
import { string, validateBody } from '../common/validation.js';
import { AdminAuthService } from './admin-auth.service.js';

const STRICT = { default: { limit: 10, ttl: 60_000 } };

// 리프레시 토큰은 HttpOnly 쿠키로만 주고받음 (팀 문서 09 M01~M03)
const COOKIE_NAME = 'dw_admin_refresh';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/admin/v1/auth',
};

/** 관리자 경로 전체가 관리자 토큰 필요, 로그인·갱신만 공개 */
@Controller('admin/v1')
@AdminOnly()
@Dependencies(AdminAuthService)
export class AdminAuthController {
  constructor(adminAuth) {
    this.adminAuth = adminAuth;
  }

  /** M01 */
  @Public()
  @Throttle(STRICT)
  @Post('auth/login')
  @HttpCode(200)
  @Bind(Body(), Res({ passthrough: true }))
  async login(body, response) {
    const session = await this.adminAuth.login(
      validateBody(body, {
        loginId: string({ max: 255 }),
        password: string({ max: 200 }),
      }),
    );
    return this.withCookie(response, session);
  }

  /** M02 */
  @Public()
  @Throttle(STRICT)
  @Post('auth/refresh')
  @HttpCode(200)
  @Bind(Req(), Res({ passthrough: true }))
  async refresh(request, response) {
    const refreshToken = request.cookies?.[COOKIE_NAME];
    if (typeof refreshToken !== 'string' || refreshToken.length > 200) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'invalid_refresh_token',
        '다시 로그인해야 함',
      );
    }
    return this.withCookie(
      response,
      await this.adminAuth.refresh({ refreshToken }),
    );
  }

  /** M03 */
  @Post('auth/logout')
  @HttpCode(204)
  @Bind(Req(), Res({ passthrough: true }))
  async logout(request, response) {
    await this.adminAuth.logout(request.auth.adminId, request.auth.sessionId);
    response.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
  }

  /** M04 */
  @Get('me')
  @Bind(Req())
  me(request) {
    return this.adminAuth.me(request.auth.adminId);
  }

  /** 새 refresh token은 쿠키로만 내려주고 본문에서는 뺌 */
  withCookie(response, session) {
    const { refreshToken, refreshExpiresAt, ...body } = session;
    response.cookie(COOKIE_NAME, refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: ADMIN_REFRESH_TTL_SEC * 1000,
    });
    return body;
  }
}
