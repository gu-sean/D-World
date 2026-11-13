import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { testNickname } from '../support/users.js';
import { createTestApp } from '../support/app.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { JobsService } from '../../src/jobs/jobs.service.js';
import { NoticeDeliveryService } from '../../src/notices/notice-delivery.service.js';

// 관리자 운영 콘텐츠: 공지(M90~M94), 약관 문서(M95~M97), 추천 문구(M98~M100)
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);
const REASON = '테스트 사유';

describe.skipIf(!databaseUrl)('관리자 운영 콘텐츠 API (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let adminId;
  let adminToken;

  const auth = () => ({ Authorization: `Bearer ${adminToken}` });
  const get = (path) => http.get(path).set(auth());
  const send = (method, path, body = {}) =>
    http[method](path)
      .set(auth())
      .set('Idempotency-Key', newId())
      .send({ reason: REASON, ...body });
  const post = (path, body) => send('post', path, body);
  const patch = (path, body) => send('patch', path, body);

  async function createUser(notificationEnabled = true) {
    const id = newId();
    await db.query('INSERT INTO users (id) VALUES ($1)', [id]);
    await db.query(
      'INSERT INTO profiles (user_id, nickname, notification_enabled) VALUES ($1, $2, $3)',
      [id, testNickname('유저'), notificationEnabled],
    );
    return id;
  }

  const noticeBody = (extra) => ({
    category: 'service',
    title: `공지${RUN}`,
    body: '내용',
    audienceType: 'users',
    showInList: true,
    sendPush: true,
    ...extra,
  });

  const notifications = async (noticeId) =>
    (
      await db.query(
        'SELECT user_id, push_status FROM user_notifications WHERE notice_id = $1',
        [noticeId],
      )
    ).rows;

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    adminId = newId();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `ac_${RUN}`, `${adminId.toLowerCase()}@example.com`],
    );
    const session = await db.withTransaction((tx) =>
      app.get(SessionsService).create(tx, 'admin', adminId),
    );
    adminToken = await app
      .get(AccessTokenService)
      .issue('admin', adminId, session.sessionId);
  });

  afterAll(async () => {
    // 약관 문서는 다른 테스트의 "최신 문서" 조회에 영향을 주므로 만든 것을 지움
    const docs = `(SELECT id FROM policy_document_versions WHERE version = ANY($1))`;
    const versions = [`m${RUN}`, `v${RUN}`, `p${RUN}`, `v${RUN}-long`];
    await db.query(
      `DELETE FROM notices WHERE policy_document_version_id IN ${docs}`,
      [versions],
    );
    await db.query(
      `DELETE FROM consent_records WHERE document_version_id IN ${docs}`,
      [versions],
    );
    await db.query(
      'DELETE FROM policy_document_versions WHERE version = ANY($1)',
      [versions],
    );
    await app.close();
  });

  describe('공지 (M90~M94)', () => {
    it('초안 등록 → 수정 → 즉시 게시하면 수신자에게만 알림이 생김', async () => {
      const [a, b, off] = [
        await createUser(),
        await createUser(),
        await createUser(false),
      ];
      const stranger = await createUser();
      const created = await post(
        '/admin/v1/notices',
        noticeBody({ userIds: [a, b, off] }),
      ).expect(201);
      expect(created.body).toMatchObject({
        status: 'draft',
        audienceType: 'users',
        recipientCount: 3,
      });
      const id = created.body.id;

      const edited = await patch(`/admin/v1/notices/${id}`, {
        title: '수정된 제목',
        userIds: [a, b, off],
      }).expect(200);
      expect(edited.body.title).toBe('수정된 제목');

      const published = await post(`/admin/v1/notices/${id}/publish`, {
        scheduledAt: null,
      }).expect(200);
      expect(published.body.status).toBe('published');
      expect(published.body.fanoutCompletedAt).not.toBeNull();

      const rows = await notifications(id);
      expect(rows.map((r) => r.user_id).sort()).toEqual([a, b, off].sort());
      expect(rows.find((r) => r.user_id === off).push_status).toBe('skipped');
      expect(rows.find((r) => r.user_id === a).push_status).toBe('pending');
      expect(rows.some((r) => r.user_id === stranger)).toBe(false);

      // 게시된 공지는 고치거나 취소할 수 없음
      const locked = await patch(`/admin/v1/notices/${id}`, {
        title: '또 수정',
      }).expect(409);
      expect(locked.body.error.code).toBe('ADMIN_STATE_CONFLICT');
      await post(`/admin/v1/notices/${id}/cancel`).expect(409);
    });

    it('교차 규칙 위반은 400', async () => {
      await post('/admin/v1/notices', noticeBody({})).expect(400); // users인데 userIds 없음
      await post(
        '/admin/v1/notices',
        noticeBody({
          audienceType: 'all',
          showInList: false,
          sendPush: false,
        }),
      ).expect(400);
      await post(
        '/admin/v1/notices',
        noticeBody({ audienceType: 'all', category: 'policy' }),
      ).expect(400);
      await post(
        '/admin/v1/notices',
        noticeBody({ userIds: [newId()] }),
      ).expect(400);
    });

    it('예약은 정기 작업이 시각이 지난 뒤 게시하고, 예약 중에는 취소할 수 있음', async () => {
      const user = await createUser();
      const created = await post(
        '/admin/v1/notices',
        noticeBody({ userIds: [user] }),
      ).expect(201);
      const scheduled = await post(
        `/admin/v1/notices/${created.body.id}/publish`,
        { scheduledAt: new Date(Date.now() + 3_600_000).toISOString() },
      ).expect(200);
      expect(scheduled.body.status).toBe('scheduled');
      expect(await notifications(created.body.id)).toHaveLength(0);

      const cancelled = await post(
        `/admin/v1/notices/${created.body.id}/cancel`,
      ).expect(200);
      expect(cancelled.body.status).toBe('cancelled');

      // 시각이 지난 예약 공지는 작업이 게시하고 알림을 만듦
      const due = await post(
        '/admin/v1/notices',
        noticeBody({ userIds: [user] }),
      ).expect(201);
      await post(`/admin/v1/notices/${due.body.id}/publish`, {
        scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
      }).expect(200);
      await db.query(
        "UPDATE notices SET scheduled_at = now() - interval '1 minute' WHERE id = $1",
        [due.body.id],
      );
      const result = await app.get(JobsService).runJob('notices-deliver');
      expect(result.ok ?? true).toBe(true);
      const after = await get('/admin/v1/notices?status=published');
      expect(after.body.items.map((n) => n.id)).toContain(due.body.id);
      expect(await notifications(due.body.id)).toHaveLength(1);
    });

    it('수신자가 많으면 커서로 이어서 배치 처리하고 마지막 배치에서 완료로 기록', async () => {
      const users = [];
      for (let i = 0; i < 5; i += 1) users.push(await createUser());
      const created = await post(
        '/admin/v1/notices',
        noticeBody({ userIds: users }),
      ).expect(201);
      // 작업이 아직 만들지 않은 게시 직후 상태를 직접 만듦
      await db.query(
        "UPDATE notices SET status = 'published', published_at = now() WHERE id = $1",
        [created.body.id],
      );
      const delivery = app.get(NoticeDeliveryService);
      const batch = (afterUserId) =>
        db.withTransaction((tx) =>
          delivery.fanoutBatch(tx, created.body.id, { limit: 2, afterUserId }),
        );
      const first = await batch(null);
      expect(first).toMatchObject({ picked: 2, completed: false });
      const second = await batch(first.lastUserId);
      expect(second).toMatchObject({ picked: 2, completed: false });
      const third = await batch(second.lastUserId);
      expect(third).toMatchObject({ picked: 1, completed: true });

      expect(
        (await notifications(created.body.id)).map((r) => r.user_id).sort(),
      ).toEqual([...users].sort());
      const { rows } = await db.query(
        'SELECT fanout_completed_at FROM notices WHERE id = $1',
        [created.body.id],
      );
      expect(rows[0].fanout_completed_at).not.toBeNull();
    });

    it('marketing 공지는 마케팅 수신 동의자에게만 감', async () => {
      const agreed = await createUser();
      const refused = await createUser();
      const silent = await createUser();
      const { rows } = await db.query(
        `INSERT INTO policy_document_versions
           (id, document_type, version, body, effective_at, published_at)
         VALUES ($1, 'marketing', $2, '본문', now(), now()) RETURNING id`,
        [newId(), `m${RUN}`],
      );
      const doc = rows[0].id;
      for (const [userId, granted] of [
        [agreed, true],
        [refused, false],
      ]) {
        await db.query(
          `INSERT INTO consent_records (id, user_id, document_version_id, granted)
           VALUES ($1, $2, $3, $4)`,
          [newId(), userId, doc, granted],
        );
      }
      const created = await post(
        '/admin/v1/notices',
        noticeBody({
          category: 'marketing',
          userIds: [agreed, refused, silent],
        }),
      ).expect(201);
      await post(`/admin/v1/notices/${created.body.id}/publish`, {
        scheduledAt: null,
      }).expect(200);
      expect(
        (await notifications(created.body.id)).map((r) => r.user_id),
      ).toEqual([agreed]);
    });

    it('M90 목록은 AdminPage, 잘못된 필터는 400', async () => {
      const res = await get('/admin/v1/notices?status=draft&size=5').expect(
        200,
      );
      expect(res.body).toMatchObject({ page: 1, size: 5 });
      expect(Array.isArray(res.body.items)).toBe(true);
      await get('/admin/v1/notices?status=bogus').expect(400);
    });
  });

  describe('약관 문서 (M95~M97)', () => {
    it('등록 → 게시, 같은 버전은 409, 두 번 게시는 409', async () => {
      const body = {
        documentType: 'terms',
        version: `v${RUN}`,
        body: '약관 본문',
        effectiveAt: new Date(Date.now() + 86_400_000).toISOString(),
        requiresReconsent: true,
      };
      const created = await post('/admin/v1/policy-documents', body).expect(
        201,
      );
      expect(created.body).toMatchObject({
        documentType: 'terms',
        publishedAt: null,
        requiresReconsent: true,
      });
      await post('/admin/v1/policy-documents', body).expect(409);

      const published = await post(
        `/admin/v1/policy-documents/${created.body.id}/publish`,
      ).expect(200);
      expect(published.body.publishedAt).not.toBeNull();
      await post(
        `/admin/v1/policy-documents/${created.body.id}/publish`,
      ).expect(409);

      const list = await get(
        '/admin/v1/policy-documents?documentType=terms&published=true',
      ).expect(200);
      expect(list.body.items.map((d) => d.id)).toContain(created.body.id);
      await post('/admin/v1/policy-documents', {
        ...body,
        documentType: 'bogus',
      }).expect(400);
    });

    it('긴 약관 본문(한글 6만 자, 약 180KB)도 등록할 수 있음', async () => {
      const res = await post('/admin/v1/policy-documents', {
        documentType: 'terms',
        version: `v${RUN}-long`,
        body: '가'.repeat(60_000),
        effectiveAt: new Date(Date.now() + 86_400_000).toISOString(),
        requiresReconsent: false,
      }).expect(201);
      expect(res.body.body).toHaveLength(60_000);
    });

    it('본문이 한도(1MB)를 넘으면 표준 오류 본문으로 413', async () => {
      const res = await post('/admin/v1/policy-documents', {
        documentType: 'terms',
        version: `v${RUN}-huge`,
        body: '가'.repeat(400_000),
        effectiveAt: new Date().toISOString(),
        requiresReconsent: false,
      });
      expect(res.status).toBe(413);
      expect(res.body.error.code).toBeDefined();
    });

    it('깨진 JSON 본문은 500이 아니라 400 표준 오류', async () => {
      const res = await http
        .post('/admin/v1/policy-documents')
        .set(auth())
        .set('Idempotency-Key', newId())
        .set('Content-Type', 'application/json')
        .send('{"documentType": ');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('COMMON_VALIDATION_FAILED');
    });

    it('약관 공지는 있는 약관 버전을 가리켜야 함', async () => {
      const doc = await post('/admin/v1/policy-documents', {
        documentType: 'privacy',
        version: `p${RUN}`,
        body: '본문',
        effectiveAt: new Date().toISOString(),
        requiresReconsent: false,
      }).expect(201);
      const ok = await post(
        '/admin/v1/notices',
        noticeBody({
          category: 'policy',
          audienceType: 'all',
          policyDocumentVersionId: doc.body.id,
        }),
      ).expect(201);
      expect(ok.body.policyDocumentVersionId).toBe(doc.body.id);
      await post(
        '/admin/v1/notices',
        noticeBody({
          category: 'policy',
          audienceType: 'all',
          policyDocumentVersionId: newId(),
        }),
      ).expect(400);
    });
  });

  describe('추천 문구 (M98~M100)', () => {
    it('등록 → 수정 → 목록, 조건 파라미터가 틀리면 400', async () => {
      const code = `rc${RUN}`;
      await db.query(
        `INSERT INTO goal_categories (id, code, name, display_order)
         VALUES ($1, $2, $3, 1)`,
        [newId(), code, `분야${RUN}`],
      );
      const created = await post('/admin/v1/recommendation-messages', {
        message: `오늘은 쉬어가도 좋아요 ${RUN}`,
        conditionType: 'inactive_days',
        conditionParams: { days: 3 },
        categoryCode: code,
        priority: 70,
      }).expect(201);
      expect(created.body).toMatchObject({
        conditionType: 'inactive_days',
        conditionParams: { days: 3 },
        categoryCode: code,
        priority: 70,
        isActive: true,
      });

      const updated = await patch(
        `/admin/v1/recommendation-messages/${created.body.id}`,
        { isActive: false, categoryCode: null, endsAt: null },
      ).expect(200);
      expect(updated.body).toMatchObject({ isActive: false, endsAt: null });
      expect(updated.body.categoryCode).toBeNull();

      const switched = await patch(
        `/admin/v1/recommendation-messages/${created.body.id}`,
        {
          conditionType: 'time_slot',
          conditionParams: { start_hour: 6, end_hour: 9 },
        },
      ).expect(200);
      expect(switched.body.conditionParams).toEqual({
        start_hour: 6,
        end_hour: 9,
      });

      const list = await get(
        '/admin/v1/recommendation-messages?isActive=false&conditionType=time_slot',
      ).expect(200);
      expect(list.body.items.map((m) => m.id)).toContain(created.body.id);

      for (const bad of [
        { conditionType: 'inactive_days', conditionParams: { days: 0 } },
        { conditionType: 'always', conditionParams: { days: 1 } },
        {
          conditionType: 'time_slot',
          conditionParams: { start_hour: 5, end_hour: 5 },
        },
        { conditionType: 'inactive_days' },
      ]) {
        await post('/admin/v1/recommendation-messages', {
          message: '문구',
          ...bad,
        }).expect(400);
      }
      await patch(`/admin/v1/recommendation-messages/${newId()}`, {
        isActive: true,
      }).expect(404);
    });
  });
});
