import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AccessTokenService } from '../common/auth/access-token.service.js';
import { SessionKind } from '../common/auth/auth.constants.js';
import { SessionsService } from '../common/auth/sessions.service.js';
import { PasswordService } from '../common/crypto/password.service.js';
import { AppException } from '../common/errors/app-exception.js';
import { DatabaseService } from '../database/database.service.js';
import { AuditService } from './audit.service.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 5;

const invalidCredentials = () =>
  new AppException(
    HttpStatus.UNAUTHORIZED,
    'invalid_credentials',
    '아이디 또는 비밀번호가 올바르지 않음',
  );

@Injectable()
@Dependencies(
  DatabaseService,
  PasswordService,
  AccessTokenService,
  SessionsService,
  AuditService,
)
export class AdminAuthService {
  constructor(database, passwords, tokens, sessions, audit) {
    this.database = database;
    this.passwords = passwords;
    this.tokens = tokens;
    this.sessions = sessions;
    this.audit = audit;
  }

  async tokenResponse(adminId, session) {
    return {
      tokenType: 'Bearer',
      accessToken: await this.tokens.issue(
        SessionKind.Admin,
        adminId,
        session.sessionId,
      ),
      expiresIn: this.tokens.ttlFor(SessionKind.Admin),
      refreshToken: session.refreshToken,
      refreshExpiresAt: session.refreshExpiresAt,
    };
  }

  /**
   * 관리자 아이디 또는 이메일 + 비밀번호, 사용자 로그인과 같은 5회·5분 잠금
   * 로그인 결과는 감사 로그에 남김(존재하지 않는 계정은 admin_id가 없어 기록 불가)
   */
  async login({ loginId, password }) {
    const key = loginId.trim().toLowerCase();
    const outcome = await this.database.withTransaction(async (tx) => {
      const { rows } = await tx.query(
        `SELECT id, password_hash, status, failed_attempt_count,
                locked_until IS NOT NULL AND locked_until > now() AS locked,
                GREATEST(CEIL(EXTRACT(EPOCH FROM (locked_until - now()))), 1) AS lock_seconds
           FROM admin_accounts
          WHERE lower(login_id) = $1 OR email = $1
            FOR UPDATE`,
        [key],
      );
      const admin = rows[0];
      if (!admin) return { kind: 'unknown' };
      if (admin.locked) {
        return { kind: 'locked', retryAfter: Number(admin.lock_seconds) };
      }

      const matches = await this.passwords.verify(
        admin.password_hash,
        password,
      );
      if (!matches || admin.status !== 'active') {
        const base =
          admin.failed_attempt_count >= MAX_FAILED_ATTEMPTS
            ? 0
            : admin.failed_attempt_count;
        const failures = base + 1;
        const lock = failures >= MAX_FAILED_ATTEMPTS;
        await tx.query(
          `UPDATE admin_accounts
              SET failed_attempt_count = $2,
                  locked_until = CASE WHEN $3 THEN now() + make_interval(mins => $4) END,
                  updated_at = now()
            WHERE id = $1`,
          [admin.id, failures, lock, LOCK_MINUTES],
        );
        await this.audit.record(tx, {
          adminId: admin.id,
          action: lock ? 'admin.login_locked' : 'admin.login',
          result: 'failure',
        });
        return lock
          ? { kind: 'locked', retryAfter: LOCK_MINUTES * 60 }
          : { kind: 'wrong' };
      }

      await tx.query(
        `UPDATE admin_accounts
            SET failed_attempt_count = 0, locked_until = NULL, updated_at = now()
          WHERE id = $1`,
        [admin.id],
      );
      await this.audit.record(tx, {
        adminId: admin.id,
        action: 'admin.login',
        result: 'success',
      });
      return {
        kind: 'ok',
        adminId: admin.id,
        session: await this.sessions.create(tx, SessionKind.Admin, admin.id),
      };
    });

    if (outcome.kind === 'ok') {
      return this.tokenResponse(outcome.adminId, outcome.session);
    }
    if (outcome.kind === 'locked') {
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        'account_locked',
        '로그인 시도가 너무 많음',
        { retryAfter: outcome.retryAfter },
      );
    }
    if (outcome.kind === 'unknown') {
      await this.passwords.verifyOrDummy(null, password);
    }
    throw invalidCredentials();
  }

  async refresh({ refreshToken }) {
    const rotated = await this.sessions.rotate(
      SessionKind.Admin,
      refreshToken,
      async (tx, adminId) => {
        const { rows } = await tx.query(
          'SELECT status FROM admin_accounts WHERE id = $1',
          [adminId],
        );
        if (rows[0]?.status !== 'active') {
          throw new AppException(
            HttpStatus.UNAUTHORIZED,
            'invalid_refresh_token',
            '다시 로그인해야 함',
          );
        }
      },
    );
    return this.tokenResponse(rotated.ownerId, rotated);
  }

  async me(adminId) {
    const { rows } = await this.database.query(
      'SELECT id, login_id, email FROM admin_accounts WHERE id = $1',
      [adminId],
    );
    return {
      id: rows[0].id,
      loginId: rows[0].login_id,
      email: rows[0].email,
    };
  }

  async logout(adminId, sessionId) {
    await this.database.withTransaction(async (tx) => {
      await this.sessions.revoke(tx, SessionKind.Admin, sessionId, adminId);
      await this.audit.record(tx, {
        adminId,
        action: 'admin.logout',
        result: 'success',
      });
    });
  }
}
