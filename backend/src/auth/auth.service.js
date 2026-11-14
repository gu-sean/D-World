import { newId } from '../common/ids.js';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { nicknameTaken } from '../accounts/accounts.service.js';
import { ConsentService } from '../accounts/consent.service.js';
import { AccessTokenService } from '../common/auth/access-token.service.js';
import { SessionKind } from '../common/auth/auth.constants.js';
import { SessionsService } from '../common/auth/sessions.service.js';
import { PasswordService } from '../common/crypto/password.service.js';
import { AppException } from '../common/errors/app-exception.js';
import { rethrowConstraint } from '../common/errors/constraint.js';
import { DatabaseService } from '../database/database.service.js';
import { PhoneVerificationService } from './phone-verification.service.js';
import { SocialVerifierService } from './social/social-verifier.service.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 5;

const conflict = (code, message) => () =>
  new AppException(HttpStatus.CONFLICT, code, message);

const phoneTaken = conflict('phone_taken', '이미 가입된 휴대폰 번호');
const phoneAlreadyLinked = conflict(
  'phone_already_linked',
  '이미 휴대폰이 연결된 계정',
);
const identityTaken = conflict(
  'identity_already_linked',
  '이미 다른 계정에 연결된 소셜 계정',
);
const providerAlreadyLinked = conflict(
  'identity_already_linked',
  '이미 같은 제공자의 소셜 계정이 연결됨',
);

const invalidCredentials = () =>
  new AppException(
    HttpStatus.UNAUTHORIZED,
    'invalid_credentials',
    '번호 또는 비밀번호가 올바르지 않음',
  );

const accountLocked = (retryAfter) =>
  new AppException(
    HttpStatus.TOO_MANY_REQUESTS,
    'account_locked',
    '로그인 시도가 너무 많음',
    { retryAfter },
  );

const accountUnavailable = () =>
  new AppException(
    HttpStatus.FORBIDDEN,
    'account_unavailable',
    '이용할 수 없는 계정',
  );

@Injectable()
@Dependencies(
  DatabaseService,
  PasswordService,
  AccessTokenService,
  SessionsService,
  PhoneVerificationService,
  ConsentService,
  SocialVerifierService,
)
export class AuthService {
  constructor(
    database,
    passwords,
    tokens,
    sessions,
    phoneVerification,
    consents,
    socialVerifier,
  ) {
    this.database = database;
    this.passwords = passwords;
    this.tokens = tokens;
    this.sessions = sessions;
    this.phoneVerification = phoneVerification;
    this.consents = consents;
    this.socialVerifier = socialVerifier;
  }

  async tokenResponse(userId, session) {
    return {
      tokenType: 'Bearer',
      accessToken: await this.tokens.issue(
        SessionKind.User,
        userId,
        session.sessionId,
      ),
      expiresIn: this.tokens.ttlFor(SessionKind.User),
      refreshToken: session.refreshToken,
      refreshExpiresAt: session.refreshExpiresAt,
    };
  }

  async phoneExists(phone) {
    const { rowCount } = await this.database.query(
      'SELECT 1 FROM phone_credentials WHERE phone_e164 = $1',
      [phone],
    );
    return rowCount > 0;
  }

  /**
   * 인증번호 발송
   * 비밀번호 재설정은 가입 여부가 드러나지 않도록 없는 번호도 같은 응답을 주고 발송만 생략
   */
  async sendCode(phone, purpose, userId) {
    const exists = await this.phoneExists(phone);
    if (purpose === 'reset_password') {
      if (exists) await this.phoneVerification.send(phone, purpose);
      return;
    }
    if (exists) throw phoneTaken();
    if (purpose === 'link_phone') {
      const { rowCount } = await this.database.query(
        'SELECT 1 FROM phone_credentials WHERE user_id = $1',
        [userId],
      );
      if (rowCount > 0) throw phoneAlreadyLinked();
    }
    await this.phoneVerification.send(phone, purpose);
  }

  async createUser(tx, { nickname }) {
    const userId = newId();
    await tx.query('INSERT INTO users (id) VALUES ($1)', [userId]);
    await tx.query('INSERT INTO profiles (user_id, nickname) VALUES ($1, $2)', [
      userId,
      nickname,
    ]);
    return userId;
  }

  async signupPhone({ phone, code, password, nickname, consents }) {
    // 코드 오답 횟수를 낭비하지 않도록 약관 검사를 먼저 수행
    const current = await this.consents.currentVersions();
    this.consents.assertSignupConsents(current, consents);
    const challengeId = await this.phoneVerification.check(
      phone,
      'signup',
      code,
    );
    return this.completePhoneSignup({
      phone,
      challengeId,
      password,
      nickname,
      consents,
      current,
    });
  }

