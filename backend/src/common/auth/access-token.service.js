import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '../errors/app-exception.js';
import { SessionKind } from './auth.constants.js';

const ALGORITHM = 'HS256';

@Injectable()
@Dependencies(JwtService, ConfigService)
export class AccessTokenService {
  constructor(jwt, config) {
    this.jwt = jwt;
    this.config = config;
  }

  secretFor(kind) {
    return this.config.get(
      kind === SessionKind.Admin ? 'ADMIN_JWT_SECRET' : 'JWT_ACCESS_SECRET',
    );
  }

  /** 사용자·관리자는 키와 typ 클레임이 모두 달라 서로의 API에 쓸 수 없음 */
  issue(kind, ownerId, sessionId) {
    return this.jwt.signAsync(
      { sub: ownerId, sid: sessionId, typ: kind },
      {
        secret: this.secretFor(kind),
        algorithm: ALGORITHM,
        expiresIn: this.ttlFor(kind),
      },
    );
  }

  async verify(kind, token) {
    let payload;
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.secretFor(kind),
        algorithms: [ALGORITHM],
      });
    } catch (error) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        error?.name === 'TokenExpiredError' ? 'token_expired' : 'unauthorized',
        '인증 필요',
      );
    }
    if (payload.typ !== kind || !payload.sub || !payload.sid) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'unauthorized',
        '인증 필요',
      );
    }
    return { ownerId: payload.sub, sessionId: payload.sid };
  }

  /** 앱 30분, 관리자 15분 (팀 문서 05 §4) */
  ttlFor(kind) {
    return this.config.get(
      kind === SessionKind.Admin
        ? 'ADMIN_ACCESS_TOKEN_TTL_SEC'
        : 'ACCESS_TOKEN_TTL_SEC',
    );
  }
}
