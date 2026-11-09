import { randomInt, randomUUID } from 'node:crypto';
import { createTestApp } from '../support/app.js';
import { createUser } from '../support/users.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';

// 앱 알림함·푸시 기기·공지(사용자 쪽)와 문의·신고(사용자 쪽), 관리자 API와 이어지는 흐름 포함
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)('앱 알림·공지·문의 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let adminToken;
  let a;
  let b;

  const user = (u) => ({ Authorization: `Bearer ${u.token}` });
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
  const get = (u, path) => http.get(`/api/v1${path}`).set(user(u));
  const post = (u, path, body = {}) =>
    http.post(`/api/v1${path}`).set(user(u)).send(body);
  const adminPost = (path, body = {}) =>
    http
      .post(`/admin/v1${path}`)
      .set(admin())
      .set('Idempotency-Key', randomUUID())
      .send({ reason: '테스트', ...body });

  /** 관리자 API로 공지를 만들어 즉시 게시 */
  async function publishNotice(userIds, extra = {}) {
    const created = await adminPost('/notices', {
      category: 'service',
      title: `공지${RUN}-${randomUUID().slice(0, 6)}`,
      body: '내용',
      audienceType: 'users',
      userIds,
      showInList: true,
      sendPush: true,
      ...extra,
    }).expect(201);
    await adminPost(`/notices/${created.body.id}/publish`, {
      scheduledAt: null,
    }).expect(200);
    return created.body;
  }

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    a = await createUser(app, db);
    b = await createUser(app, db);
    const adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `un_${RUN}`, `${adminId}@example.com`],
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

  describe('알림함', () => {
    it('받은 공지 알림만 보이고, 읽음 처리는 한 번만 기록됨', async () => {
      const notice = await publishNotice([a.id]);

      const list = await get(a, '/me/notifications').expect(200);
      const item = list.body.items.find((n) => n.noticeId === notice.id);
      expect(item).toMatchObject({
        kind: 'notice',
        title: notice.title,
        noticeCategory: 'service',
        readAt: null,
      });
      expect(
        (await get(b, '/me/notifications').expect(200)).body.items.some(
          (n) => n.noticeId === notice.id,
        ),
      ).toBe(false);

      const before = (await get(a, '/me/notifications/unread-count')).body
        .count;
      expect(before).toBeGreaterThanOrEqual(1);
      const read = await post(a, `/me/notifications/${item.id}/read`).expect(
        200,
      );
      expect(read.body.readAt).not.toBeNull();
      const again = await post(a, `/me/notifications/${item.id}/read`).expect(
        200,
      );
      expect(again.body.readAt).toBe(read.body.readAt);
      expect((await get(a, '/me/notifications/unread-count')).body.count).toBe(
        before - 1,
      );

      // 남의 알림·없는 알림은 404
      await post(b, `/me/notifications/${item.id}/read`).expect(404);
      await post(a, `/me/notifications/${randomUUID()}/read`).expect(404);
    });

    it('unreadOnly·커서·전체 읽음', async () => {
      const c = await createUser(app, db);
      const first = await publishNotice([c.id]);
      const second = await publishNotice([c.id]);

      const page1 = await get(c, '/me/notifications?limit=1').expect(200);
      expect(page1.body.items).toHaveLength(1);
      expect(page1.body.items[0].noticeId).toBe(second.id);
      expect(page1.body.nextCursor).not.toBeNull();
      const page2 = await get(
        c,
        `/me/notifications?limit=1&cursor=${page1.body.nextCursor}`,
      ).expect(200);
      expect(page2.body.items[0].noticeId).toBe(first.id);
      expect(page2.body.nextCursor).toBeNull();

      await post(c, `/me/notifications/${page2.body.items[0].id}/read`);
      const unread = await get(c, '/me/notifications?unreadOnly=true');
      expect(unread.body.items.map((n) => n.noticeId)).toEqual([second.id]);

      const all = await post(c, '/me/notifications/read-all').expect(200);
      expect(all.body.updated).toBe(1);
      expect((await get(c, '/me/notifications/unread-count')).body.count).toBe(
        0,
      );
      await get(c, '/me/notifications?limit=0').expect(400);
      await get(c, '/me/notifications?cursor=bogus').expect(400);
    });

    it('푸시 전용 공지는 알림함·공지 목록에 보이지 않음', async () => {
      const c = await createUser(app, db);
      const notice = await publishNotice([c.id], {
        showInList: false,
        sendPush: true,
      });
      const { rows } = await db.query(
        'SELECT id FROM user_notifications WHERE notice_id = $1',
        [notice.id],
      );
      expect(rows).toHaveLength(1);
      expect((await get(c, '/me/notifications')).body.items).toHaveLength(0);
      expect((await get(c, '/me/notifications/unread-count')).body.count).toBe(
        0,
      );
      expect((await get(c, '/notices')).body.items).toHaveLength(0);
      await get(c, `/notices/${notice.id}`).expect(404);
      await post(c, `/me/notifications/${rows[0].id}/read`).expect(404);
    });
  });

  describe('공지', () => {
    it('대상 회원만 목록·상세를 볼 수 있음', async () => {
      const notice = await publishNotice([a.id]);
      const list = await get(a, '/notices').expect(200);
      expect(list.body.items.map((n) => n.id)).toContain(notice.id);
      const detail = await get(a, `/notices/${notice.id}`).expect(200);
      expect(detail.body).toMatchObject({ id: notice.id, body: '내용' });
      expect(
        (await get(b, '/notices')).body.items.map((n) => n.id),
      ).not.toContain(notice.id);
      await get(b, `/notices/${notice.id}`).expect(404);
    });

    it('초안·예약 공지는 보이지 않음', async () => {
      const draft = await adminPost('/notices', {
        category: 'service',
        title: `초안${RUN}`,
        body: '내용',
        audienceType: 'users',
        userIds: [a.id],
        showInList: true,
        sendPush: false,
      }).expect(201);
      await get(a, `/notices/${draft.body.id}`).expect(404);
    });
  });

  describe('푸시 기기', () => {
    it('등록·갱신·다른 회원으로 이전·해제', async () => {
      const token = `device-${randomUUID()}`;
      const first = await http
        .put('/api/v1/me/push-devices')
        .set(user(a))
        .send({ platform: 'android', token })
        .expect(200);
      expect(first.body).toMatchObject({ platform: 'android', isActive: true });

      // 같은 토큰을 다른 회원이 등록하면 기기가 넘어감
      const moved = await http
        .put('/api/v1/me/push-devices')
        .set(user(b))
        .send({ platform: 'ios', token })
        .expect(200);
      expect(moved.body.id).toBe(first.body.id);
      const { rows } = await db.query(
        'SELECT user_id, platform FROM push_devices WHERE id = $1',
        [first.body.id],
      );
      expect(rows[0]).toMatchObject({ user_id: b.id, platform: 'ios' });

      await http
        .delete(`/api/v1/me/push-devices/${first.body.id}`)
        .set(user(a))
        .expect(404);
      await http
        .delete(`/api/v1/me/push-devices/${first.body.id}`)
        .set(user(b))
        .expect(204);
      const after = await db.query(
        'SELECT is_active FROM push_devices WHERE id = $1',
        [first.body.id],
      );
      expect(after.rows[0].is_active).toBe(false);

      await http
        .put('/api/v1/me/push-devices')
        .set(user(a))
        .send({ platform: 'web', token: 'x' })
        .expect(400);
    });
  });

  describe('문의·신고', () => {
    const inquiry = (extra) => ({
      ticketType: 'inquiry',
      category: 'account',
      subject: '로그인이 안 돼요',
      body: '자세한 내용',
      ...extra,
    });

    it('문의 접수 → 목록·상세, 남의 접수는 404', async () => {
      const created = await post(a, '/me/support-tickets', inquiry()).expect(
        201,
      );
      expect(created.body).toMatchObject({
        ticketType: 'inquiry',
        status: 'received',
        targetKind: null,
      });
      expect(created.body.events.map((e) => e.eventType)).toEqual(['received']);

      const list = await get(a, '/me/support-tickets?ticketType=inquiry');
      expect(list.body.items.map((t) => t.id)).toContain(created.body.id);
      await get(a, `/me/support-tickets/${created.body.id}`).expect(200);
      await get(b, `/me/support-tickets/${created.body.id}`).expect(404);
      expect(
        (await get(b, '/me/support-tickets')).body.items.map((t) => t.id),
      ).not.toContain(created.body.id);
    });

    it('같은 Idempotency-Key로 다시 보내면 접수가 한 번만 생김', async () => {
      const key = randomUUID();
      const send = () =>
        http
          .post('/api/v1/me/support-tickets')
          .set(user(a))
          .set('Idempotency-Key', key)
          .send(inquiry({ subject: `중복 확인 ${RUN}` }));
      const first = await send().expect(201);
      const replay = await send().expect(201);
      expect(replay.body.id).toBe(first.body.id);
      const { rows } = await db.query(
        'SELECT count(*)::int AS n FROM support_tickets WHERE reporter_user_id = $1 AND subject = $2',
        [a.id, `중복 확인 ${RUN}`],
      );
      expect(rows[0].n).toBe(1);
    });

    it('처리 중인 접수가 20건이면 더 접수할 수 없음', async () => {
      const c = await createUser(app, db);
      for (let i = 0; i < 20; i += 1) {
        await db.query(
          `INSERT INTO support_tickets
             (id, ticket_type, category, reporter_user_id, subject, body)
           VALUES ($1, 'inquiry', 'other', $2, '제목', '내용')`,
          [randomUUID(), c.id],
        );
      }
      const res = await post(c, '/me/support-tickets', inquiry()).expect(429);
      expect(res.body.error.code).toBeDefined();
    });

    it('입력 규칙: 분류·대상 조합이 맞지 않으면 400', async () => {
      await post(
        a,
        '/me/support-tickets',
        inquiry({ category: 'abuse' }),
      ).expect(400);
      await post(
        a,
        '/me/support-tickets',
        inquiry({ target: { kind: 'user', id: b.id } }),
      ).expect(400);
      await post(a, '/me/support-tickets', {
        ...inquiry(),
        ticketType: 'report',
        category: 'abuse',
      }).expect(400);
      await post(a, '/me/support-tickets', inquiry({ subject: '   ' })).expect(
        400,
      );
    });

    it('신고: 나 자신·없는 대상·중복 신고는 거절', async () => {
      const report = (target) => ({
        ticketType: 'report',
        category: 'abuse',
        subject: '욕설',
        body: '내용',
        target,
      });
      const target = await createUser(app, db);
      await post(
        a,
        '/me/support-tickets',
        report({ kind: 'user', id: a.id }),
      ).expect(400);
      await post(
        a,
        '/me/support-tickets',
        report({ kind: 'user', id: randomUUID() }),
      ).expect(404);
      const ok = await post(
        a,
        '/me/support-tickets',
        report({ kind: 'user', id: target.id }),
      ).expect(201);
      expect(ok.body).toMatchObject({
        ticketType: 'report',
        targetKind: 'user',
      });
      const dup = await post(
        a,
        '/me/support-tickets',
        report({ kind: 'user', id: target.id }),
      ).expect(409);
      expect(dup.body.error.code).toBeDefined();
    });

    it('관리자 답변은 보이고 내부 메모·담당자는 숨겨지며, 처리 결과의 안내 문구가 보임', async () => {
      const created = await post(a, '/me/support-tickets', inquiry()).expect(
        201,
      );
      const id = created.body.id;
      await adminPost(`/support-tickets/${id}/events`, {
        eventType: 'note',
        body: '내부 메모입니다',
      }).expect(201);
      await adminPost(`/support-tickets/${id}/events`, {
        eventType: 'reply',
        body: '확인 중이에요',
      }).expect(201);

      const mid = await get(a, `/me/support-tickets/${id}`).expect(200);
      expect(mid.body.events.map((e) => [e.eventType, e.body])).toEqual([
        ['received', null],
        ['reply', '확인 중이에요'],
      ]);
      expect(JSON.stringify(mid.body)).not.toContain('내부 메모');
      expect(mid.body).not.toHaveProperty('assignedAdminId');

      await adminPost(`/support-tickets/${id}/resolution`, {
        outcome: 'reply_only',
        userReply: '해결되었어요',
      }).expect(200);
      const done = await get(a, `/me/support-tickets/${id}`).expect(200);
      expect(done.body).toMatchObject({
        status: 'completed',
        resolution: { userReply: '해결되었어요' },
      });

      const notifications = await get(a, '/me/notifications');
      expect(notifications.body.items.some((n) => n.kind === 'system')).toBe(
        true,
      );
    });
  });
});
