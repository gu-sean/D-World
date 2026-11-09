import { randomInt, randomUUID } from 'node:crypto';
import { createTestApp } from '../support/app.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';

// 관리자 회원(M10~M16)·문의 신고(M20~M24) API
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);
const REASON = '테스트 사유';

describe.skipIf(!databaseUrl)('관리자 회원·문의 API (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let adminId;
  let adminToken;

  const auth = () => ({ Authorization: `Bearer ${adminToken}` });
  const get = (path) => http.get(path).set(auth());
  const post = (path, body, key = randomUUID()) =>
    http
      .post(path)
      .set(auth())
      .set('Idempotency-Key', key)
      .send({ reason: REASON, ...body });
  const patch = (path, body) =>
    http
      .patch(path)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .send({ reason: REASON, ...body });

  async function createUser(nickname) {
    const id = randomUUID();
    await db.query('INSERT INTO users (id) VALUES ($1)', [id]);
    await db.query('INSERT INTO profiles (user_id, nickname) VALUES ($1, $2)', [
      id,
      nickname,
    ]);
    return id;
  }

  async function createTicket({ type = 'report', reporterId, targetUserId }) {
    const id = randomUUID();
    await db.query(
      `INSERT INTO support_tickets
         (id, ticket_type, category, reporter_user_id, subject, body,
          target_user_id, target_kind)
       VALUES ($1, $2, $3, $4, '제목', '내용', $5, $6)`,
      [
        id,
        type,
        type === 'report' ? 'abuse' : 'account',
        reporterId,
        targetUserId ?? null,
        type === 'report' ? 'user' : null,
      ],
    );
    return id;
  }

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `am_${RUN}`, `${adminId}@example.com`],
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

  describe('회원 (M10~M14)', () => {
    let userId;
    const nickname = `회원${RUN}`;

    beforeAll(async () => {
      userId = await createUser(nickname);
      await db.query(
        `INSERT INTO phone_credentials
           (user_id, phone_e164, password_hash, verified_at, password_changed_at)
         VALUES ($1, $2, 'x', now(), now())`,
        [userId, `+8210${RUN}${randomInt(10, 99)}`],
      );
    });

    it('M10 닉네임·ID로 찾고 AdminPage 모양으로 돌려줌', async () => {
      const byName = await get(
        `/admin/v1/users?query=${encodeURIComponent(nickname)}`,
      ).expect(200);
      expect(byName.body).toMatchObject({ page: 1, size: 20, totalCount: 1 });
      expect(byName.body.items[0]).toMatchObject({
        id: userId,
        nickname,
        status: 'active',
        restricted: false,
      });
      const byId = await get(`/admin/v1/users?query=${userId}`).expect(200);
      expect(byId.body.items.map((u) => u.id)).toEqual([userId]);
      await get('/admin/v1/users?sort=bogus').expect(400);
    });

    it('M11 휴대폰은 마스킹, 없는 회원은 404', async () => {
      const res = await get(`/admin/v1/users/${userId}`).expect(200);
      expect(res.body.phone).toMatch(/^010-\*{4}-\d{4}$/);
      expect(res.body.accountActions).toEqual([]);
      await get(`/admin/v1/users/${randomUUID()}`).expect(404);
    });

    it('M13 제한 부여 후 중복 제한은 409, 경고는 가능, 알림 생성', async () => {
      const first = await post(`/admin/v1/users/${userId}/account-actions`, {
        actionType: 'restriction',
        days: 3,
      }).expect(201);
      expect(first.body).toMatchObject({
        userId,
        actionType: 'restriction',
        liftedAt: null,
      });
      const dup = await post(`/admin/v1/users/${userId}/account-actions`, {
        actionType: 'restriction',
        days: 1,
      }).expect(409);
      expect(dup.body.error.code).toBe('ADMIN_ACTION_CONFLICT');
      await post(`/admin/v1/users/${userId}/account-actions`, {
        actionType: 'warning',
      }).expect(201);
      await post(`/admin/v1/users/${userId}/account-actions`, {
        actionType: 'restriction',
      }).expect(400);

      const restricted = await get(
        '/admin/v1/users?restricted=true&query=' + userId,
      );
      expect(restricted.body.totalCount).toBe(1);
      expect(restricted.body.items[0].restricted).toBe(true);
      const { rows } = await db.query(
        `SELECT 1 FROM user_notifications WHERE user_id = $1`,
        [userId],
      );
      expect(rows).toHaveLength(2);
    });

    it('M14 해제하면 제한이 풀리고 다시 해제하면 409', async () => {
      const detail = await get(`/admin/v1/users/${userId}`).expect(200);
      const restriction = detail.body.accountActions.find(
        (a) => a.actionType === 'restriction',
      );
      const lifted = await post(
        `/admin/v1/account-actions/${restriction.id}/lift`,
        {},
      ).expect(200);
      expect(lifted.body.liftedAt).not.toBeNull();
      const again = await post(
        `/admin/v1/account-actions/${restriction.id}/lift`,
        {},
      ).expect(409);
      expect(again.body.error.code).toBe('ADMIN_STATE_CONFLICT');

      // 실패한 변경도 감사 로그에 남고, 저장된 오류 재생은 다시 기록하지 않음
      const { rows } = await db.query(
        `SELECT result, reason, after_value FROM admin_audit_logs
          WHERE admin_id = $1 AND action = 'account_action.lift'
          ORDER BY recorded_at`,
        [adminId],
      );
      expect(rows.map((r) => r.result)).toEqual(['success', 'failure']);
      expect(rows[1].after_value).toMatchObject({
        statusCode: 409,
        code: 'ADMIN_STATE_CONFLICT',
      });
      expect(rows[1].reason).toBe(REASON);
    });

    it('M12 활동을 최신순으로 합치고 type으로 거름', async () => {
      const ticketId = await createTicket({
        type: 'inquiry',
        reporterId: userId,
      });
      const all = await get(`/admin/v1/users/${userId}/activities`).expect(200);
      expect(all.body.items.map((i) => i.id)).toContain(ticketId);
      const onlyInquiry = await get(
        `/admin/v1/users/${userId}/activities?type=inquiry`,
      ).expect(200);
      expect(onlyInquiry.body.items.every((i) => i.type === 'inquiry')).toBe(
        true,
      );
    });
  });

  describe('탈퇴 요청 (M15·M16)', () => {
    it('보류 → 처리 시작은 되고 되돌리면 409, 처리 시작하면 회원 상태가 바뀜', async () => {
      const userId = await createUser(`탈퇴${RUN}`);
      const requestId = randomUUID();
      await db.query(
        `INSERT INTO account_withdrawal_requests (id, user_id) VALUES ($1, $2)`,
        [requestId, userId],
      );
      const list = await get(
        '/admin/v1/withdrawal-requests?status=requested&sort=requestedAt,desc&size=100',
      ).expect(200);
      expect(list.body.items.map((r) => r.id)).toContain(requestId);

      const hold = await patch(`/admin/v1/withdrawal-requests/${requestId}`, {
        status: 'on_hold',
      }).expect(200);
      expect(hold.body.status).toBe('on_hold');
      const proc = await patch(`/admin/v1/withdrawal-requests/${requestId}`, {
        status: 'processing',
      }).expect(200);
      expect(proc.body.reviewedByAdminId).toBe(adminId);
      const { rows } = await db.query(
        'SELECT status FROM users WHERE id = $1',
        [userId],
      );
      expect(rows[0].status).toBe('withdrawal_processing');
      const back = await patch(`/admin/v1/withdrawal-requests/${requestId}`, {
        status: 'on_hold',
      }).expect(409);
      expect(back.body.error.code).toBe('ADMIN_STATE_CONFLICT');
    });
  });

  describe('문의·신고 (M20~M24)', () => {
    let reporter;

    beforeAll(async () => {
      reporter = await createUser(`신고자${RUN}`);
    });

    it('M20·M21 목록 필터와 상세', async () => {
      const target = await createUser(`대상${randomInt(1000000, 9999999)}`);
      const ticketId = await createTicket({
        reporterId: reporter,
        targetUserId: target,
      });
      const list = await get(
        '/admin/v1/support-tickets?ticketType=report&status=received&assigned=none&sort=receivedAt,desc',
      ).expect(200);
      expect(list.body.items.map((t) => t.id)).toContain(ticketId);
      const detail = await get(`/admin/v1/support-tickets/${ticketId}`).expect(
        200,
      );
      expect(detail.body.target).toMatchObject({ kind: 'user', id: target });
      expect(detail.body.reporterNickname).toBe(`신고자${RUN}`);
      expect(detail.body.resolution).toBeNull();
      await get(`/admin/v1/support-tickets/${randomUUID()}`).expect(404);
    });

    it('M22 담당 지정하면 접수 → 검토 중, 이벤트 기록', async () => {
      const ticketId = await createTicket({
        type: 'inquiry',
        reporterId: reporter,
      });
      const res = await post(`/admin/v1/support-tickets/${ticketId}/assign`, {
        adminId: null,
      }).expect(200);
      expect(res.body).toMatchObject({
        status: 'in_review',
        assignedAdminId: adminId,
      });
      expect(res.body.events.map((e) => e.eventType)).toEqual([
        'assigned',
        'status_changed',
      ]);
    });

    it('M23 답변은 신고자에게 알림, 메모는 내부 전용', async () => {
      const ticketId = await createTicket({
        type: 'inquiry',
        reporterId: reporter,
      });
      const reply = await post(`/admin/v1/support-tickets/${ticketId}/events`, {
        eventType: 'reply',
        body: '답변 드려요',
      }).expect(201);
      const note = await post(`/admin/v1/support-tickets/${ticketId}/events`, {
        eventType: 'note',
        body: '내부 메모',
      }).expect(201);
      expect(note.body.events.map((e) => [e.eventType, e.visibility])).toEqual([
        ['reply', 'user'],
        ['note', 'internal'],
      ]);
      expect(reply.body.events).toHaveLength(1);
      const { rows } = await db.query(
        `SELECT 1 FROM user_notifications
          WHERE user_id = $1 AND event_key LIKE 'ticket_reply:%'`,
        [reporter],
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it('M24 처리 결과와 필드가 맞지 않으면 400', async () => {
      const ticketId = await createTicket({
        reporterId: reporter,
        targetUserId: await createUser(`대상${randomInt(1000000, 9999999)}`),
      });
      const bad = await post(
        `/admin/v1/support-tickets/${ticketId}/resolution`,
        {
          outcome: 'reply_only',
        },
      ).expect(400);
      expect(bad.body.error.code).toBe('COMMON_VALIDATION_FAILED');
      await post(`/admin/v1/support-tickets/${ticketId}/resolution`, {
        outcome: 'no_action',
        contentAction: 'hidden',
      }).expect(400);
    });

    it('M24 회원 신고에 경고를 확정하면 조치·완료·답변 알림이 한 번에 처리됨', async () => {
      const target = await createUser(`대상${randomInt(1000000, 9999999)}`);
      const ticketId = await createTicket({
        reporterId: reporter,
        targetUserId: target,
      });
      const res = await post(
        `/admin/v1/support-tickets/${ticketId}/resolution`,
        {
          outcome: 'account_action',
          accountAction: { actionType: 'warning' },
          userReply: '조치했어요',
        },
      ).expect(200);
      expect(res.body.status).toBe('completed');
      expect(res.body.resolution).toMatchObject({
        outcome: 'account_action',
        accountAction: { userId: target, actionType: 'warning' },
      });
      // 신고자에게는 알림, 대상자 알림에는 신고자 정보가 없음
      const { rows } = await db.query(
        `SELECT user_id, title, body FROM user_notifications
          WHERE user_id = ANY($1)`,
        [[reporter, target]],
      );
      const toTarget = rows.filter((r) => r.user_id === target);
      expect(toTarget).toHaveLength(1);
      expect(JSON.stringify(toTarget)).not.toContain(`신고자${RUN}`);

      const again = await post(
        `/admin/v1/support-tickets/${ticketId}/resolution`,
        { outcome: 'no_action' },
      ).expect(409);
      expect(again.body.error.code).toBe('ADMIN_STATE_CONFLICT');
    });

    it('M24 문의에는 reply_only만 가능', async () => {
      const ticketId = await createTicket({
        type: 'inquiry',
        reporterId: reporter,
      });
      await post(`/admin/v1/support-tickets/${ticketId}/resolution`, {
        outcome: 'no_action',
      }).expect(400);
      const ok = await post(
        `/admin/v1/support-tickets/${ticketId}/resolution`,
        {
          outcome: 'reply_only',
          userReply: '해결했어요',
        },
      ).expect(200);
      expect(ok.body.status).toBe('completed');
    });
  });
});
