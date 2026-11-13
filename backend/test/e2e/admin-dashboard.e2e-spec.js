import { randomInt, randomUUID } from 'node:crypto';
import { createTestApp } from '../support/app.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { addDays, kstDate } from '../../src/common/time/kst.js';

// 관리자 대시보드(M05)와 결제·구독 껍데기(M110)
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)(
  '관리자 대시보드·결제 껍데기 (PostgreSQL)',
  () => {
    let app;
    let db;
    let http;
    let adminToken;

    const auth = () => ({ Authorization: `Bearer ${adminToken}` });
    const summary = (qs = '') =>
      http.get(`/admin/v1/dashboard/summary${qs}`).set(auth());

    beforeAll(async () => {
      ({ app, http, db } = await createTestApp());
      const adminId = randomUUID();
      await db.query(
        `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
        [adminId, `ad_${RUN}`, `${adminId}@example.com`],
      );
      const session = await db.withTransaction((tx) =>
        app.get(SessionsService).create(tx, 'admin', adminId),
      );
      adminToken = await app
        .get(AccessTokenService)
        .issue('admin', adminId, session.sessionId);
    });

    afterAll(async () => {
      await app.close();
    });

    describe('M05', () => {
      it('기본은 오늘 하루, 가입자와 대기 큐가 늘어난 만큼 반영됨', async () => {
        const before = (await summary().expect(200)).body;
        const today = kstDate();
        expect(before).toMatchObject({ from: today, to: today });
        expect(before.queues.map((q) => q.type)).toEqual([
          'verification',
          'report',
          'inquiry',
          'withdrawal',
          'appeal',
        ]);
        expect(before).toMatchObject({
          activeUserCount: expect.any(Number),
          missionCount: expect.any(Number),
          pendingVerificationCount: expect.any(Number),
          openReportCount: expect.any(Number),
          aggregatedAt: expect.any(String),
        });
        const stat = (body, type) => body.queues.find((q) => q.type === type);
        expect(Object.keys(before.queueStats).sort()).toEqual([
          'aiPending',
          'appeals',
          'challengeReviews',
          'missionDefinitionReviews',
          'supportTickets',
          'verificationReview',
          'withdrawals',
        ]);

        const userId = randomUUID();
        await db.query('INSERT INTO users (id) VALUES ($1)', [userId]);
        await db.query(
          `INSERT INTO support_tickets
           (id, ticket_type, category, reporter_user_id, subject, body)
         VALUES ($1, 'inquiry', 'account', $2, '제목', '내용')`,
          [randomUUID(), userId],
        );
        await db.query(
          'INSERT INTO account_withdrawal_requests (id, user_id) VALUES ($1, $2)',
          [randomUUID(), userId],
        );

        const after = (await summary().expect(200)).body;
        expect(after.newUsers).toBe(before.newUsers + 1);
        expect(after.queueStats.supportTickets.count).toBe(
          before.queueStats.supportTickets.count + 1,
        );
        expect(stat(after, 'inquiry').count).toBe(
          stat(before, 'inquiry').count + 1,
        );
        expect(stat(after, 'withdrawal').count).toBe(
          stat(before, 'withdrawal').count + 1,
        );
        expect(stat(after, 'inquiry').oldestAt).not.toBeNull();
        expect(typeof after.pointsGranted).toBe('number');
        const { rows: pending } = await db.query(
          `SELECT count(*)::int AS n FROM mission_records r
            WHERE r.status = 'submitted'
              AND NOT EXISTS (SELECT 1 FROM verification_results v WHERE v.record_id = r.id)`,
        );
        expect(after.queueStats.aiPending.count).toBe(pending[0].n);
        expect(after.queueStats.aiPending).toHaveProperty('oldestAt');
      });

      it('과거 기간은 그 기간만 세고, 잘못된 기간은 400', async () => {
        const old = addDays(kstDate(), -400);
        const res = await summary(`?from=${old}&to=${old}`).expect(200);
        expect(res.body).toMatchObject({ newUsers: 0, submittedRecords: 0 });

        await summary(`?from=${kstDate()}&to=${addDays(kstDate(), -1)}`).expect(
          400,
        );
        await summary(
          `?from=${addDays(kstDate(), -31)}&to=${kstDate()}`,
        ).expect(400);
        await summary(
          `?from=${addDays(kstDate(), -30)}&to=${kstDate()}`,
        ).expect(200);
        await summary('?from=2026-02-31').expect(400);
      });

      it('관리자 토큰이 없으면 401', async () => {
        await http.get('/admin/v1/dashboard/summary').expect(401);
      });
    });

    describe('M110', () => {
      it('구독·결제 API는 모두 501 COMMON_NOT_IMPLEMENTED', async () => {
        const id = randomUUID();
        const calls = [
          () => http.get('/admin/v1/subscriptions').set(auth()),
          () => http.get('/admin/v1/payments').set(auth()),
          () =>
            http
              .post(`/admin/v1/payments/${id}/refunds`)
              .set(auth())
              .set('Idempotency-Key', randomUUID())
              .send({ reason: '테스트' }),
          () =>
            http
              .post(`/admin/v1/users/${id}/entitlements/restore`)
              .set(auth())
              .set('Idempotency-Key', randomUUID())
              .send({ reason: '테스트' }),
        ];
        for (const call of calls) {
          const res = await call();
          expect(res.status).toBe(501);
          expect(res.body.error.code).toBe('COMMON_NOT_IMPLEMENTED');
        }
        await http.get('/admin/v1/subscriptions').expect(401);
      });
    });
  },
);
