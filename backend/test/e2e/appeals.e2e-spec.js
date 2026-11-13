import { createUser as createUserWith } from '../support/users.js';
import { createTestApp } from '../support/app.js';
import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { kstDate } from '../../src/common/time/kst.js';
import { DatabaseService } from '../../src/database/database.service.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);
const SECRET = 'test-ai-ingest-secret-0123456789-abcdef';

describe.skipIf(!databaseUrl)('이의 제기 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let adminId;
  let adminToken;
  let categoryId;
  let difficultyId;
  let rateId;

  const tx = (fn) => db.withTransaction(fn);
  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  const createUser = () => createUserWith(app, db);

  async function createMission(user) {
    const id = newId();
    await db.query(
      `INSERT INTO missions
              (id, user_id, source_type, title, category_id, difficulty_id, verification_method,
               scheduled_date, reward_points, reward_rate_version_id, reward_user_xp, reward_pet_xp)
       VALUES ($1,$2,'user','이의 미션',$3,$4,'sensor',$5,100,$6,10,20)`,
      [id, user.id, categoryId, difficultyId, kstDate(), rateId],
    );
    return id;
  }

  async function submittedRecord(user, missionId) {
    const record = await http
      .post(`/api/v1/missions/${missionId}/records`)
      .set(auth(user.token))
      .expect(201);
    await http
      .post(`/api/v1/records/${record.body.id}/submit`)
      .set(auth(user.token))
      .send({ metrics: { steps: 8000 } })
      .expect(200);
    return record.body.id;
  }

  const ingest = (recordId, decision, overrides = {}) =>
    http
      .post('/internal/v1/ai-callbacks/verification-results')
      .set('x-internal-token', SECRET)
      .send({
        ingestKey: newId(),
        recordId,
        decision,
        engineVersion: 'model-v1',
        confidence: 0.9,
        metrics: { score: 0.5 },
        reason: decision === 'rejected' ? '기준 미달' : '충족',
        rawResult: { raw: true },
        ...overrides,
      });

  /** AI 거절까지 끝낸 회차 하나 */
  async function rejectedRecord(user) {
    const missionId = await createMission(user);
    const recordId = await submittedRecord(user, missionId);
    await ingest(recordId, 'rejected').expect(200);
    return { missionId, recordId };
  }

  const file = (user, recordId, reason = '정상적으로 수행했습니다') =>
    http
      .post(`/api/v1/records/${recordId}/appeals`)
      .set(auth(user.token))
      .send({ reason });
  const resolve = (appealId, outcome, reason = '검토 결과', key = newId()) => {
    const req = http
      .post(`/admin/v1/appeals/${appealId}/resolution`)
      .set(auth(adminToken));
    if (key !== null) req.set('Idempotency-Key', key);
    return req.send({
      decision:
        outcome === 'accepted'
          ? 'approved'
          : outcome === 'rejected'
            ? 'rejected'
            : outcome,
      reason,
    });
  };

  const missionStatus = async (id) =>
    (await db.query('SELECT status FROM missions WHERE id = $1', [id])).rows[0]
      .status;
  const wallet = async (userId) =>
    (
      await db.query(
        'SELECT available_points::int AS available FROM point_wallets WHERE user_id = $1',
        [userId],
      )
    ).rows[0]?.available ?? 0;
  const resultsOf = async (recordId) =>
    (
      await db.query(
        'SELECT result_no, source, decision, is_current FROM verification_results WHERE record_id = $1 ORDER BY result_no',
        [recordId],
      )
    ).rows;
  /** 트리거가 막는 시각 갱신을 테스트에서만 우회 */
  const backdate = (recordId, interval) =>
    tx(async (t) => {
      await t.query('SET LOCAL session_replication_role = replica');
      await t.query(
        `UPDATE verification_results
            SET decided_at = decided_at - $2::interval, notified_at = notified_at - $2::interval
          WHERE record_id = $1`,
        [recordId, interval],
      );
    });

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());

    adminId = newId();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `ap_${RUN}`, `${adminId.toLowerCase()}@example.com`],
    );
    const adminSession = await tx((t) =>
      app.get(SessionsService).create(t, 'admin', adminId),
    );
    adminToken = await app
      .get(AccessTokenService)
      .issue('admin', adminId, adminSession.sessionId);

    categoryId = newId();
    difficultyId = newId();
    rateId = newId();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [categoryId, `apc${RUN}`, `이의카테고리${RUN}`],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [difficultyId, `apd${RUN}`, `이의난이도${RUN}`],
    );
    await db.query(
      `INSERT INTO mission_reward_rate_versions
              (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,$3,1,100,10,20, now() - interval '1 day', $4)`,
      [rateId, categoryId, difficultyId, adminId],
    );
    await db.query(
      `INSERT INTO verification_criteria_versions
              (id, category_id, verification_method, version_no, rules_json, effective_at,
               created_by_admin_id)
       VALUES ($1,$2,'sensor',1,'{}'::jsonb, now() - interval '30 days', $3)`,
      [newId(), categoryId, adminId],
    );
    for (const [table, thresholds] of [
      [
        'user_level_policy_versions',
        [
          [1, 0],
          [2, 100],
        ],
      ],
      [
        'pet_level_policy_versions',
        [
          [1, 0],
          [2, 40],
          [3, 120],
          [4, 400],
        ],
      ],
    ]) {
      const policyId = newId();
      await db.query(
        `INSERT INTO ${table} (id, version_no, effective_at, created_by_admin_id)
         VALUES ($1,$2, now() - interval '30 days', $3)`,
        [policyId, randomInt(1_000_000, 1_000_000_000), adminId],
      );
      const thresholdTable = table
        .replace('_versions', '')
        .replace('_policy', '_thresholds');
      for (const [level, xp] of thresholds) {
        await db.query(
          `INSERT INTO ${thresholdTable} (policy_version_id, level_no, min_total_xp) VALUES ($1,$2,$3)`,
          [policyId, level, xp],
        );
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('접수', () => {
    it('AI 거절 후 접수, 중복 접수와 타인·잘못된 입력 거절, 회차 조회에 반영', async () => {
      const user = await createUser();
      const { recordId } = await rejectedRecord(user);

      const res = await file(user, recordId, '  센서 오류였어요 ').expect(201);
      expect(res.body).toMatchObject({
        recordId,
        status: 'open',
        reason: '센서 오류였어요',
        resolution: null,
      });

      const dup = await file(user, recordId).expect(409);
      expect(dup.body.error).toMatchObject({ code: 'VERIFY_APPEAL_DUPLICATE' });

      const view = await http
        .get(`/api/v1/records/${recordId}`)
        .set(auth(user.token))
        .expect(200);
      expect(view.body.appeal).toMatchObject({
        status: 'open',
        canFile: false,
      });
      const list = await http
        .get(`/api/v1/records/${recordId}/appeals`)
        .set(auth(user.token))
        .expect(200);
      expect(list.body.items).toHaveLength(1);
      expect(list.body.items[0].id).toBe(res.body.id);

      const other = await createUser();
      await file(other, recordId).expect(404);
      await http
        .get(`/api/v1/records/${recordId}/appeals`)
        .set(auth(other.token))
        .expect(404);
      await file(user, 'not-a-uuid').expect(400);
      await file(user, newId()).expect(404);
      await http
        .post(`/api/v1/records/${recordId}/appeals`)
        .send({ reason: 'x' })
        .expect(401);

      const user2 = await createUser();
      const second = await rejectedRecord(user2);
      for (const reason of [undefined, '', '   ', 'x'.repeat(1001), 5]) {
        await http
          .post(`/api/v1/records/${second.recordId}/appeals`)
          .set(auth(user2.token))
          .send({ reason })
          .expect(400);
      }
    });

    it('접수할 수 없는 판정: 승인, 안내 전 보류, 관리자 거절, 판정 없음', async () => {
      const user = await createUser();

      const approvedMission = await createMission(user);
      const approved = await submittedRecord(user, approvedMission);
      await ingest(approved, 'approved').expect(200);
      expect((await file(user, approved).expect(422)).body.error.code).toBe(
        'VERIFY_APPEAL_NOT_ALLOWED',
      );

      const heldMission = await createMission(user);
      const held = await submittedRecord(user, heldMission);
      await ingest(held, 'review_required').expect(200);
      expect((await file(user, held).expect(422)).body.error.code).toBe(
        'VERIFY_APPEAL_NOT_ALLOWED',
      );

      // 보류를 관리자가 거절하면 최종 판정이라 이의 제기 불가
      await http
        .post(`/admin/v1/verifications/${held}/decisions`)
        .set(auth(adminToken))
        .set('Idempotency-Key', newId())
        .send({ decision: 'rejected', reason: '미충족' })
        .expect(200);
      const adminRejected = await file(user, held).expect(422);
      expect(adminRejected.body.error).toMatchObject({
        code: 'VERIFY_APPEAL_NOT_ALLOWED',
        details: { decision: 'rejected', source: 'admin' },
      });
      const view = await http
        .get(`/api/v1/records/${held}`)
        .set(auth(user.token))
        .expect(200);
      expect(view.body.appeal).toBeNull();

      const noResult = await http
        .post(`/api/v1/missions/${await createMission(user)}/records`)
        .set(auth(user.token))
        .expect(201);
      expect(
        (await file(user, noResult.body.id).expect(422)).body.error.details,
      ).toEqual({ reason: 'no_result' });
    });

    it('안내 후 7일 이내만 가능, 기한이 지나면 422, 이용 제한 중에도 접수 가능', async () => {
      const user = await createUser();
      const inside = await rejectedRecord(user);
      await backdate(inside.recordId, '6 days 23 hours');
      await file(user, inside.recordId).expect(201);

      const outside = await rejectedRecord(user);
      await backdate(outside.recordId, '7 days 1 hour');
      const view = await http
        .get(`/api/v1/records/${outside.recordId}`)
        .set(auth(user.token))
        .expect(200);
      expect(view.body.appeal.canFile).toBe(false);
      const late = await file(user, outside.recordId).expect(422);
      expect(late.body.error.code).toBe('VERIFY_APPEAL_WINDOW_CLOSED');

      const restricted = await createUser();
      const target = await rejectedRecord(restricted);
      await db.query(
        `INSERT INTO account_actions (id, user_id, admin_id, action_type, reason, starts_at, ends_at)
         VALUES ($1,$2,$3,'restriction','테스트 제한', now() - interval '1 minute', now() + interval '1 day')`,
        [newId(), restricted.id, adminId],
      );
      await http
        .post(`/api/v1/missions/${await createMission(restricted)}/records`)
        .set(auth(restricted.token))
        .expect(403);
      await file(restricted, target.recordId).expect(201);
    });

    it('같은 판정에 동시에 접수해도 하나만 생성', async () => {
      const user = await createUser();
      const { recordId } = await rejectedRecord(user);
      const responses = await Promise.all([
        file(user, recordId),
        file(user, recordId),
        file(user, recordId),
      ]);
      expect(responses.map((r) => r.status).sort()).toEqual([201, 409, 409]);
      const { rows } = await db.query(
        'SELECT 1 FROM verification_appeals WHERE record_id = $1',
        [recordId],
      );
      expect(rows).toHaveLength(1);
    });
  });

  describe('관리자 처리', () => {
    it('인용: 실패한 미션이 완료되고 보상 지급, 감사 로그, 같은 키 재생, 사용자에게 결과 공개', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      let last;
      for (let i = 0; i < 4; i++) {
        last = await submittedRecord(user, missionId);
        await ingest(last, 'rejected').expect(200);
      }
      expect(await missionStatus(missionId)).toBe('failed');
      const appeal = (await file(user, last).expect(201)).body;

      const key = newId();
      const res = await resolve(
        appeal.id,
        'accepted',
        '센서 로그 확인, 조건 충족',
        key,
      ).expect(200);
      expect(res.body).toMatchObject({
        appealId: appeal.id,
        recordId: last,
        status: 'accepted',
        decision: 'approved',
        transition: 'completed',
        missionStatus: 'completed',
      });
      expect(await missionStatus(missionId)).toBe('completed');
      expect(await wallet(user.id)).toBe(100);
      expect(
        (await resultsOf(last)).map((r) => [
          r.source,
          r.decision,
          r.is_current,
        ]),
      ).toEqual([
        ['ai', 'rejected', false],
        ['admin', 'approved', true],
      ]);

      const replay = await resolve(
        appeal.id,
        'accepted',
        '센서 로그 확인, 조건 충족',
        key,
      ).expect(200);
      expect(replay.body).toEqual(res.body);
      expect(await wallet(user.id)).toBe(100);

      const list = await http
        .get(`/api/v1/records/${last}/appeals`)
        .set(auth(user.token))
        .expect(200);
      expect(list.body.items[0]).toMatchObject({
        status: 'accepted',
        resolution: {
          decision: 'approved',
          reason: '센서 로그 확인, 조건 충족',
        },
      });
      const view = await http
        .get(`/api/v1/records/${last}`)
        .set(auth(user.token))
        .expect(200);
      expect(view.body.status).toBe('approved');

      const { rows } = await db.query(
        `SELECT result, reason, before_value, after_value FROM admin_audit_logs
          WHERE admin_id = $1 AND target_user_id = $2 AND action = 'appeal.resolve'`,
        [adminId, user.id],
      );
      expect(rows).toEqual([
        {
          result: 'success',
          reason: '센서 로그 확인, 조건 충족',
          before_value: { recordStatus: 'rejected', missionStatus: 'failed' },
          after_value: {
            outcome: 'accepted',
            decision: 'approved',
            transition: 'completed',
            missionStatus: 'completed',
          },
        },
      ]);
    });

    it('기각: 보상 없이 거절 유지, 새 관리자 판정이 남고 재접수 불가', async () => {
      const user = await createUser();
      const { missionId, recordId } = await rejectedRecord(user);
      const appeal = (await file(user, recordId).expect(201)).body;

      const res = await resolve(appeal.id, 'rejected', '기준 미달 확인').expect(
        200,
      );
      expect(res.body).toMatchObject({
        status: 'rejected',
        decision: 'rejected',
        transition: 'none',
      });
      expect(await wallet(user.id)).toBe(0);
      expect(await missionStatus(missionId)).toBe('in_progress');
      expect(
        (await resultsOf(recordId)).map((r) => [r.source, r.decision]),
      ).toEqual([
        ['ai', 'rejected'],
        ['admin', 'rejected'],
      ]);

      const view = await http
        .get(`/api/v1/records/${recordId}`)
        .set(auth(user.token))
        .expect(200);
      expect(view.body.appeal).toMatchObject({
        status: 'rejected',
        canFile: false,
      });
      expect((await file(user, recordId).expect(422)).body.error.code).toBe(
        'VERIFY_APPEAL_NOT_ALLOWED',
      );
    });

    it('다른 회차로 이미 완료된 미션이면 인용해도 이력만 남고 보상은 중복되지 않음', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      const first = await submittedRecord(user, missionId);
      await ingest(first, 'rejected').expect(200);
      const second = await submittedRecord(user, missionId);
      await ingest(second, 'approved').expect(200);
      expect(await wallet(user.id)).toBe(100);

      const appeal = (await file(user, first).expect(201)).body;
      const res = await resolve(appeal.id, 'accepted').expect(200);
      expect(res.body).toMatchObject({
        transition: 'history',
        missionStatus: 'completed',
      });
      expect(await wallet(user.id)).toBe(100);
    });

    it('입력 검증, 없는 이의 제기, 이미 처리됨, 그 사이 다시 판정됨, 관리자 전용', async () => {
      const user = await createUser();
      const { recordId } = await rejectedRecord(user);
      const appeal = (await file(user, recordId).expect(201)).body;

      for (const payload of [
        {},
        { decision: 'maybe', reason: 'x' },
        { decision: 'approved' },
        { decision: 'approved', reason: ' ' },
      ]) {
        await http
          .post(`/admin/v1/appeals/${appeal.id}/resolution`)
          .set(auth(adminToken))
          .set('Idempotency-Key', newId())
          .send(payload)
          .expect(400);
      }
      await resolve(appeal.id, 'accepted', '사유', null).expect(400);
      await resolve(newId(), 'accepted').expect(404);
      await resolve('bad-id', 'accepted').expect(400);
      await http
        .post(`/admin/v1/appeals/${appeal.id}/resolution`)
        .set(auth(user.token))
        .set('Idempotency-Key', newId())
        .send({ decision: 'approved', reason: '사유' })
        .expect(401);

      // 접수 뒤 다른 경로(직접 SQL)로 현재 판정이 바뀐 경우
      const user2 = await createUser();
      const stale = await rejectedRecord(user2);
      const staleAppeal = (await file(user2, stale.recordId).expect(201)).body;
      await tx(async (t) => {
        await t.query('SET LOCAL session_replication_role = replica');
        await t.query(
          'UPDATE verification_results SET is_current = false WHERE record_id = $1',
          [stale.recordId],
        );
      });
      expect(
        (await resolve(staleAppeal.id, 'accepted').expect(409)).body.error.code,
      ).toBe('APPEAL_OBSOLETE');

      await resolve(appeal.id, 'rejected', '유지').expect(200);
      const again = await resolve(appeal.id, 'accepted', '다른 키').expect(409);
      expect(again.body.error).toMatchObject({
        code: 'APPEAL_NOT_OPEN',
        details: { status: 'rejected' },
      });
    });

    it('동시에 처리하면 하나만 반영', async () => {
      const user = await createUser();
      const { recordId } = await rejectedRecord(user);
      const appeal = (await file(user, recordId).expect(201)).body;
      const responses = await Promise.all([
        resolve(appeal.id, 'accepted'),
        resolve(appeal.id, 'rejected'),
        resolve(appeal.id, 'accepted'),
      ]);
      const statuses = responses.map((r) => r.status).sort();
      expect(statuses).toEqual([200, 409, 409]);
      expect(
        (await resultsOf(recordId)).filter((r) => r.source === 'admin'),
      ).toHaveLength(1);
    });

    it('대기열: 상태 필터, 오래된 순서 커서 페이지네이션, 원 판정 정보, 관리자 토큰 필요', async () => {
      const user = await createUser();
      const filed = [];
      for (let i = 0; i < 3; i++) {
        const { recordId } = await rejectedRecord(user);
        filed.push((await file(user, recordId).expect(201)).body.id);
      }
      const seen = [];
      let sample;
      for (let page = 1; page <= 200; page++) {
        const res = await http
          .get('/admin/v1/appeals')
          .query({ status: 'open', size: 100, page })
          .set(auth(adminToken))
          .expect(200);
        for (const item of res.body.items) {
          if (item.userId === user.id) {
            seen.push(item.id);
            sample ??= item;
          }
        }
        if (page * res.body.size >= res.body.totalCount) break;
      }
      expect(seen).toEqual(filed);
      expect(sample).toMatchObject({
        status: 'open',
        reason: '정상적으로 수행했습니다',
        mission: { title: '이의 미션', verificationMethod: 'sensor' },
        originalResult: {
          engineVersion: 'model-v1',
          confidence: 0.9,
          reason: '기준 미달',
        },
      });

      await resolve(filed[0], 'rejected', '유지').expect(200);
      const closed = await http
        .get('/admin/v1/appeals')
        .query({ status: 'rejected', size: 100 })
        .set(auth(adminToken))
        .expect(200);
      expect(closed.body.items.some((i) => i.id === filed[0])).toBe(true);
      const open = await http
        .get('/admin/v1/appeals')
        .query({ size: 100 })
        .set(auth(adminToken))
        .expect(200);
      expect(open.body.items.some((i) => i.id === filed[0])).toBe(false);

      await http.get('/admin/v1/appeals').set(auth(user.token)).expect(401);
      await http
        .get('/admin/v1/appeals')
        .query({ size: 0 })
        .set(auth(adminToken))
        .expect(400);
      await http
        .get('/admin/v1/appeals')
        .query({ status: 'nope' })
        .set(auth(adminToken))
        .expect(400);
      await http
        .get('/admin/v1/appeals')
        .query({ sort: 'garbage' })
        .set(auth(adminToken))
        .expect(400);
    });
  });
});
