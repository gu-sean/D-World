import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../errors/app-exception.js';
import { AccessTokenService } from './access-token.service.js';
import { ADMIN_ONLY, IS_PUBLIC, SessionKind } from './auth.constants.js';
import { SessionsService } from './sessions.service.js';

export function bearerToken(request) {
  const header = request.headers?.authorization;
  const match = typeof header === 'string' && /^Bearer (\S+)$/.exec(header);
  if (!match) {
    throw new AppException(
      HttpStatus.UNAUTHORIZED,
      'unauthorized',
      '인증 필요',
    );
  }
  return match[1];
}

/**
 * 전역 기본 guard: @Public()이 아니면 사용자 인증 필요
 * 관리자 전용 경로(@AdminOnly)는 AdminAuthGuard가 맡으므로 건너뜀
 */
@Injectable()
@Dependencies(Reflector, AccessTokenService, SessionsService)
export class UserAuthGuard {
  constructor(reflector, tokens, sessions) {
    this.reflector = reflector;
    this.tokens = tokens;
    this.sessions = sessions;
  }

  async canActivate(context) {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (
      this.reflector.getAllAndOverride(IS_PUBLIC, targets) ||
      this.reflector.getAllAndOverride(ADMIN_ONLY, targets)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { ownerId, sessionId } = await this.tokens.verify(
      SessionKind.User,
      bearerToken(request),
    );
    const session = await this.sessions.findActive(
      SessionKind.User,
      sessionId,
      ownerId,
    );
    if (!session) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'unauthorized',
        '인증 필요',
      );
    }
    // 탈퇴 처리가 시작된 계정은 새 활동 불가
    if (session.status !== 'active') {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'account_unavailable',
        '이용할 수 없는 계정',
      );
    }
    request.auth = { kind: SessionKind.User, userId: ownerId, sessionId };
    return true;
  }
}
