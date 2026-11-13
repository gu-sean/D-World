import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { createTestApp } from '../support/app.js';
import { createUser } from '../support/users.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { JobsService } from '../../src/jobs/jobs.service.js';

// 회원 탈퇴 전체 흐름: 요청(앱) → 검토·처리 시작(관리자 M15·M16) → 완료(정기 작업)
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)('회원 탈퇴 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let adminToken;

  const user = (u) => ({ Authorization: `Bearer ${u.token}` });
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
  const appGet = (u, path) => http.get(`/api/v1${path}`).set(user(u));
  const appPost = (u, path) =>
    http.post(`/api/v1${path}`).set(user(u)).send({});
  const adminPatch = (path, body) =>
    http
      .patch(`/admin/v1${path}`)
      .set(admin())
      .set('Idempotency-Key', newId())
      .send({ reason: '탈퇴 검토', ...body });

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    const adminId = newId();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `wd_${RUN}`, `${adminId.toLowerCase()}@example.com`],
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

  it('요청 → 처리 시작(세션 폐기) → 정기 작업이 완료하면 회원이 삭제되고 기록만 남음', async () => {
    const u = await createUser(app, db);
    expect(
      (await appGet(u, '/me/withdrawal').expect(200)).body.request,
    ).toBeNull();

    const requested = await appPost(u, '/me/withdrawal').expect(201);
    expect(requested.body.request).toMatchObject({ status: 'requested' });
    const requestId = requested.body.request.id;
    // 이미 요청했으면 다시 요청할 수 없음
    await appPost(u, '/me/withdrawal').expect(409);

    // 관리자 목록에 보이고 처리 시작
    const list = await http
      .get(
        '/admin/v1/withdrawal-requests?status=requested&sort=requestedAt,desc&size=100',
      )
      .set(admin())
      .expect(200);
    expect(list.body.items.map((r) => r.id)).toContain(requestId);
    await adminPatch(`/withdrawal-requests/${requestId}`, {
      status: 'processing',
    }).expect(200);

    // 계정은 즉시 쓸 수 없고 세션도 모두 폐기됨, 처리 중에는 철회할 수 없음
    await appGet(u, '/me').expect(401);
    const { rows: sessions } = await db.query(
      'SELECT count(*)::int AS n FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL',
      [u.id],
    );
    expect(sessions[0].n).toBe(0);

    const result = await app.get(JobsService).runJob('withdrawal-complete');
    expect(result.completed).toBeGreaterThanOrEqual(1);
    const { rows: gone } = await db.query('SELECT 1 FROM users WHERE id = $1', [
      u.id,
    ]);
    expect(gone).toHaveLength(0);
    const { rows } = await db.query(
      'SELECT status, user_id FROM account_withdrawal_requests WHERE id = $1',
      [requestId],
    );
    expect(rows[0]).toEqual({ status: 'completed', user_id: null });
  });

  it('접수·보류 상태에서는 철회할 수 있고, 철회 뒤 다시 요청할 수 있음', async () => {
    const u = await createUser(app, db);
    await appPost(u, '/me/withdrawal/cancel').expect(409); // 철회할 요청 없음
    const first = await appPost(u, '/me/withdrawal').expect(201);

    await adminPatch(`/withdrawal-requests/${first.body.request.id}`, {
      status: 'on_hold',
    }).expect(200);
    const cancelled = await appPost(u, '/me/withdrawal/cancel').expect(200);
    expect(cancelled.body.request.status).toBe('cancelled');
    await appPost(u, '/me/withdrawal/cancel').expect(409);

    const again = await appPost(u, '/me/withdrawal').expect(201);
    expect(again.body.request.id).not.toBe(first.body.request.id);
    // 철회된 요청은 관리자가 처리 시작할 수 없음
    await adminPatch(`/withdrawal-requests/${first.body.request.id}`, {
      status: 'processing',
    }).expect(409);
  });

  it('처리가 시작된 요청은 회원이 철회할 수 없음', async () => {
    const u = await createUser(app, db);
    const requested = await appPost(u, '/me/withdrawal').expect(201);
    // 처리 시작 직전 상태를 만들어(세션 폐기 전) 철회 API의 상태 검사만 확인
    await db.query(
      `UPDATE account_withdrawal_requests SET status = 'processing',
              reviewed_by = (SELECT id FROM admin_accounts LIMIT 1), reviewed_at = now()
        WHERE id = $1`,
      [requested.body.request.id],
    );
    await appPost(u, '/me/withdrawal/cancel').expect(409);
    await appPost(u, '/me/withdrawal').expect(409);
  });
});
