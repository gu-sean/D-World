import { randomInt } from 'node:crypto';
import { SMS_SENDER } from '../../src/auth/sms/sms-sender.js';
import { createTestApp } from '../support/app.js';
import { testNickname } from '../support/users.js';

const databaseUrl = process.env.DATABASE_URL;
const PASSWORD = 'correct-horse-battery';

describe.skipIf(!databaseUrl)('모바일 계정 API A01~A10 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  const sent = new Map();
  const national = () => `010${randomInt(10_000_000, 99_999_999)}`;
  const e164 = (n) => `+82${n.slice(1)}`;

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    // 발송 대신 인증번호를 가로채 확인 단계에서 쓴다
    app.get(SMS_SENDER).send = async (phone, message) =>
      sent.set(phone, /(\d{6})/.exec(message)[1]);
    // 테스트 DB에는 약관이 없으므로 필수 두 문서와 선택 한 문서를 둔다
    // 기존 인증 e2e(auth.e2e-spec)와 같은 문서 행을 쓰고, 이미 있으면 그대로 둔다
    for (const [type, id] of [
      ['terms', '00000000-0000-4000-8000-0000000000a1'],
      ['privacy', '00000000-0000-4000-8000-0000000000a2'],
      ['marketing', '00000000-0000-4000-8000-0000000000a3'],
    ]) {
      await db.query(
        `INSERT INTO policy_document_versions
                (id, document_type, version, body, effective_at, published_at)
         VALUES ($1, $2, 'test-1', '본문', now() - interval '1 day', now())
         ON CONFLICT DO NOTHING`,
        [id, type],
      );
    }
  });

  afterAll(() => app?.close());

  async function consentsBody() {
    const { body } = await http
      .get('/api/v1/policy-documents/current')
      .expect(200);
    return body
      .filter((d) => d.isRequired)
      .map((d) => ({ documentVersionId: d.id, granted: true }));
  }

  async function verify(phoneNumber, purpose) {
    const started = await http
      .post('/api/v1/auth/phone-verifications')
      .send({ phoneNumber, purpose })
      .expect(201);
    expect(started.body.maskedPhoneNumber).toMatch(/^010-\*{4}-\d{4}$/);
    const confirmed = await http
      .post(
        `/api/v1/auth/phone-verifications/${started.body.verificationId}/confirm`,
      )
      .send({ code: sent.get(e164(phoneNumber)) })
      .expect(200);
    return confirmed.body;
  }

  // 요청 객체를 만든 뒤에 다른 요청을 기다리면 supertest 서버가 닫혀 버리므로 본문을 먼저 만든다
  function postSignup(body) {
    return http.post('/api/v1/auth/signup').send(body);
  }

  async function signupBody(verificationToken) {
    return {
      verificationToken,
      password: PASSWORD,
      nickname: testNickname(),
      consents: await consentsBody(),
    };
  }

  it('A04 약관 문서에 isRequired가 있음', async () => {
    const { body } = await http
      .get('/api/v1/policy-documents/current')
      .expect(200);
    expect(body[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        documentType: expect.any(String),
        isRequired: expect.any(Boolean),
        effectiveAt: expect.any(String),
      }),
    );
  });

  it('A01~A06 가입 → 로그인 → 갱신 → 로그아웃', async () => {
    const phoneNumber = national();
    const confirmed = await verify(phoneNumber, 'signup');
    expect(confirmed).toEqual(
      expect.objectContaining({ accountStatus: 'new', provider: null }),
    );

    const signup = await postSignup(
      await signupBody(confirmed.verificationToken),
    ).expect(201);
    expect(Object.keys(signup.body).sort()).toEqual(['profile', 'tokens']);
    expect(Object.keys(signup.body.tokens).sort()).toEqual([
      'accessToken',
      'expiresAt',
      'refreshToken',
    ]);

    // 같은 인증 토큰으로 다시 가입할 수 없음
    await postSignup(await signupBody(confirmed.verificationToken)).expect(
      (res) => expect(res.status).toBeGreaterThanOrEqual(400),
    );

    const login = await http
      .post('/api/v1/auth/login')
      .send({ phoneNumber, password: PASSWORD })
      .expect(200);
    await http
      .post('/api/v1/auth/login')
      .send({ phoneNumber, password: 'wrong-password-1' })
      .expect(401)
      .expect((res) =>
        expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS'),
      );

    const refreshed = await http
      .post('/api/v1/auth/token/refresh')
      .send({ refreshToken: login.body.tokens.refreshToken })
      .expect(200);
    expect(refreshed.body.profile.id).toBe(login.body.profile.id);
    // 이전 리프레시 토큰은 쓸 수 없음
    await http
      .post('/api/v1/auth/token/refresh')
      .send({ refreshToken: login.body.tokens.refreshToken })
      .expect(401);

    await http
      .post('/api/v1/auth/logout')
      .send({ refreshToken: refreshed.body.tokens.refreshToken })
      .expect(204);
    // 이미 폐기된 토큰이어도 204
    await http
      .post('/api/v1/auth/logout')
      .send({ refreshToken: refreshed.body.tokens.refreshToken })
      .expect(204);
  });

  it('A01 이미 가입한 번호는 409, A02 틀린 인증번호는 오류', async () => {
    const phoneNumber = national();
    const confirmed = await verify(phoneNumber, 'signup');
    await postSignup(await signupBody(confirmed.verificationToken)).expect(201);
    await http
      .post('/api/v1/auth/phone-verifications')
      .send({ phoneNumber, purpose: 'signup' })
      .expect(409);

    const other = national();
    const started = await http
      .post('/api/v1/auth/phone-verifications')
      .send({ phoneNumber: other, purpose: 'signup' })
      .expect(201);
    const wrong = sent.get(e164(other)) === '000000' ? '111111' : '000000';
    await http
      .post(
        `/api/v1/auth/phone-verifications/${started.body.verificationId}/confirm`,
      )
      .send({ code: wrong })
      .expect((res) => expect(res.status).toBeGreaterThanOrEqual(400));
  });

  it('A08 비밀번호 재설정 후 새 비밀번호로 로그인', async () => {
    const phoneNumber = national();
    const first = await verify(phoneNumber, 'signup');
    await postSignup(await signupBody(first.verificationToken)).expect(201);

    // 재설정 인증번호 재발송은 30초 대기가 있으므로 직접 기다리지 않고 DB 기록만 당겨 둔다
    await app
      .get(
        (await import('../../src/database/database.service.js'))
          .DatabaseService,
      )
      .query(
        `UPDATE phone_verification_challenges
            SET created_at = created_at - interval '1 minute'
          WHERE phone_e164 = $1`,
        [e164(phoneNumber)],
      );
    const confirmed = await verify(phoneNumber, 'reset_password');
    expect(confirmed.accountStatus).toBe('phone_registered');
    await http
      .post('/api/v1/auth/password-reset')
      .send({
        verificationToken: confirmed.verificationToken,
        newPassword: 'another-password-9',
      })
      .expect(204);
    await http
      .post('/api/v1/auth/login')
      .send({ phoneNumber, password: 'another-password-9' })
      .expect(200);
    await http
      .post('/api/v1/auth/login')
      .send({ phoneNumber, password: PASSWORD })
      .expect(401);
  });

  it('A07 새 소셜 계정은 SocialSignupRequired, 토큰으로 가입', async () => {
    const subject = `dev-google-${randomInt(1_000_000)}`;
    const login = await http
      .post('/api/v1/auth/social/google/login')
      .send({ credential: `mock:${subject}:dev@example.com` });
    if (login.status !== 200) return; // SOCIAL_DRIVER=mock가 아닌 환경
    expect(login.body.signupRequired).toBe(true);
    const consents = await consentsBody();
    const signup = await http
      .post('/api/v1/auth/signup')
      .send({
        socialSignupToken: login.body.socialSignupToken,
        nickname: testNickname(),
        consents,
      })
      .expect(201);
    const again = await http
      .post('/api/v1/auth/social/google/login')
      .send({ credential: `mock:${subject}:dev@example.com` })
      .expect(200);
    expect(again.body.profile.id).toBe(signup.body.profile.id);
  });
});
