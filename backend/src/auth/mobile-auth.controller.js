import {
  Bind,
  Body,
  Controller,
  Dependencies,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/auth/public.decorator.js';
import {
  array,
  boolean,
  nickname,
  object,
  oneOf,
  password,
  phone,
  string,
  uuid,
  validateBody,
} from '../common/validation.js';
import { MobileAuthService } from './mobile-auth.service.js';

const STRICT = { default: { limit: 10, ttl: 60_000 } };

const consents = () =>
  array(object({ documentVersionId: uuid(), granted: boolean() }), { max: 10 });
const token = (options) => string({ min: 1, max: 4096, ...options });

/** 모바일 클라이언트 계정 API (08 A01~A09, 로그아웃 A10은 AuthController) */
@Controller()
@Dependencies(MobileAuthService)
export class MobileAuthController {
  constructor(mobileAuth) {
    this.mobileAuth = mobileAuth;
  }

  @Public()
  @Throttle(STRICT)
  @Post('auth/phone-verifications')
  @Bind(Body())
  start(body) {
    const data = validateBody(body, {
      phoneNumber: phone(),
      purpose: oneOf(['signup', 'reset_password']),
    });
    return this.mobileAuth.startPhoneVerification({
      phone: data.phoneNumber,
      purpose: data.purpose,
    });
  }

  @Public()
  @Throttle(STRICT)
  @Post('auth/phone-verifications/:verificationId/confirm')
  @HttpCode(200)
  @Bind(Param('verificationId'), Body())
  confirm(verificationId, body) {
    const { code } = validateBody(body, {
      code: string({ min: 6, max: 6, pattern: /^\d{6}$/ }),
    });
    return this.mobileAuth.confirmPhoneVerification(verificationId, code);
  }

  @Public()
  @Get('policy-documents/current')
  policies() {
    return this.mobileAuth.currentPolicies();
  }

  @Public()
  @Throttle(STRICT)
  @Post('auth/signup')
  @Bind(Body())
  signup(body) {
    return this.mobileAuth.signup(
      validateBody(body, {
        verificationToken: token({ optional: true }),
        socialSignupToken: token({ optional: true }),
        password: string({ min: 10, max: 64, optional: true }),
        nickname: nickname(),
        consents: consents(),
      }),
    );
  }

  @Public()
  @Throttle(STRICT)
  @Post('auth/login')
  @HttpCode(200)
  @Bind(Body())
  login(body) {
    const data = validateBody(body, {
      phoneNumber: phone(),
      password: string({ max: 200 }),
    });
    return this.mobileAuth.login({
      phone: data.phoneNumber,
      password: data.password,
    });
  }

  @Public()
  @Throttle(STRICT)
  @Post('auth/social/:provider/login')
  @HttpCode(200)
  @Bind(Param('provider'), Body())
  socialLogin(provider, body) {
    const data = validateBody(
      { ...body, provider },
      {
        provider: oneOf(['apple', 'google', 'naver']),
        credential: token(),
      },
    );
    return this.mobileAuth.socialLogin(data.provider, data.credential);
  }

  @Public()
  @Throttle(STRICT)
  @Post('auth/password-reset')
  @HttpCode(204)
  @Bind(Body())
  async resetPassword(body) {
    await this.mobileAuth.resetPassword(
      validateBody(body, {
        verificationToken: token(),
        newPassword: password(),
      }),
    );
  }

  @Public()
  @Throttle(STRICT)
  @Post('auth/token/refresh')
  @HttpCode(200)
  @Bind(Body())
  refresh(body) {
    const { refreshToken } = validateBody(body, {
      refreshToken: string({ max: 200 }),
    });
    return this.mobileAuth.refresh(refreshToken);
  }
}
