import { newId } from '../ids.js';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service.js';
import { AppException } from '../errors/app-exception.js';
import { randomToken, sha256Hex } from '../crypto/crypto.js';
import { SessionKind } from './auth.constants.js';

// 사용자·관리자 세션은 구조가 같고 테이블만 다름
const TABLES = {
  [SessionKind.User]: {
    sessions: 'auth_sessions',
    ownerColumn: 'user_id',
    owners: 'users',
  },
  [SessionKind.Admin]: {
    sessions: 'admin_sessions',
    ownerColumn: 'admin_id',
    owners: 'admin_accounts',
  },
};

/** 관리자 세션(쿠키 Max-Age와 같은 값) */
export const ADMIN_REFRESH_TTL_SEC = 12 * 3600;

const invalidRefresh = () =>
  new AppException(
    HttpStatus.UNAUTHORIZED,
    'invalid_refresh_token',
    '다시 로그인해야 함',
  );

@Injectable()
@Dependencies(DatabaseService, ConfigService)
export class SessionsService {
  constructor(database, config) {
    this.database = database;
    this.config = config;
  }

  /** refresh 수명(초): 사용자는 REFRESH_TOKEN_TTL_DAYS, 관리자는 12시간 고정 (팀 문서 09 M01) */
  refreshTtlSec(kind) {
    return kind === SessionKind.Admin
      ? ADMIN_REFRESH_TTL_SEC
      : this.config.get('REFRESH_TOKEN_TTL_DAYS') * 86_400;
  }

  /** 세션 생성, refresh token 원문은 이 응답에서만 노출되고 해시만 저장 */
  async create(tx, kind, ownerId) {
    const { sessions, ownerColumn } = TABLES[kind];
    const sessionId = newId();
    const refreshToken = randomToken();
    const { rows } = await tx.query(
      `INSERT INTO ${sessions} (id, ${ownerColumn}, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(secs => $4))
       RETURNING expires_at`,
      [sessionId, ownerId, sha256Hex(refreshToken), this.refreshTtlSec(kind)],
    );
    return { sessionId, refreshToken, refreshExpiresAt: rows[0].expires_at };
  }

  /**
   * refresh token 회전: 행을 잠그고 같은 행의 해시를 교체
   * 이전 토큰은 더 이상 조회되지 않아 재사용 불가
   * assertOwner(tx, ownerId)로 계정 상태를 같은 트랜잭션에서 확인
   */
  rotate(kind, refreshToken, assertOwner) {
    const { sessions, ownerColumn } = TABLES[kind];
    return this.database.withTransaction(async (tx) => {
      const { rows } = await tx.query(
        `SELECT id, ${ownerColumn} AS owner_id, expires_at > now() AS alive, revoked_at
           FROM ${sessions}
          WHERE refresh_token_hash = $1
            FOR UPDATE`,
        [sha256Hex(refreshToken)],
      );
      const session = rows[0];
      if (!session || session.revoked_at || !session.alive) {
        throw invalidRefresh();
      }
      await assertOwner?.(tx, session.owner_id);

      const next = randomToken();
      const updated = await tx.query(
        `UPDATE ${sessions}
            SET refresh_token_hash = $2,
                expires_at = now() + make_interval(secs => $3)
          WHERE id = $1
          RETURNING expires_at`,
        [session.id, sha256Hex(next), this.refreshTtlSec(kind)],
      );
      return {
        sessionId: session.id,
        ownerId: session.owner_id,
        refreshToken: next,
        refreshExpiresAt: updated.rows[0].expires_at,
      };
    });
  }

  /** 요청마다 호출: 폐기·만료 확인과 계정 상태 조회 */
  async findActive(kind, sessionId, ownerId) {
    const { sessions, ownerColumn, owners } = TABLES[kind];
    const { rows } = await this.database.query(
      `SELECT o.status
         FROM ${sessions} s
         JOIN ${owners} o ON o.id = s.${ownerColumn}
        WHERE s.id = $1
          AND s.${ownerColumn} = $2
          AND s.revoked_at IS NULL
          AND s.expires_at > now()`,
      [sessionId, ownerId],
    );
    return rows[0] ?? null;
  }

  async revoke(db, kind, sessionId, ownerId) {
    const { sessions, ownerColumn } = TABLES[kind];
    await db.query(
      `UPDATE ${sessions} SET revoked_at = now()
        WHERE id = $1 AND ${ownerColumn} = $2 AND revoked_at IS NULL`,
      [sessionId, ownerId],
    );
  }

  /** refresh token으로 세션 폐기, 없거나 이미 폐기여도 조용히 끝남(로그아웃은 항상 성공) */
  async revokeByRefreshToken(db, kind, refreshToken) {
    const { sessions } = TABLES[kind];
    await db.query(
      `UPDATE ${sessions} SET revoked_at = now()
        WHERE refresh_token_hash = $1 AND revoked_at IS NULL`,
      [sha256Hex(refreshToken)],
    );
  }

  /** 비밀번호 재설정·탈퇴 처리 시작 시 호출, 남은 access token도 세션 확인에서 막힘 */
  async revokeAll(db, kind, ownerId) {
    const { sessions, ownerColumn } = TABLES[kind];
    await db.query(
      `UPDATE ${sessions} SET revoked_at = now()
        WHERE ${ownerColumn} = $1 AND revoked_at IS NULL`,
      [ownerId],
    );
  }
}
