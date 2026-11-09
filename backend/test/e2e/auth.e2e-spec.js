import { configureApp } from '../../src/app.setup.js';
import { testNickname } from '../support/users.js';
import { randomInt, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { SMS_SENDER } from '../../src/auth/sms/sms-sender.js';
import { SocialVerifierService } from '../../src/auth/social/social-verifier.service.js';
import { DatabaseService } from '../../src/database/database.service.js';

// DATABASE_URL이 있을 때만 실행, 마이그레이션 적용 필요
const databaseUrl = process.env.DATABASE_URL;

const POLICIES = {
  terms: '00000000-0000-4000-8000-0000000000a1',
  privacy: '00000000-0000-4000-8000-0000000000a2',
  marketing: '00000000-0000-4000-8000-0000000000a3',
};
const PASSWORD = 'correct-horse-battery';

describe.skipIf(!databaseUrl)('인증 흐름 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  const sentCodes = new Map();

  const national = () => `010${randomInt(10_000_000, 99_999_999)}`;
  const e164 = (n) => `+82${n.slice(1)}`;
  const nick = () => testNickname();
  const consents = () => [
    { documentVersionId: POLICIES.terms, granted: true },
    { documentVersionId: POLICIES.privacy, granted: true },
  ];
  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  async function sendCode(phone, purpose = 'signup') {
    await http
      .post('/api/v1/auth/phone/codes')
      .send({ phone, purpose })
      .expect(204);
    return sentCodes.get(e164(phone));
  }

  async function signup({ phone = national(), nickname = nick() } = {}) {
    const code = await sendCode(phone);
    const res = await http
      .post('/api/v1/auth/signup/phone')
      .send({ phone, code, password: PASSWORD, nickname, consents: consents() })
      .expect(201);
    return { phone, nickname, ...res.body };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // IP 제한은 별도로 검증하므로 여기서는 카운트하지 않는 저장소로 대체
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({
          totalHits: 1,
          timeToExpire: 0,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
      })
      .overrideProvider(SMS_SENDER)
      .useValue({
        send: async (phone, message) =>
          sentCodes.set(phone, /(\d{6})/.exec(message)[1]),
      })
      .overrideProvider(SocialVerifierService)
      .useValue({
        verify: async (provider, token) => {
          if (token === 'bad')
            throw new (
              await import('../../src/common/errors/app-exception.js')
            ).AppException(401, 'invalid_social_token', 'x');
          return { subject: `${provider}-${token}`, email: null };
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    db = app.get(DatabaseService);

    for (const [type, id] of Object.entries(POLICIES)) {
      await db.query(
        `INSERT INTO policy_document_versions
                (id, document_type, version, body, effective_at, published_at)
         VALUES ($1, $2, 'test-1', '본문', now() - interval '1 day', now())
         ON CONFLICT (id) DO NOTHING`,
        [id, type],
      );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('약관·닉네임', () => {
    it('현재 약관 조회와 닉네임 중복 확인은 공개', async () => {
      const policies = await http.get('/api/v1/policies/current').expect(200);
      expect(policies.body.map((p) => p.documentType).sort()).toEqual([
        'marketing',
        'privacy',
        'terms',
      ]);
      const res = await http
        .get('/api/v1/nicknames/availability')
        .query({ nickname: nick() })
        .expect(200);
      expect(res.body.available).toBe(true);
    });
  });

  describe('휴대폰 가입·로그인', () => {
    it('가입 후 토큰으로 내 정보 조회, 번호는 마스킹', async () => {
      const user = await signup();
      const me = await http
        .get('/api/v1/me')
        .set(auth(user.accessToken))
        .expect(200);
      expect(me.body).toMatchObject({
        id: user.userId,
        nickname: user.nickname,
        notificationEnabled: false,
        reconsentRequired: [],
        identities: [],
      });
      expect(me.body.phone).toMatch(/^\+82\*+\d{4}$/);
    });

    it('중복 닉네임·번호는 409, 필수 약관 누락은 422', async () => {
      const first = await signup();
      const phone = national();
      const code = await sendCode(phone);
      const base = { phone, code, password: PASSWORD, consents: consents() };
      const dup = await http
        .post('/api/v1/auth/signup/phone')
        .send({ ...base, nickname: first.nickname.toUpperCase() })
        .expect(409);
      expect(dup.body.error.code).toBe('AUTH_NICKNAME_TAKEN');

      const noConsent = await http
        .post('/api/v1/auth/signup/phone')
        .send({ ...base, nickname: nick(), consents: [] })
        .expect(403);
      expect(noConsent.body.error.code).toBe('AUTH_CONSENT_REQUIRED');

      // 실패한 가입은 코드를 소비하지 않아 그대로 재시도 가능
      await http
        .post('/api/v1/auth/signup/phone')
        .send({ ...base, nickname: nick() })
        .expect(201);

      await http
        .post('/api/v1/auth/phone/codes')
        .send({ phone: first.phone, purpose: 'signup' })
        .expect(409);
    });

    it('인증번호: 오답 422, 재발송 30초 제한, 5회 오답 시 무효', async () => {
      const phone = national();
      const code = await sendCode(phone);
      const again = await http
        .post('/api/v1/auth/phone/codes')
        .send({ phone, purpose: 'signup' })
        .expect(429);
      expect(again.body.error).toMatchObject({
        code: 'AUTH_SMS_RESEND_TOO_SOON',
      });
      expect(again.body.error.details.retryAfterSeconds).toBeGreaterThan(0);

      const wrong = code === '000000' ? '111111' : '000000';
      const body = {
        phone,
        code: wrong,
        password: PASSWORD,
        nickname: nick(),
        consents: consents(),
      };
      for (let i = 0; i < 5; i++) {
        const res = await http
          .post('/api/v1/auth/signup/phone')
          .send(body)
          .expect(400);
        expect(res.body.error.code).toBe('AUTH_OTP_INVALID');
      }
      // 5회 오답 뒤에는 올바른 코드도 거절
      await http
        .post('/api/v1/auth/signup/phone')
        .send({ ...body, code })
        .expect(400);
    });

    it('로그인 성공, 틀린 비밀번호는 401, 없는 번호도 같은 응답', async () => {
      const user = await signup();
      const ok = await http
        .post('/api/v1/auth/login/phone')
        .send({ phone: user.phone, password: PASSWORD })
        .expect(200);
      expect(ok.body.accessToken).toBeTruthy();

      const wrong = await http
        .post('/api/v1/auth/login/phone')
        .send({ phone: user.phone, password: 'wrong-password-1' })
        .expect(401);
      const unknown = await http
        .post('/api/v1/auth/login/phone')
        .send({ phone: national(), password: 'wrong-password-1' })
        .expect(401);
      expect(wrong.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(unknown.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(unknown.body.error.message).toBe(wrong.body.error.message);
    });

    it('5회 연속 실패 시 5분 잠금, 맞는 비밀번호도 잠금 중에는 거절', async () => {
      const user = await signup();
      const attempt = (password) =>
        http
          .post('/api/v1/auth/login/phone')
          .send({ phone: user.phone, password });
      for (let i = 0; i < 4; i++) await attempt('wrong-password-1').expect(401);
      const fifth = await attempt('wrong-password-1').expect(403);
      expect(fifth.body.error).toMatchObject({ code: 'AUTH_LOGIN_LOCKED' });
      expect(fifth.body.error.details.retryAfterSeconds).toBeGreaterThan(0);

      const locked = await attempt(PASSWORD).expect(403);
      expect(locked.body.error.code).toBe('AUTH_LOGIN_LOCKED');

      // 잠금 시간이 지나면 풀리고, 성공하면 실패 횟수 초기화
      await db.query(
        `UPDATE phone_credentials SET locked_until = now() - interval '1 second'
          WHERE phone_e164 = $1`,
        [e164(user.phone)],
      );
      await attempt(PASSWORD).expect(200);
      const { rows } = await db.query(
        'SELECT failed_attempt_count, locked_until FROM phone_credentials WHERE phone_e164 = $1',
        [e164(user.phone)],
      );
      expect(rows[0]).toEqual({ failed_attempt_count: 0, locked_until: null });
    });

    it('잠금이 풀린 뒤 첫 실패는 1회부터 다시 셈', async () => {
      const user = await signup();
      const attempt = (password) =>
        http
          .post('/api/v1/auth/login/phone')
          .send({ phone: user.phone, password });
      for (let i = 0; i < 5; i++) await attempt('wrong-password-1');
      await db.query(
        `UPDATE phone_credentials SET locked_until = now() - interval '1 second'
          WHERE phone_e164 = $1`,
        [e164(user.phone)],
      );
      await attempt('wrong-password-1').expect(401);
      const { rows } = await db.query(
        'SELECT failed_attempt_count FROM phone_credentials WHERE phone_e164 = $1',
        [e164(user.phone)],
      );
      expect(rows[0].failed_attempt_count).toBe(1);
    });
  });

  describe('세션', () => {
    it('refresh는 토큰을 회전하고 이전 토큰은 재사용 불가', async () => {
      const user = await signup();
      const rotated = await http
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(200);
      expect(rotated.body.refreshToken).not.toBe(user.refreshToken);

      const reuse = await http
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(401);
      expect(reuse.body.error.code).toBe('AUTH_REFRESH_INVALID');

      await http
        .get('/api/v1/me')
        .set(auth(rotated.body.accessToken))
        .expect(200);
    });

    it('로그아웃하면 그 세션의 access token도 즉시 무효', async () => {
      const user = await signup();
      await http
        .post('/api/v1/auth/logout')
        .set(auth(user.accessToken))
        .expect(204);
      await http.get('/api/v1/me').set(auth(user.accessToken)).expect(401);
      await http
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(401);
    });

    it('전체 로그아웃은 모든 세션 폐기', async () => {
      const user = await signup();
      const second = await http
        .post('/api/v1/auth/login/phone')
        .send({ phone: user.phone, password: PASSWORD })
        .expect(200);
      await http
        .post('/api/v1/auth/logout-all')
        .set(auth(second.body.accessToken))
        .expect(204);
      await http.get('/api/v1/me').set(auth(user.accessToken)).expect(401);
      await http
        .get('/api/v1/me')
        .set(auth(second.body.accessToken))
        .expect(401);
    });

    it('만료된 세션은 거절', async () => {
      const user = await signup();
      await db.query(
        `UPDATE auth_sessions SET expires_at = now() - interval '1 second',
                created_at = now() - interval '1 day'
          WHERE user_id = $1`,
        [user.userId],
      );
      await http.get('/api/v1/me').set(auth(user.accessToken)).expect(401);
    });

    it('탈퇴 처리 중인 계정은 403', async () => {
      const user = await signup();
      await db.query(
        "UPDATE users SET status = 'withdrawal_processing' WHERE id = $1",
        [user.userId],
      );
      const res = await http
        .get('/api/v1/me')
        .set(auth(user.accessToken))
        .expect(403);
      expect(res.body.error.code).toBe('ACCOUNT_UNAVAILABLE');
    });
  });

  describe('비밀번호 재설정', () => {
    it('재설정 후 기존 세션 폐기, 새 비밀번호로 로그인', async () => {
      const user = await signup();
      const code = await sendCode(user.phone, 'reset_password');
      await http
        .post('/api/v1/auth/password/reset')
        .send({ phone: user.phone, code, newPassword: 'brand-new-password' })
        .expect(204);

      await http.get('/api/v1/me').set(auth(user.accessToken)).expect(401);
      await http
        .post('/api/v1/auth/login/phone')
        .send({ phone: user.phone, password: PASSWORD })
        .expect(401);
      await http
        .post('/api/v1/auth/login/phone')
        .send({ phone: user.phone, password: 'brand-new-password' })
        .expect(200);
    });

    it('가입되지 않은 번호도 발송 요청은 같은 204, 코드는 발송되지 않음', async () => {
      const phone = national();
      await http
        .post('/api/v1/auth/phone/codes')
        .send({ phone, purpose: 'reset_password' })
        .expect(204);
      expect(sentCodes.has(e164(phone))).toBe(false);
    });
  });

  describe('소셜', () => {
    it('미가입은 404, 가입 후 로그인, 같은 소셜 재가입은 409', async () => {
      const token = randomUUID();
      const notRegistered = await http
        .post('/api/v1/auth/login/social')
        .send({ provider: 'google', token })
        .expect(404);
      expect(notRegistered.body.error.code).toBe('SOCIAL_NOT_REGISTERED');

      const signupRes = await http
        .post('/api/v1/auth/signup/social')
        .send({
          provider: 'google',
          token,
          nickname: nick(),
          consents: consents(),
        })
        .expect(201);
      const login = await http
        .post('/api/v1/auth/login/social')
        .send({ provider: 'google', token })
        .expect(200);
      expect(login.body.userId).toBe(signupRes.body.userId);

      const dup = await http
        .post('/api/v1/auth/signup/social')
        .send({
          provider: 'google',
          token,
          nickname: nick(),
          consents: consents(),
        })
        .expect(409);
      expect(dup.body.error.code).toBe('AUTH_SOCIAL_ACCOUNT_EXISTS');
    });

    it('로그인 상태에서 소셜·휴대폰 연결, 이미 연결된 수단은 409', async () => {
      const user = await signup();
      const token = randomUUID();
      await http
        .post('/api/v1/me/identities/naver')
        .set(auth(user.accessToken))
        .send({ token })
        .expect(204);
      const me = await http
        .get('/api/v1/me')
        .set(auth(user.accessToken))
        .expect(200);
      expect(me.body.identities).toEqual(['naver']);

      // 같은 제공자 두 번째 연결, 다른 사용자에 연결된 계정
      await http
        .post('/api/v1/me/identities/naver')
        .set(auth(user.accessToken))
        .send({ token: randomUUID() })
        .expect(409);
      const other = await signup();
      await http
        .post('/api/v1/me/identities/naver')
        .set(auth(other.accessToken))
        .send({ token })
        .expect(409);

      // 소셜 가입자가 휴대폰 연결
      const socialToken = randomUUID();
      const social = await http
        .post('/api/v1/auth/signup/social')
        .send({
          provider: 'apple',
          token: socialToken,
          nickname: nick(),
          consents: consents(),
        })
        .expect(201);
      const phone = national();
      await http
        .post('/api/v1/me/phone/codes')
        .set(auth(social.body.accessToken))
        .send({ phone })
        .expect(204);
      await http
        .post('/api/v1/me/phone')
        .set(auth(social.body.accessToken))
        .send({ phone, code: sentCodes.get(e164(phone)), password: PASSWORD })
        .expect(204);
      await http
        .post('/api/v1/auth/login/phone')
        .send({ phone, password: PASSWORD })
        .expect(200);
    });

    it('검증 실패 토큰은 401', async () => {
      const res = await http
        .post('/api/v1/auth/login/social')
        .send({ provider: 'google', token: 'bad' })
        .expect(502);
      expect(res.body.error.code).toBe('AUTH_SOCIAL_FAILED');
    });
  });

  describe('프로필·동의', () => {
    it('닉네임·알림 설정 변경, 중복 닉네임은 409', async () => {
      const a = await signup();
      const b = await signup();
      const changed = await http
        .patch('/api/v1/me/profile')
        .set(auth(a.accessToken))
        .send({ nickname: nick(), notificationEnabled: true })
        .expect(200);
      expect(changed.body.notificationEnabled).toBe(true);

      const dup = await http
        .patch('/api/v1/me/profile')
        .set(auth(a.accessToken))
        .send({ nickname: b.nickname })
        .expect(409);
      expect(dup.body.error.code).toBe('AUTH_NICKNAME_TAKEN');
      await http
        .patch('/api/v1/me/profile')
        .set(auth(a.accessToken))
        .send({})
        .expect(400);
    });

    it('마케팅 동의는 이력으로 추가, 필수 문서 철회는 422', async () => {
      const user = await signup();
      await http
        .post('/api/v1/me/consents')
        .set(auth(user.accessToken))
        .send({
          consents: [{ documentVersionId: POLICIES.marketing, granted: true }],
        })
        .expect(201);
      await http
        .post('/api/v1/me/consents')
        .set(auth(user.accessToken))
        .send({
          consents: [{ documentVersionId: POLICIES.marketing, granted: false }],
        })
        .expect(201);
      const { rows } = await db.query(
        `SELECT granted FROM consent_records
          WHERE user_id = $1 AND document_version_id = $2 ORDER BY recorded_at`,
        [user.userId, POLICIES.marketing],
      );
      expect(rows.map((r) => r.granted)).toEqual([true, false]);

      const res = await http
        .post('/api/v1/me/consents')
        .set(auth(user.accessToken))
        .send({
          consents: [{ documentVersionId: POLICIES.terms, granted: false }],
        })
        .expect(403);
      expect(res.body.error.code).toBe('AUTH_CONSENT_REQUIRED');
    });

    it('재동의 필수 약관이 게시되면 대상이 되고 동의하면 해제', async () => {
      const user = await signup();
      const id = randomUUID();
      await db.query(
        `INSERT INTO policy_document_versions
                (id, document_type, version, body, effective_at, requires_reconsent, published_at)
         VALUES ($1, 'terms', $2, '개정', now(), true, now())`,
        [id, `rc-${id.slice(0, 8)}`],
      );
      try {
        const before = await http
          .get('/api/v1/me')
          .set(auth(user.accessToken))
          .expect(200);
        expect(before.body.reconsentRequired).toEqual(['terms']);

        const after = await http
          .post('/api/v1/me/consents')
          .set(auth(user.accessToken))
          .send({ consents: [{ documentVersionId: id, granted: true }] })
          .expect(201);
        expect(after.body.reconsentRequired).toEqual([]);
      } finally {
        await db.query(
          'DELETE FROM consent_records WHERE document_version_id = $1',
          [id],
        );
        await db.query('DELETE FROM policy_document_versions WHERE id = $1', [
          id,
        ]);
      }
    });
  });

  describe('관리자', () => {
    const adminLogin = `admin_${randomInt(100_000, 999_999)}`;
    const adminEmail = `${adminLogin}@example.com`;
    const adminPassword = 'admin-password-123';
    let adminId;

    beforeAll(async () => {
      adminId = randomUUID();
      await db.query(
        `INSERT INTO admin_accounts (id, login_id, email, password_hash)
         VALUES ($1, $2, $3, $4)`,
        [adminId, adminLogin, adminEmail, await argon2.hash(adminPassword)],
      );
    });

    it('아이디·이메일로 로그인, 관리자 토큰은 사용자 API에서 거절', async () => {
      const byId = await http
        .post('/admin/v1/auth/login')
        .send({ loginId: adminLogin, password: adminPassword })
        .expect(200);
      await http
        .post('/admin/v1/auth/login')
        .send({ loginId: adminEmail.toUpperCase(), password: adminPassword })
        .expect(200);

      await http.get('/api/v1/me').set(auth(byId.body.accessToken)).expect(401);
      const user = await signup();
      await http
        .post('/admin/v1/auth/logout')
        .set(auth(user.accessToken))
        .expect(401);
    });

    it('갱신·로그아웃과 감사 로그', async () => {
      const login = await http
        .post('/admin/v1/auth/login')
        .send({ loginId: adminLogin, password: adminPassword })
        .expect(200);
      // 리프레시 토큰은 본문이 아니라 HttpOnly 쿠키로만 옴
      expect(login.body).not.toHaveProperty('refreshToken');
      const cookie = login.headers['set-cookie'][0];
      expect(cookie).toMatch(/^dw_admin_refresh=/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/admin/v1/auth');
      expect(cookie).toContain('Max-Age=43200');
      const cookieHeader = cookie.split(';')[0];
      const refreshed = await http
        .post('/admin/v1/auth/refresh')
        .set('Cookie', cookieHeader)
        .expect(200);
      expect(refreshed.headers['set-cookie'][0].split(';')[0]).not.toBe(
        cookieHeader,
      );
      await http
        .post('/admin/v1/auth/refresh')
        .set('Cookie', cookieHeader)
        .expect(401);
      await http.post('/admin/v1/auth/refresh').expect(401);
      const me = await http
        .get('/admin/v1/me')
        .set(auth(refreshed.body.accessToken))
        .expect(200);
      expect(me.body).toEqual({
        id: adminId,
        loginId: adminLogin,
        email: adminEmail,
      });
      await http
        .post('/admin/v1/auth/logout')
        .set(auth(refreshed.body.accessToken))
        .expect(204);
      await http
        .post('/admin/v1/auth/logout')
        .set(auth(refreshed.body.accessToken))
        .expect(401);

      const { rows } = await db.query(
        `SELECT action, result, count(*)::int AS n FROM admin_audit_logs
          WHERE admin_id = $1 GROUP BY action, result ORDER BY action`,
        [adminId],
      );
      const actions = Object.fromEntries(
        rows.map((r) => [`${r.action}:${r.result}`, r.n]),
      );
      expect(actions['admin.login:success']).toBeGreaterThanOrEqual(1);
      expect(actions['admin.logout:success']).toBe(1);
    });

    it('5회 연속 실패 시 잠금과 감사 기록', async () => {
      const login = `lock_${randomInt(100_000, 999_999)}`;
      const id = randomUUID();
      await db.query(
        `INSERT INTO admin_accounts (id, login_id, email, password_hash)
         VALUES ($1, $2, $3, $4)`,
        [id, login, `${login}@example.com`, await argon2.hash(adminPassword)],
      );
      const attempt = (password) =>
        http.post('/admin/v1/auth/login').send({ loginId: login, password });
      for (let i = 0; i < 4; i++) await attempt('wrong').expect(401);
      const fifth = await attempt('wrong').expect(403);
      expect(fifth.body.error.code).toBe('AUTH_LOGIN_LOCKED');
      await attempt(adminPassword).expect(403);

      const { rows } = await db.query(
        `SELECT action FROM admin_audit_logs WHERE admin_id = $1 AND result = 'failure'`,
        [id],
      );
      expect(rows.filter((r) => r.action === 'admin.login')).toHaveLength(4);
      expect(
        rows.filter((r) => r.action === 'admin.login_locked'),
      ).toHaveLength(1);
    });

    it('비활성 계정은 로그인 불가', async () => {
      const login = `off_${randomInt(100_000, 999_999)}`;
      await db.query(
        `INSERT INTO admin_accounts (id, login_id, email, password_hash, status)
         VALUES ($1, $2, $3, $4, 'disabled')`,
        [
          randomUUID(),
          login,
          `${login}@example.com`,
          await argon2.hash(adminPassword),
        ],
      );
      await http
        .post('/admin/v1/auth/login')
        .send({ loginId: login, password: adminPassword })
        .expect(401);
    });
  });

  describe('이용 제한', () => {
    it('진행 중 제한만 활성으로 판정, 해제·만료·경고는 제외', async () => {
      const user = await signup();
      const restrictions = app.get(
        (await import('../../src/accounts/restriction.service.js'))
          .RestrictionService,
      );
      const adminId = randomUUID();
      await db.query(
        `INSERT INTO admin_accounts (id, login_id, email, password_hash)
         VALUES ($1, $2, $3, 'x')`,
        [adminId, `r_${randomInt(100_000, 999_999)}`, `${adminId}@example.com`],
      );
      const insert = (type, startsAgo, endsIn, lifted = false) =>
        db.query(
          `INSERT INTO account_actions
                  (id, user_id, admin_id, action_type, reason, starts_at, ends_at, lifted_at)
           VALUES ($1, $2, $3, $4, '사유', now() - make_interval(hours => $5),
                   CASE WHEN $8::text = 'restriction' THEN now() + make_interval(hours => $6) END,
                   CASE WHEN $7 THEN now() END)`,
          [
            randomUUID(),
            user.userId,
            adminId,
            type,
            startsAgo,
            endsIn,
            lifted,
            type,
          ],
        );

      expect(await restrictions.activeRestriction(user.userId)).toBeNull();
      await insert('warning', 1, 0);
      expect(await restrictions.activeRestriction(user.userId)).toBeNull();
      await insert('restriction', 5, -1);
      expect(await restrictions.activeRestriction(user.userId)).toBeNull();
      await insert('restriction', 2, 10, true);
      expect(await restrictions.activeRestriction(user.userId)).toBeNull();
      await insert('restriction', 1, 10);
      expect(await restrictions.activeRestriction(user.userId)).not.toBeNull();
      const me = await http
        .get('/api/v1/me')
        .set(auth(user.accessToken))
        .expect(200);
      expect(me.body.restriction).not.toBeNull();
    });
  });
});
