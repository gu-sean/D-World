import {
  Bind,
  Body,
  Controller,
  Dependencies,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AccessTokenService } from '../common/auth/access-token.service.js';
import { SessionKind } from '../common/auth/auth.constants.js';
import { bearerToken } from '../common/auth/user-auth.guard.js';
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
import { AuthService } from './auth.service.js';
import { MobileAuthService } from './mobile-auth.service.js';
import { SOCIAL_PROVIDERS } from './social/social-verifier.service.js';

// 계정 열거·무차별 대입 방지용 IP 제한(번호·계정 단위 제한은 서비스가 DB로 처리)
const STRICT = { default: { limit: 10, ttl: 60_000 } };

const code = () => string({ min: 6, max: 6, pattern: /^\d{6}$/ });
const provider = () => oneOf(SOCIAL_PROVIDERS);
const socialToken = () => string({ min: 1, max: 4096 });
const consents = () =>
  array(object({ documentVersionId: uuid(), granted: boolean() }), { max: 10 });

@Controller()
@Dependencies(AuthService, AccessTokenService, MobileAuthService)
export class AuthController {
  constructor(auth, tokens, mobileAuth) {
    this.auth = auth;
    this.tokens = tokens;
    this.mobileAuth = mobileAuth;
  }

  @Public()
  @Throttle(STRICT)
  @Post('auth/phone/codes')
  @HttpCode(204)
  @Bind(Body())
  async sendCode(body) {
    const data = validateBody(body, {
      phone: phone(),
      purpose: oneOf(['signup', 'reset_password']),
    });
    await this.auth.sendCode(data.phone, data.purpose);
  }

  @Public()
  @Throttle(STRICT)
  @Post('auth/signup/phone')
  @Bind(Body())
  signupPhone(body) {
    return this.auth.signupPhone(
      validateBody(body, {
        phone: phone(),
        code: code(),
        password: password(),
        nickname: nickname(),
        consents: consents(),
      }),
    );
  }

  @Public()
  @Throttle(STRICT)
  @Post('auth/login/phone')
  @HttpCode(200)
  @Bind(Body())
  loginPhone(body) {
    return this.auth.loginPhone(
      validateBody(body, { phone: phone(), password: string({ max: 200 }) }),
    );
  }

  @Public()
  @Throttle(STRICT)
  @Post('auth/login/social')
  @HttpCode(200)
  @Bind(Body())
  loginSocial(body) {
    return this.auth.loginSocial(
      validateBody(body, { provider: provider(), token: socialToken() }),
    );
  }

  @Public()
  @Throttle(STRICT)
  @Post('auth/signup/social')
  @Bind(Body())
  signupSocial(body) {
    return this.auth.signupSocial(
      validateBody(body, {
        provider: provider(),
        token: socialToken(),
        nickname: nickname(),
        consents: consents(),
      }),
    );
  }

  @Public()
  @Throttle(STRICT)
  @Post('auth/refresh')
  @HttpCode(200)
  @Bind(Body())
  refresh(body) {
    return this.auth.refresh(
      validateBody(body, { refreshToken: string({ max: 200 }) }),
    );
  }

  /**
   * 로그아웃
   * - 본문에 refreshToken이 있으면 그 세션을 폐기(모바일 A10, 토큰이 없거나 이미 폐기여도 204)
   * - 없으면 Authorization Bearer의 세션을 폐기
   */
  @Public()
  @Post('auth/logout')
  @HttpCode(204)
  @Bind(Req(), Body())
  async logout(request, body) {
    if (typeof body?.refreshToken === 'string') {
      await this.mobileAuth.logout(body.refreshToken);
      return;
    }
    const { ownerId, sessionId } = await this.tokens.verify(
      SessionKind.User,
      bearerToken(request),
    );
    await this.auth.logout(ownerId, sessionId);
  }

  @Post('auth/logout-all')
  @HttpCode(204)
  @Bind(Req())
  async logoutAll(request) {
    await this.auth.logoutAll(request.auth.userId);
  }

  @Public()
  @Throttle(STRICT)
  @Post('auth/password/reset')
  @HttpCode(204)
  @Bind(Body())
  async resetPassword(body) {
    await this.auth.resetPassword(
      validateBody(body, {
        phone: phone(),
        code: code(),
        newPassword: password(),
      }),
    );
  }

  @Throttle(STRICT)
  @Post('me/phone/codes')
  @HttpCode(204)
  @Bind(Req(), Body())
  async sendLinkCode(request, body) {
    const data = validateBody(body, { phone: phone() });
    await this.auth.sendCode(data.phone, 'link_phone', request.auth.userId);
  }

  @Post('me/phone')
  @HttpCode(204)
  @Bind(Req(), Body())
  async linkPhone(request, body) {
    await this.auth.linkPhone(
      request.auth.userId,
      validateBody(body, {
        phone: phone(),
        code: code(),
        password: password(),
      }),
    );
  }

  @Post('me/identities/:provider')
  @HttpCode(204)
  @Bind(Req(), Param('provider'), Body())
  async linkIdentity(request, providerName, body) {
    const data = validateBody(
      { ...body, provider: providerName },
      { provider: provider(), token: socialToken() },
    );
    await this.auth.linkIdentity(request.auth.userId, data);
  }
}