  /** 확인이 끝난 인증번호(challenge)로 휴대폰 가입을 마무리 */
  async completePhoneSignup({
    phone,
    challengeId,
    password,
    nickname,
    consents,
    current: given,
  }) {
    const current = given ?? (await this.consents.currentVersions());
    if (!given) this.consents.assertSignupConsents(current, consents);
    const passwordHash = await this.passwords.hash(password);

    try {
      const { userId, session } = await this.database.withTransaction(
        async (tx) => {
          await this.phoneVerification.consume(tx, challengeId);
          const id = await this.createUser(tx, { nickname });
          await tx.query(
            `INSERT INTO phone_credentials
                    (user_id, phone_e164, password_hash, verified_at, password_changed_at)
             VALUES ($1, $2, $3, now(), now())`,
            [id, phone, passwordHash],
          );
          await this.consents.record(tx, id, consents, current);
          return {
            userId: id,
            session: await this.sessions.create(tx, SessionKind.User, id),
          };
        },
      );
      return { userId, ...(await this.tokenResponse(userId, session)) };
    } catch (error) {
      rethrowConstraint(error, {
        profiles_nickname_ci_uq: nicknameTaken,
        phone_credentials_phone_e164_key: phoneTaken,
      });
    }
  }

  /**
   * 번호·비밀번호 로그인
   * 같은 계정 5회 연속 실패 시 5분 잠금, 실패 횟수는 오류를 던지기 전에 커밋
   */
  async loginPhone({ phone, password }) {
    const outcome = await this.database.withTransaction(async (tx) => {
      const { rows } = await tx.query(
        `SELECT pc.user_id, pc.password_hash, pc.failed_attempt_count,
                pc.locked_until IS NOT NULL AND pc.locked_until > now() AS locked,
                GREATEST(CEIL(EXTRACT(EPOCH FROM (pc.locked_until - now()))), 1) AS lock_seconds,
                u.status
           FROM phone_credentials pc
           JOIN users u ON u.id = pc.user_id
          WHERE pc.phone_e164 = $1
            FOR UPDATE OF pc`,
        [phone],
      );
      const account = rows[0];
      if (!account) return { kind: 'unknown' };
      if (account.locked) {
        return { kind: 'locked', retryAfter: Number(account.lock_seconds) };
      }

      const matches = await this.passwords.verify(
        account.password_hash,
        password,
      );
      if (!matches) {
        // 잠금이 풀린 뒤의 첫 실패는 1회부터 다시 셈
        const base =
          account.failed_attempt_count >= MAX_FAILED_ATTEMPTS
            ? 0
            : account.failed_attempt_count;
        const failures = base + 1;
        const lock = failures >= MAX_FAILED_ATTEMPTS;
        await tx.query(
          `UPDATE phone_credentials
              SET failed_attempt_count = $2,
                  locked_until = CASE WHEN $3 THEN now() + make_interval(mins => $4) END
            WHERE user_id = $1`,
          [account.user_id, failures, lock, LOCK_MINUTES],
        );
        return lock
          ? { kind: 'locked', retryAfter: LOCK_MINUTES * 60 }
          : { kind: 'wrong' };
      }

      await tx.query(
        `UPDATE phone_credentials
            SET failed_attempt_count = 0, locked_until = NULL
          WHERE user_id = $1`,
        [account.user_id],
      );
      if (account.status !== 'active') return { kind: 'unavailable' };
      return {
        kind: 'ok',
        userId: account.user_id,
        session: await this.sessions.create(
          tx,
          SessionKind.User,
          account.user_id,
        ),
      };
    });

    switch (outcome.kind) {
      case 'ok':
        return {
          userId: outcome.userId,
          ...(await this.tokenResponse(outcome.userId, outcome.session)),
        };
      case 'locked':
        throw accountLocked(outcome.retryAfter);
      case 'unavailable':
        throw accountUnavailable();
      case 'unknown':
        await this.passwords.verifyOrDummy(null, password);
        throw invalidCredentials();
      default:
        throw invalidCredentials();
    }
  }

