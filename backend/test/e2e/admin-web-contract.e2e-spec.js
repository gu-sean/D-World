import { randomInt, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { createTestApp } from '../support/app.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';

// 관리자 웹(admin-web)이 화면에서 읽는 응답 필드 계약
// 웹이 기대하는 필드를 백엔드가 내려주는지만 본다 (값 검증은 각 기능의 e2e)
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)('관리자 웹 응답 계약 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let adminToken;
  let userId;
  let ticketId;

  const get = (path) =>
    http.get(`/admin/v1${path}`).set({ Authorization: `Bearer ${adminToken}` });
  const keysOf = (item) => Object.keys(item).sort();
  const expectKeys = (item, keys) =>
    expect(keysOf(item)).toEqual(expect.arrayContaining(keys));

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    const adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `wc_${RUN}`, `${adminId}@example.com`],
    );
    const session = await db.withTransaction((tx) =>
      app.get(SessionsService).create(tx, 'admin', adminId),
    );
    adminToken = await app
      .get(AccessTokenService)
      .issue('admin', adminId, session.sessionId);

    userId = randomUUID();
    await db.query('INSERT INTO users (id) VALUES ($1)', [userId]);
    await db.query('INSERT INTO profiles (user_id, nickname) VALUES ($1, $2)', [
      userId,
      `계약${RUN}`,
    ]);
    await db.query(
      `INSERT INTO phone_credentials (user_id, phone_e164, password_hash, verified_at, password_changed_at)
       VALUES ($1, $2, 'x', now(), now())`,
      [userId, `+8210${String(RUN).padStart(8, '0')}`],
    );
    ticketId = randomUUID();
    await db.query(
      `INSERT INTO support_tickets (id, ticket_type, category, reporter_user_id, subject, body)
       VALUES ($1, 'inquiry', 'account', $2, '제목', '내용')`,
      [ticketId, userId],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('M01·M04 로그인: AdminSession { admin, accessToken, expiresAt }, 리프레시는 쿠키', async () => {
    const loginId = `login_${RUN}`;
    const password = 'Admin12345678!';
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,$4)`,
      [
        randomUUID(),
        loginId,
        `${loginId}@example.com`,
        await argon2.hash(password, { type: argon2.argon2id }),
      ],
    );
    const res = await http
      .post('/admin/v1/auth/login')
      .send({ loginId, password })
      .expect(200);
    expect(res.body).toMatchObject({
      admin: {
        id: expect.any(String),
        loginId,
        email: `${loginId}@example.com`,
      },
      accessToken: expect.any(String),
      expiresAt: expect.any(String),
    });
    expect(Date.parse(res.body.expiresAt)).toBeGreaterThan(Date.now());
    expect(res.body).not.toHaveProperty('refreshToken'); // 본문에는 없고 쿠키로만
    expect(res.headers['set-cookie'].join(';')).toContain('dw_admin_refresh=');
    const me = await http
      .get('/admin/v1/me')
      .set({ Authorization: `Bearer ${res.body.accessToken}` })
      .expect(200);
    expect(me.body).toEqual(res.body.admin);
  });

  it('M10·M11 회원: 마스킹 전화·이메일, 이용 제한, 가입일 (기존 필드도 유지)', async () => {
    const list = await get(`/users?query=${userId}`).expect(200);
    const row = list.body.items[0];
    expectKeys(row, [
      'id',
      'nickname',
      'status',
      'createdAt',
      'maskedPhoneNumber',
      'maskedEmail',
      'restriction',
      'restricted',
      'joinedAt',
    ]);
    expect(row.maskedPhoneNumber).toMatch(/\*/);

    const detail = await get(`/users/${userId}`).expect(200);
    expectKeys(detail.body, [
      'providers',
      'availablePoints',
      'levelNo',
      'streakDays',
      'goalCount',
      'completedMissionCount',
      'lastActivityAt',
      'accountActions',
      'maskedPhoneNumber',
      'restriction',
    ]);
    expect(detail.body.providers).toContain('phone');
  });

  it('M12 활동: 결과·대상 ID', async () => {
    const res = await get(`/users/${userId}/activities`).expect(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expectKeys(res.body.items[0], [
      'occurredAt',
      'type',
      'summary',
      'targetId',
      'result',
    ]);
  });

  it('M15 탈퇴 요청: 처리 범위 건수', async () => {
    await db.query(
      'INSERT INTO account_withdrawal_requests (id, user_id) VALUES ($1, $2)',
      [randomUUID(), userId],
    );
    const res = await get('/withdrawal-requests?size=100').expect(200);
    const mine = res.body.items.find((item) => item.userId === userId);
    expect(mine.dataScope).toEqual({
      deleteCount: expect.any(Number),
      anonymizeCount: expect.any(Number),
      retainCount: expect.any(Number),
    });
    expect(mine.dataScope.anonymizeCount).toBeGreaterThanOrEqual(1); // 위 문의
  });

  it('M20·M21 문의: 접수자·담당자·같은 대상 미처리 건수', async () => {
    const list = await get(
      '/support-tickets?sort=receivedAt,desc&size=100',
    ).expect(200);
    const row = list.body.items.find((item) => item.id === ticketId);
    expectKeys(row, [
      'reporterNickname',
      'assignedAdminLoginId',
      'sameTargetOpenCount',
      'targetId',
      'targetSummary',
    ]);
    expect(row.reporterNickname).toBe(`계약${RUN}`);
    const detail = await get(`/support-tickets/${ticketId}`).expect(200);
    expectKeys(detail.body, [
      'reporterNickname',
      'assignedAdminLoginId',
      'sameTargetOpenCount',
      'targetId',
      'targetSummary',
      'events',
    ]);
  });

  it('M05 대시보드: 요약 숫자와 업무별 대기 목록', async () => {
    const res = await get('/dashboard/summary').expect(200);
    expectKeys(res.body, [
      'activeUserCount',
      'missionCount',
      'pendingVerificationCount',
      'openReportCount',
      'aggregatedAt',
      'queues',
    ]);
    expect(Array.isArray(res.body.queues)).toBe(true);
    for (const queue of res.body.queues) {
      expect(Object.keys(queue).sort()).toEqual(['count', 'oldestAt', 'type']);
    }
  });

  it('M72·M82 정책 목록: { items }, 분야·난이도는 code와 UUID를 함께', async () => {
    for (const path of ['/point-cap-policies', '/streak-milestone-policies']) {
      const res = await get(path).expect(200);
      expect(Array.isArray(res.body.items)).toBe(true);
    }
    const rates = await get('/mission-reward-rates').expect(200);
    if (rates.body.length > 0) {
      expectKeys(rates.body[0], [
        'categoryCode',
        'categoryId',
        'difficultyCode',
        'difficultyId',
      ]);
    }
  });

  it('M90 공지: 푸시 발송 집계', async () => {
    const res = await get('/notices').expect(200);
    for (const item of res.body.items) {
      expect(item.pushStats).toEqual({
        pending: expect.any(Number),
        sent: expect.any(Number),
        failed: expect.any(Number),
        skipped: expect.any(Number),
      });
    }
  });
});
