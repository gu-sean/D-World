import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PasswordService } from '../crypto/password.service.js';
import { AccessTokenService } from './access-token.service.js';
import { SessionsService } from './sessions.service.js';
import { UserAuthGuard } from './user-auth.guard.js';

/** 토큰·세션·비밀번호 해시 공통, 전역 기본 인증 guard 등록 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [
    PasswordService,
    AccessTokenService,
    SessionsService,
    { provide: APP_GUARD, useClass: UserAuthGuard },
  ],
  exports: [PasswordService, AccessTokenService, SessionsService],
})
export class AuthCoreModule {}