  async loginSocial({ provider, token }) {
    const identity = await this.socialVerifier.verify(provider, token);
    const result = await this.loginWithIdentity(provider, identity);
    if (!result) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'social_not_registered',
        '가입되지 않은 소셜 계정',
      );
    }
    return result;
  }

  /** 검증된 소셜 신원으로 로그인, 가입되지 않았으면 null */
  async loginWithIdentity(provider, { subject }) {
    const { rows } = await this.database.query(
      `SELECT i.user_id, u.status
         FROM user_identities i
         JOIN users u ON u.id = i.user_id
        WHERE i.provider = $1 AND i.provider_subject = $2`,
      [provider, subject],
    );
    const identity = rows[0];
    if (!identity) return null;
    if (identity.status !== 'active') throw accountUnavailable();

    const session = await this.database.withTransaction((tx) =>
      this.sessions.create(tx, SessionKind.User, identity.user_id),
    );
    return {
      userId: identity.user_id,
      ...(await this.tokenResponse(identity.user_id, session)),
    };
  }

  async signupSocial({ provider, token, nickname, consents }) {
    const identity = await this.socialVerifier.verify(provider, token);
    return this.completeSocialSignup({
      provider,
      identity,
      nickname,
      consents,
    });
  }

  /** 검증된 소셜 신원으로 가입 */
  async completeSocialSignup({ provider, identity, nickname, consents }) {
    const current = await this.consents.currentVersions();
    this.consents.assertSignupConsents(current, consents);

    try {
      const { userId, session } = await this.database.withTransaction(
        async (tx) => {
          const id = await this.createUser(tx, { nickname });
          await tx.query(
            `INSERT INTO user_identities (id, user_id, provider, provider_subject, email)
             VALUES ($1, $2, $3, $4, $5)`,
            [newId(), id, provider, identity.subject, identity.email],
          );
          await this.consents.record(tx, id, consents, current);
          return {
            userId: id,
            session: await this.sessions.create(tx, SessionKind.User, id),
          };
        },
      );
      return { userId, ...(await this.tokenResponse(userId, session)) };
    } catch (error) {
      rethrowConstraint(error, {
        profiles_nickname_ci_uq: nicknameTaken,
        user_identities_provider_provider_subject_key: identityTaken,
      });
    }
  }

  async refresh({ refreshToken }) {
    const rotated = await this.sessions.rotate(
      SessionKind.User,
      refreshToken,
      async (tx, userId) => {
        const { rows } = await tx.query(
          'SELECT status FROM users WHERE id = $1',
          [userId],
        );
        if (rows[0]?.status !== 'active') throw accountUnavailable();
      },
    );
    return {
      userId: rotated.ownerId,
      ...(await this.tokenResponse(rotated.ownerId, rotated)),
    };
  }

  logout(userId, sessionId) {
    return this.sessions.revoke(
      this.database,
      SessionKind.User,
      sessionId,
      userId,
    );
  }

  logoutAll(userId) {
    return this.sessions.revokeAll(this.database, SessionKind.User, userId);
  }

  /** 비밀번호 재설정: 코드 검증 후 비밀번호를 바꾸고 기존 세션을 모두 폐기 */
  async resetPassword({ phone, code, newPassword }) {
    const challengeId = await this.phoneVerification.check(
      phone,
      'reset_password',
      code,
    );
    await this.completePasswordReset({ phone, challengeId, newPassword });
  }

  /** 확인이 끝난 인증번호(challenge)로 비밀번호를 바꾸고 기존 세션을 폐기 */
  async completePasswordReset({ phone, challengeId, newPassword }) {
    const passwordHash = await this.passwords.hash(newPassword);

    await this.database.withTransaction(async (tx) => {
      await this.phoneVerification.consume(tx, challengeId);
      const { rows } = await tx.query(
        `UPDATE phone_credentials
            SET password_hash = $2,
                password_changed_at = now(),
                failed_attempt_count = 0,
                locked_until = NULL
          WHERE phone_e164 = $1
          RETURNING user_id`,
        [phone, passwordHash],
      );
      if (!rows[0]) {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'code_invalid',
          '인증번호가 올바르지 않음',
        );
      }
      await this.sessions.revokeAll(tx, SessionKind.User, rows[0].user_id);
    });
  }

  /** 소셜 가입 사용자가 로그인 후 휴대폰 수단을 연결 */
  async linkPhone(userId, { phone, code, password }) {
    const challengeId = await this.phoneVerification.check(
      phone,
      'link_phone',
      code,
    );
    const passwordHash = await this.passwords.hash(password);
    try {
      await this.database.withTransaction(async (tx) => {
        await this.phoneVerification.consume(tx, challengeId);
        await tx.query(
          `INSERT INTO phone_credentials
                  (user_id, phone_e164, password_hash, verified_at, password_changed_at)
           VALUES ($1, $2, $3, now(), now())`,
          [userId, phone, passwordHash],
        );
      });
    } catch (error) {
      rethrowConstraint(error, {
        phone_credentials_pkey: phoneAlreadyLinked,
        phone_credentials_phone_e164_key: phoneTaken,
      });
    }
  }

  async linkIdentity(userId, { provider, token }) {
    const identity = await this.socialVerifier.verify(provider, token);
    try {
      await this.database.query(
        `INSERT INTO user_identities (id, user_id, provider, provider_subject, email)
         VALUES ($1, $2, $3, $4, $5)`,
        [newId(), userId, provider, identity.subject, identity.email],
      );
    } catch (error) {
      rethrowConstraint(error, {
        user_identities_provider_provider_subject_key: identityTaken,
        user_identities_user_id_provider_key: providerAlreadyLinked,
      });
    }
  }
}
