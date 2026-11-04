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
import { SOCIAL_PROVIDERS } from './social/social-verifier.service.js';

// 계정 열거·무차별 대입 방지용 IP 제한(번호·계정 단위 제한은 서비스가 DB로 처리)
const STRICT = { default: { limit: 10, ttl: 60_000 } };

const code = () => string({ min: 6, max: 6, pattern: /^\d{6}$/ });
const provider = () => oneOf(SOCIAL_PROVIDERS);
const socialToken = () => string({ min: 1, max: 4096 });
const consents = () =>
  array(object({ documentVersionId: uuid(), granted: boolean() }), { max: 10 });

@Controller()
@Dependencies(AuthService)
export class AuthController {
  constructor(auth) {
    this.auth = auth;
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

  @Post('auth/logout')
  @HttpCode(204)
  @Bind(Req())
  async logout(req) {
    await this.auth.logout(req.auth.userId, req.auth.sessionId);
  }

  @Post('auth/logout-all')
  @HttpCode(204)
  @Bind(Req())
  async logoutAll(req) {
    await this.auth.logoutAll(req.auth.userId);
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
  async sendLinkCode(req, body) {
    const data = validateBody(body, { phone: phone() });
    await this.auth.sendCode(data.phone, 'link_phone', req.auth.userId);
  }

  @Post('me/phone')
  @HttpCode(204)
  @Bind(Req(), Body())
  async linkPhone(req, body) {
    await this.auth.linkPhone(
      req.auth.userId,
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
  async linkIdentity(req, providerName, body) {
    const data = validateBody(
      { ...body, provider: providerName },
      { provider: provider(), token: socialToken() },
    );
    await this.auth.linkIdentity(req.auth.userId, data);
  }
}
