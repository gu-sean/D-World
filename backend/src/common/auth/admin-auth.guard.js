import {
  applyDecorators,
  Dependencies,
  HttpStatus,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../errors/app-exception.js';
import { AccessTokenService } from './access-token.service.js';
import { ADMIN_ONLY, IS_PUBLIC, SessionKind } from './auth.constants.js';
import { SessionsService } from './sessions.service.js';
import { bearerToken } from './user-auth.guard.js';

@Injectable()
@Dependencies(Reflector, AccessTokenService, SessionsService)
export class AdminAuthGuard {
  constructor(reflector, tokens, sessions) {
    this.reflector = reflector;
    this.tokens = tokens;
    this.sessions = sessions;
  }

  async canActivate(context) {
    if (context.getType() !== 'http') return true;
    // 로그인·갱신 같은 공개 경로는 같은 컨트롤러 안에서 제외
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest();
    const { ownerId, sessionId } = await this.tokens.verify(
      SessionKind.Admin,
      bearerToken(request),
    );
    const session = await this.sessions.findActive(
      SessionKind.Admin,
      sessionId,
      ownerId,
    );
    if (!session || session.status !== 'active') {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'unauthorized',
        '인증 필요',
      );
    }
    request.auth = { kind: SessionKind.Admin, adminId: ownerId, sessionId };
    return true;
  }
}

/** 관리자 전용: 관리자 토큰·세션을 검사하고 사용자 전역 guard는 건너뜀 */
export const AdminOnly = () =>
  applyDecorators(SetMetadata(ADMIN_ONLY, true), UseGuards(AdminAuthGuard));
