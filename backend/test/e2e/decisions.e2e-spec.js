import { createUser as createUserWith } from '../support/users.js';
import { createTestApp } from '../support/app.js';
import { randomInt, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { addDays, kstDate } from '../../src/common/time/kst.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { OBJECT_STORAGE } from '../../src/media/storage/object-storage.js';
import { PointsService } from '../../src/points/points.service.js';
import { DecisionService } from '../../src/verification/decision.service.js';
import { MissionOutcomeNotifier } from '../../src/verification/mission-outcome.notifier.js';

// DATABASE_URL이 있을 때만 실행, 마이그레이션 적용 필요
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999); // 반복 실행해도 고유 값이 겹치지 않게
const SECRET = 'test-ai-ingest-secret-0123456789-abcdef';
const MB = 1024 * 1024;

describe.skipIf(!databaseUrl)('판정 반영 (PostgreSQL + 메모리 저장소)', () => {
  let app;
  let db;
  let http;
  let storage;
  let decisions;
  let adminId;
  let adminToken;
  let categoryId;
  let difficultyId;
  let rateId;
  let counter = 0;

  const tx = (fn) => db.withTransaction(fn);
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const next = () => `${RUN}${counter++}`;
  const today = () => kstDate();

  const createUser = () => createUserWith(app, db);

  /** 보상 100P, 사용자 XP 10, 펫 XP 20이 확정된 센서 미션 */
  async function createMission(
    user,
    { points = 100, method = 'sensor', date = today() } = {},
  ) {
    const id = randomUUID();
    await db.query(
      `INSERT INTO missions
              (id, user_id, source_type, title, category_id, difficulty_id, verification_method,
               scheduled_date, reward_points, reward_rate_version_id, reward_user_xp, reward_pet_xp)
       VALUES ($1,$2,'user','판정 미션',$3,$4,$5,$6,$7,$8,10,20)`,
      [id, user.id, categoryId, difficultyId, method, date, points, rateId],
    );
    return id;
  }

  const startRecord = async (user, missionId) =>
    (
      await http
        .post(`/api/v1/missions/${missionId}/records`)
        .set(auth(user.token))
        .expect((r) => {
          if (![200, 201].includes(r.status))
            throw new Error(`start ${r.status} ${JSON.stringify(r.body)}`);
        })
    ).body;

  /** 시작 → 센서 요약 제출까지 마친 회차 */
  async function submittedRecord(user, missionId) {
    const record = await startRecord(user, missionId);
    await http
      .post(`/api/v1/records/${record.id}/submit`)
      .set(auth(user.token))
      .send({ metrics: { steps: 8000 } })
      .expect(200);
    return record.id;
  }

  /** 새 미션 하나를 제출 상태로 */
  async function submittedMission(user, options) {
    const missionId = await createMission(user, options);
    return { missionId, recordId: await submittedRecord(user, missionId) };
  }

  const ingestBody = (recordId, decision, overrides = {}) => ({
    ingestKey: randomUUID(),
    recordId,
    decision,
    engineVersion: 'model-v1',
    confidence: 0.93,
    metrics: { score: 0.9 },
    reason: decision === 'rejected' ? '기준 미달' : '충족',
    rawResult: { model: 'model-v1', raw: true },
    ...overrides,
  });
  const ingest = (body, secret = SECRET) => {
    const req = http.post('/internal/v1/ai-callbacks/verification-results');
    if (secret !== null) req.set('x-internal-token', secret);
    return req.send(body);
  };

  const missionStatus = async (id) =>
    (await db.query('SELECT status FROM missions WHERE id = $1', [id])).rows[0]
      .status;
  const recordRow = async (id) =>
    (
      await db.query(
        'SELECT status, completed_at FROM mission_records WHERE id = $1',
        [id],
      )
    ).rows[0];
  const wallet = async (userId) =>
    (
      await db.query(
        `SELECT available_points::int AS available, outstanding_recovery_points::int AS outstanding
           FROM point_wallets WHERE user_id = $1`,
        [userId],
      )
    ).rows[0] ?? { available: 0, outstanding: 0 };
  const userXp = async (userId) =>
    Number(
      (
        await db.query(
          'SELECT total_xp FROM user_experience WHERE user_id = $1',
          [userId],
        )
      ).rows[0]?.total_xp ?? 0,
    );
  const results = async (recordId) =>
    (
      await db.query(
        `SELECT result_no, source, decision, is_current, notified_at, ingest_key, raw_result
           FROM verification_results WHERE record_id = $1 ORDER BY result_no`,
        [recordId],
      )
    ).rows;
  const counts = async (missionId, userId) => ({
    pointAwards: (
      await db.query(
        'SELECT status FROM mission_point_awards WHERE mission_id = $1',
        [missionId],
      )
    ).rows,
    xpAwards: (
      await db.query(
        `SELECT status FROM experience_awards WHERE user_id = $1 AND source_type = 'mission' AND source_id = $2`,
        [userId, missionId],
      )
    ).rows,
  });

  const adminDecide = (
    recordId,
    decision,
    reason = '검수 결과',
    key = randomUUID(),
  ) => {
    const req = http
      .post(`/admin/v1/verifications/${recordId}/decisions`)
      .set(auth(adminToken));
    if (key !== null) req.set('Idempotency-Key', key);
    return req.send({ decision, reason });
  };

  /** 이의 제기 등에서 쓰는 직접 호출: 이미 판정된 회차를 관리자가 다시 판정 */
  const redecide = (recordId, decision, reason = '재판정') =>
    tx((t) =>
      decisions.applyDecision(t, {
        recordId,
        source: 'admin',
        decision,
        reason,
        adminId,
      }),
    );

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    storage = app.get(OBJECT_STORAGE);
    decisions = app.get(DecisionService);

    adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `dc_${RUN}`, `${adminId}@example.com`],
    );
    const adminSession = await tx((t) =>
      app.get(SessionsService).create(t, 'admin', adminId),
    );
    adminToken = await app
      .get(AccessTokenService)
      .issue('admin', adminId, adminSession.sessionId);

    categoryId = randomUUID();
    difficultyId = randomUUID();
    rateId = randomUUID();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [categoryId, `dcc${RUN}`, `판정카테고리${RUN}`],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [difficultyId, `dcd${RUN}`, `판정난이도${RUN}`],
    );
    await db.query(
      `INSERT INTO mission_reward_rate_versions
              (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,$3,1,100,10,20, now() - interval '1 day', $4)`,
      [rateId, categoryId, difficultyId, adminId],
    );
    for (const method of ['sensor', 'camera']) {
      await db.query(
        `INSERT INTO verification_criteria_versions
                (id, category_id, verification_method, version_no, rules_json, effective_at,
                 created_by_admin_id)
         VALUES ($1,$2,$3,1,'{}'::jsonb, now() - interval '30 days', $4)`,
        [randomUUID(), categoryId, method, adminId],
      );
    }
    // 레벨 정책: 다른 스위트의 정책이 있으면 그쪽이 우선하도록 오래된 시행일
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
      const policyId = randomUUID();
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

  describe('AI 결과 수신', () => {
    it('공유 비밀이 없거나 틀리면 거절, 설정이 없으면 엔드포인트가 닫힘', async () => {
      const user = await createUser();
      const { recordId } = await submittedMission(user);
      const body = ingestBody(recordId, 'approved');

      expect((await ingest(body, null).expect(401)).body.error.code).toBe(
        'COMMON_UNAUTHORIZED',
      );
      await ingest(body, 'wrong-secret-0123456789-0123456789-xx').expect(401);
      await ingest(body, SECRET.slice(0, -1)).expect(401);
      expect((await recordRow(recordId)).status).toBe('submitted');

      const config = app.get(ConfigService);
      const original = config.get.bind(config);
      config.get = (key) =>
        key === 'INTERNAL_API_TOKEN' ? undefined : original(key);
      try {
        expect((await ingest(body).expect(503)).body.error.code).toBe(
          'AI_INGEST_DISABLED',
        );
      } finally {
        config.get = original;
      }
    });

    it('입력 형식 오류는 400', async () => {
      const user = await createUser();
      const { recordId } = await submittedMission(user);
      const bad = [
        {},
        ingestBody(recordId, 'maybe'),
        ingestBody(recordId, 'approved', { ingestKey: 'short' }),
        ingestBody(recordId, 'approved', { ingestKey: 'has space in key' }),
        ingestBody(recordId, 'approved', { engineVersion: '' }),
        ingestBody(recordId, 'approved', { confidence: 1.5 }),
        // rawResult는 선택(AI는 보내지 않음, 없으면 받은 본문 전체를 저장)
        ingestBody(recordId, 'approved', { recordId: 'x' }),
      ];
      for (const payload of bad) {
        const res = await ingest(payload);
        expect(res.status, JSON.stringify(payload)).toBe(400);
      }
      await ingest(ingestBody(randomUUID(), 'approved')).expect(404);
    });

    it('승인: 회차 승인, 미션 완료, 포인트·XP 지급, 판정 이력(원본·ingestKey·안내 시각) 기록', async () => {
      const user = await createUser();
      const { missionId, recordId } = await submittedMission(user);
      const body = ingestBody(recordId, 'approved');

      const res = await ingest(body).expect(200);
      expect(res.body).toMatchObject({
        status: 'applied',
        decision: 'approved',
        transition: 'completed',
        missionStatus: 'completed',
      });

      expect(await missionStatus(missionId)).toBe('completed');
      const record = await recordRow(recordId);
      expect(record.status).toBe('approved');
      expect(record.completed_at).not.toBeNull();
      expect(await wallet(user.id)).toEqual({ available: 100, outstanding: 0 });
      expect(await userXp(user.id)).toBe(10);
      expect(await counts(missionId, user.id)).toEqual({
        pointAwards: [{ status: 'active' }],
        xpAwards: [{ status: 'active' }],
      });

      const [result] = await results(recordId);
      expect(result).toMatchObject({
        result_no: 1,
        source: 'ai',
        decision: 'approved',
        is_current: true,
        ingest_key: body.ingestKey,
        raw_result: body.rawResult,
      });
      expect(result.notified_at).not.toBeNull();
    });

    it('같은 ingestKey로 다시 보내면 처리하지 않고 첫 결과를 반환, 다른 회차에는 쓸 수 없음', async () => {
      const user = await createUser();
      const first = await submittedMission(user);
      const second = await submittedMission(user);
      const body = ingestBody(first.recordId, 'approved');

      const applied = await ingest(body).expect(200);
      const duplicate = await ingest(body).expect(200);
      expect(duplicate.body).toMatchObject({
        status: 'duplicate',
        resultId: applied.body.resultId,
      });
      expect(await wallet(user.id)).toEqual({ available: 100, outstanding: 0 });
      expect(await results(first.recordId)).toHaveLength(1);

      const reused = await ingest({
        ...body,
        recordId: second.recordId,
      }).expect(422);
      expect(reused.body.error.code).toBe('INGEST_KEY_REUSED');
      expect((await recordRow(second.recordId)).status).toBe('submitted');
    });

    it('이미 판정이 끝났거나 종료된 회차에 늦게 온 결과는 기록하지 않고 ignored', async () => {
      const user = await createUser();
      const { recordId } = await submittedMission(user);
      await ingest(ingestBody(recordId, 'rejected')).expect(200);

      const late = await ingest(ingestBody(recordId, 'approved')).expect(200);
      expect(late.body).toEqual({
        status: 'ignored',
        recordStatus: 'rejected',
      });
      expect(await results(recordId)).toHaveLength(1);

      const open = await startRecord(user, await createMission(user));
      const notSubmitted = await ingest(ingestBody(open.id, 'approved')).expect(
        200,
      );
      expect(notSubmitted.body).toMatchObject({
        status: 'ignored',
        recordStatus: 'recording',
      });
    });

    it('같은 회차에 서로 다른 결과가 동시에 오면 하나만 반영', async () => {
      const user = await createUser();
      const { missionId, recordId } = await submittedMission(user);
      const responses = await Promise.all([
        ingest(ingestBody(recordId, 'approved')),
        ingest(ingestBody(recordId, 'approved')),
        ingest(ingestBody(recordId, 'rejected')),
      ]);
      expect(responses.every((r) => r.status === 200)).toBe(true);
      const statuses = responses.map((r) => r.body.status).sort();
      expect(statuses).toEqual(['applied', 'ignored', 'ignored']);
      expect(await results(recordId)).toHaveLength(1);
      const award = await counts(missionId, user.id);
      expect(award.pointAwards.length).toBeLessThanOrEqual(1);
    });

    it('판정 기준이 없거나 맞지 않으면 422이고 아무것도 기록하지 않음', async () => {
      const user = await createUser();
      const { recordId } = await submittedMission(user);
      const mismatch = await ingest(
        ingestBody(recordId, 'approved', { criteriaVersionId: randomUUID() }),
      ).expect(422);
      expect(mismatch.body.error.code).toBe('VERIFY_EVIDENCE_KIND_MISMATCH');

      // 기준이 없는 카테고리
      const otherCategory = randomUUID();
      await db.query(
        `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [otherCategory, `dcn${next()}`, `기준없음${next()}`],
      );
      const missionId = randomUUID();
      await db.query(
        `INSERT INTO missions (id, user_id, source_type, title, category_id, difficulty_id,
                               verification_method, scheduled_date)
         VALUES ($1,$2,'user','기준 없음',$3,$4,'sensor',$5)`,
        [missionId, user.id, otherCategory, difficultyId, today()],
      );
      const orphanRecord = await submittedRecord(user, missionId);
      const missing = await ingest(ingestBody(orphanRecord, 'approved')).expect(
        422,
      );
      expect(missing.body.error.code).toBe('CRITERIA_MISSING');
      expect(await results(recordId)).toHaveLength(0);
      expect(await results(orphanRecord)).toHaveLength(0);
    });
  });

  describe('거절과 보류', () => {
    it('거절: 남은 횟수가 있고 마감 전이면 미션은 in_progress, 보상 없음, 사유는 안내 후 사용자에게 보임', async () => {
      const user = await createUser();
      const { missionId, recordId } = await submittedMission(user);
      const res = await ingest(ingestBody(recordId, 'rejected')).expect(200);
      expect(res.body).toMatchObject({
        decision: 'rejected',
        transition: 'none',
        missionStatus: 'in_progress',
      });

      expect(await missionStatus(missionId)).toBe('in_progress');
      expect((await recordRow(recordId)).status).toBe('rejected');
      expect(await wallet(user.id)).toEqual({ available: 0, outstanding: 0 });
      expect(await userXp(user.id)).toBe(0);
      const view = await http
        .get(`/api/v1/records/${recordId}`)
        .set(auth(user.token))
        .expect(200);
      expect(view.body.result).toMatchObject({
        decision: 'rejected',
        reason: '기준 미달',
        notified: true,
      });
      expect(view.body.appeal).toMatchObject({ status: null, canFile: true });

      // 재시도 가능
      const retry = await http
        .post(`/api/v1/missions/${missionId}/records`)
        .set(auth(user.token))
        .expect(201);
      expect(retry.body.attemptNo).toBe(2);
    });

    it('거절 4회를 모두 쓰면 failed, 마감이 지난 뒤 거절돼도 failed', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      for (let i = 1; i <= 4; i++) {
        const recordId = await submittedRecord(user, missionId);
        const res = await ingest(ingestBody(recordId, 'rejected')).expect(200);
        expect(res.body.missionStatus).toBe(i < 4 ? 'in_progress' : 'failed');
      }

      const late = await createMission(user);
      const recordId = await submittedRecord(user, late);
      await tx(async (t) => {
        await t.query('SET LOCAL session_replication_role = replica');
        await t.query(
          `UPDATE missions SET due_at = now() - interval '1 minute' WHERE id = $1`,
          [late],
        );
      });
      expect(
        (await ingest(ingestBody(recordId, 'rejected')).expect(200)).body
          .missionStatus,
      ).toBe('failed');
    });

    it('보류: 안내 전이라 notified_at 없음·사유 숨김, 미션은 submitted, 대기열에 오름', async () => {
      const user = await createUser();
      const { missionId, recordId } = await submittedMission(user);
      const res = await ingest(
        ingestBody(recordId, 'review_required', {
          reason: 'AI 의견: 애매함',
          confidence: 0.55,
        }),
      ).expect(200);
      expect(res.body).toMatchObject({
        decision: 'review_required',
        missionStatus: 'submitted',
      });

      expect((await recordRow(recordId)).status).toBe('review_required');
      expect((await results(recordId))[0].notified_at).toBeNull();
      const view = await http
        .get(`/api/v1/records/${recordId}`)
        .set(auth(user.token))
        .expect(200);
      expect(view.body.result).toMatchObject({
        decision: 'review_required',
        reason: null,
        notified: false,
      });
      expect(view.body.appeal).toBeNull();
      expect(await missionStatus(missionId)).toBe('submitted');
      expect(await wallet(user.id)).toEqual({ available: 0, outstanding: 0 });

      const queue = await http
        .get('/admin/v1/verifications')
        // 공유 테스트 DB에는 다른 테스트의 대기 건이 쌓이므로 최신순으로 확인
        .query({ size: 100, sort: 'submittedAt,desc' })
        .set(auth(adminToken))
        .expect(200);
      const item = queue.body.items.find((i) => i.recordId === recordId);
      expect(item).toMatchObject({
        missionId,
        userId: user.id,
        mission: { title: '판정 미션', verificationMethod: 'sensor' },
        ai: {
          engineVersion: 'model-v1',
          confidence: 0.55,
          reason: 'AI 의견: 애매함',
        },
      });
    });
  });

  describe('판정 결과 알림', () => {
    const verdictNotices = async (userId) =>
      (
        await db.query(
          `SELECT event_key, title, push_status FROM user_notifications
            WHERE user_id = $1 AND event_key LIKE 'verification_result:%'
            ORDER BY created_at`,
          [userId],
        )
      ).rows;

    it('승인·거절은 판정마다 한 번 알림, 보류는 알리지 않음, 같은 결과 재전송은 중복 없음', async () => {
      const user = await createUser();
      const approved = await submittedMission(user);
      const body = ingestBody(approved.recordId, 'approved');
      await ingest(body).expect(200);
      await ingest(body).expect(200); // 같은 ingestKey 재전송
      const {
        rows: [result],
      } = await db.query(
        'SELECT id FROM verification_results WHERE record_id = $1 AND is_current',
        [approved.recordId],
      );
      expect(await verdictNotices(user.id)).toEqual([
        {
          event_key: `verification_result:${result.id}`,
          title: '인증이 승인됐어요',
          push_status: 'none', // 알림을 켜지 않은 회원
        },
      ]);

      const held = await submittedMission(user);
      await ingest(ingestBody(held.recordId, 'review_required')).expect(200);
      expect(await verdictNotices(user.id)).toHaveLength(1);

      const other = await createUser();
      await db.query(
        'UPDATE profiles SET notification_enabled = true WHERE user_id = $1',
        [other.id],
      );
      const rejected = await submittedMission(other);
      await ingest(ingestBody(rejected.recordId, 'rejected')).expect(200);
      expect(await verdictNotices(other.id)).toEqual([
        expect.objectContaining({
          title: '인증이 반려됐어요',
          push_status: 'pending',
        }),
      ]);
    });
  });

  describe('관리자 보류 검수', () => {
    it('승인: 미션 완료와 보상 지급, 감사 로그, 같은 Idempotency-Key 재생', async () => {
      const user = await createUser();
      const { missionId, recordId } = await submittedMission(user);
      await ingest(ingestBody(recordId, 'review_required')).expect(200);

      const key = randomUUID();
      const res = await adminDecide(
        recordId,
        'approved',
        '조건 충족 확인',
        key,
      ).expect(200);
      expect(res.body).toMatchObject({
        recordId,
        decision: 'approved',
        transition: 'completed',
        missionStatus: 'completed',
      });
      expect(await wallet(user.id)).toEqual({ available: 100, outstanding: 0 });
      const history = await results(recordId);
      expect(
        history.map((r) => [r.result_no, r.source, r.decision, r.is_current]),
      ).toEqual([
        [1, 'ai', 'review_required', false],
        [2, 'admin', 'approved', true],
      ]);
      expect(history[1].notified_at).not.toBeNull();

      const replay = await adminDecide(
        recordId,
        'approved',
        '조건 충족 확인',
        key,
      ).expect(200);
      expect(replay.body).toEqual(res.body);
      expect(await results(recordId)).toHaveLength(2);
      expect(await wallet(user.id)).toEqual({ available: 100, outstanding: 0 });

      const { rows } = await db.query(
        `SELECT action, result, reason, before_value, after_value FROM admin_audit_logs
          WHERE admin_id = $1 AND target_user_id = $2 AND action = 'verification.decide'`,
        [adminId, user.id],
      );
      expect(rows).toEqual([
        {
          action: 'verification.decide',
          result: 'success',
          reason: '조건 충족 확인',
          before_value: {
            recordStatus: 'review_required',
            missionStatus: 'submitted',
          },
          after_value: {
            decision: 'approved',
            transition: 'completed',
            missionStatus: 'completed',
          },
        },
      ]);
      expect(await missionStatus(missionId)).toBe('completed');
    });

    it('거절: 재시도 가능하면 in_progress, 보상 없음. 사유 필수, 보류가 아닌 회차는 거절', async () => {
      const user = await createUser();
      const { missionId, recordId } = await submittedMission(user);
      await ingest(ingestBody(recordId, 'review_required')).expect(200);

      for (const payload of [
        { decision: 'approved' },
        { decision: 'approved', reason: '  ' },
        { decision: 'review_required', reason: 'x' },
      ]) {
        await http
          .post(`/admin/v1/verifications/${recordId}/decisions`)
          .set(auth(adminToken))
          .set('Idempotency-Key', randomUUID())
          .send(payload)
          .expect(400);
      }
      await http
        .post(`/admin/v1/verifications/${recordId}/decisions`)
        .set(auth(adminToken))
        .send({ decision: 'rejected', reason: '사유' })
        .expect(400);

      const res = await adminDecide(recordId, 'rejected', '조건 미충족').expect(
        200,
      );
      expect(res.body).toMatchObject({
        decision: 'rejected',
        missionStatus: 'in_progress',
      });
      expect(await wallet(user.id)).toEqual({ available: 0, outstanding: 0 });
      expect(await missionStatus(missionId)).toBe('in_progress');

      // 이미 최종 판정이 난 회차, 제출되지 않은 회차, 없는 회차
      const again = await adminDecide(recordId, 'approved').expect(409);
      expect(again.body.error).toMatchObject({
        code: 'RECORD_NOT_REVIEWABLE',
        details: { status: 'rejected' },
      });
      const open = await startRecord(user, missionId);
      expect(
        (await adminDecide(open.id, 'approved').expect(409)).body.error.details
          .status,
      ).toBe('recording');
      await adminDecide(randomUUID(), 'approved').expect(404);
    });

    it('상세: 미션 조건, 판정 이력, 증거 파일의 조회용 URL', async () => {
      const user = await createUser();
      const missionId = await createMission(user, { method: 'camera' });
      const record = await startRecord(user, missionId);
      const registered = await http
        .post(`/api/v1/records/${record.id}/media`)
        .set(auth(user.token))
        .send({
          mediaKind: 'camera_photo',
          mimeType: 'image/jpeg',
          sizeBytes: MB,
        })
        .expect(201);
      const { rows } = await db.query(
        'SELECT object_key FROM media_files WHERE id = $1',
        [registered.body.id],
      );
      storage.simulateUpload(rows[0].object_key, {
        size: MB,
        contentType: 'image/jpeg',
      });
      await http
        .post(`/api/v1/media/${registered.body.id}/complete`)
        .set(auth(user.token))
        .expect(200);
      await http
        .post(`/api/v1/records/${record.id}/submit`)
        .set(auth(user.token))
        .send({})
        .expect(200);
      await ingest(ingestBody(record.id, 'review_required')).expect(200);

      const detail = await http
        .get(`/admin/v1/verifications/${record.id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(detail.body).toMatchObject({
        recordId: record.id,
        userId: user.id,
        status: 'review_required',
        evidenceKind: 'camera_media',
        mission: {
          title: '판정 미션',
          verificationMethod: 'camera',
          status: 'submitted',
        },
      });
      expect(detail.body.results).toHaveLength(1);
      expect(detail.body.files).toHaveLength(1);
      expect(detail.body.files[0].url).toContain(rows[0].object_key);
      await http
        .get(`/admin/v1/verifications/${randomUUID()}`)
        .set(auth(adminToken))
        .expect(404);
      await http
        .get(`/admin/v1/verifications/${record.id}`)
        .set(auth((await createUser()).token))
        .expect(401);
    });

    it('대기열은 오래된 순서로 커서 페이지네이션하고 관리자 토큰이 필요', async () => {
      const user = await createUser();
      const queued = [];
      for (let i = 0; i < 3; i++) {
        const { recordId } = await submittedMission(user);
        await ingest(ingestBody(recordId, 'review_required')).expect(200);
        queued.push(recordId);
      }
      const seen = [];
      for (let page = 1; page <= 200; page++) {
        const res = await http
          .get('/admin/v1/verifications')
          .query({ size: 100, page })
          .set(auth(adminToken))
          .expect(200);
        seen.push(
          ...res.body.items
            .filter((i) => i.userId === user.id)
            .map((i) => i.recordId),
        );
        if (page * res.body.size >= res.body.totalCount) break;
      }
      expect(seen).toEqual(queued);
      await http
        .get('/admin/v1/verifications')
        .set(auth(user.token))
        .expect(401);
      await http
        .get('/admin/v1/verifications')
        .query({ size: 0 })
        .set(auth(adminToken))
        .expect(400);
    });
  });

  describe('여러 회차', () => {
    it('다른 회차가 먼저 승인되면 판정 대기 중이던 회차는 superseded가 되고 이후 결과는 무시', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      const first = await submittedRecord(user, missionId);
      await ingest(ingestBody(first, 'review_required')).expect(200);
      const second = await submittedRecord(user, missionId);

      await ingest(ingestBody(second, 'approved')).expect(200);
      expect((await recordRow(first)).status).toBe('superseded');
      expect((await recordRow(first)).completed_at).not.toBeNull();
      expect(await missionStatus(missionId)).toBe('completed');
      expect(await wallet(user.id)).toEqual({ available: 100, outstanding: 0 });

      expect(
        (await ingest(ingestBody(first, 'approved')).expect(200)).body.status,
      ).toBe('ignored');
      const gone = await adminDecide(first, 'approved').expect(409);
      expect(gone.body.error.details.status).toBe('superseded');
      const queue = await http
        .get('/admin/v1/verifications')
        // 공유 테스트 DB에는 다른 테스트의 대기 건이 쌓이므로 최신순으로 확인
        .query({ size: 100, sort: 'submittedAt,desc' })
        .set(auth(adminToken))
        .expect(200);
      expect(queue.body.items.some((i) => i.recordId === first)).toBe(false);
    });

    it('이미 완료된 미션의 다른 회차를 나중에 승인해도 이력만 남고 보상은 중복되지 않음', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      const first = await submittedRecord(user, missionId);
      await ingest(ingestBody(first, 'rejected')).expect(200);
      const second = await submittedRecord(user, missionId);
      await ingest(ingestBody(second, 'approved')).expect(200);
      expect(await wallet(user.id)).toEqual({ available: 100, outstanding: 0 });

      const late = await redecide(first, 'approved', '이의 제기 인용');
      expect(late).toMatchObject({
        transition: 'history',
        missionStatus: 'completed',
      });
      expect((await recordRow(first)).status).toBe('approved');
      expect(await wallet(user.id)).toEqual({ available: 100, outstanding: 0 });
      expect(await userXp(user.id)).toBe(10);
      expect(await counts(missionId, user.id)).toEqual({
        pointAwards: [{ status: 'active' }],
        xpAwards: [{ status: 'active' }],
      });
      expect(await results(first)).toHaveLength(2);
    });

    it('실패한 미션도 나중에 승인되면 완료되고 보상이 지급됨', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      let last;
      for (let i = 0; i < 4; i++) {
        last = await submittedRecord(user, missionId);
        await ingest(ingestBody(last, 'rejected')).expect(200);
      }
      expect(await missionStatus(missionId)).toBe('failed');

      const res = await redecide(last, 'approved', '이의 제기 인용');
      expect(res).toMatchObject({
        transition: 'completed',
        missionStatus: 'completed',
      });
      expect(await wallet(user.id)).toEqual({ available: 100, outstanding: 0 });
      expect(await userXp(user.id)).toBe(10);
    });
  });

  describe('승인 번복과 복구', () => {
    it('유효한 승인이 사라지면 포인트·XP를 회수하고 재시도할 수 있게 되돌리며, 재승인하면 복구(중복 지급 없음)', async () => {
      const user = await createUser();
      const { missionId, recordId } = await submittedMission(user);
      await ingest(ingestBody(recordId, 'approved')).expect(200);
      expect(await wallet(user.id)).toEqual({ available: 100, outstanding: 0 });

      const overturned = await redecide(
        recordId,
        'rejected',
        '재검토 결과 거절',
      );
      expect(overturned).toMatchObject({
        transition: 'revoked',
        missionStatus: 'in_progress',
      });
      expect(await wallet(user.id)).toEqual({ available: 0, outstanding: 0 });
      expect(await userXp(user.id)).toBe(0);
      expect((await counts(missionId, user.id)).pointAwards).toEqual([
        { status: 'revoked' },
      ]);
      expect((await counts(missionId, user.id)).xpAwards).toEqual([
        { status: 'revoked' },
      ]);
      expect((await recordRow(recordId)).status).toBe('rejected');

      const restored = await redecide(recordId, 'approved', '다시 승인');
      expect(restored).toMatchObject({
        transition: 'completed',
        missionStatus: 'completed',
      });
      expect(await wallet(user.id)).toEqual({ available: 100, outstanding: 0 });
      expect(await userXp(user.id)).toBe(10);
      expect((await counts(missionId, user.id)).pointAwards).toEqual([
        { status: 'active' },
      ]);
      expect(await results(recordId)).toHaveLength(3);

      // 한 번 더 번복·복구해도 안전
      await redecide(recordId, 'rejected', '두 번째 번복');
      await redecide(recordId, 'approved', '두 번째 복구');
      expect(await wallet(user.id)).toEqual({ available: 100, outstanding: 0 });
      expect(await userXp(user.id)).toBe(10);
    });

    it('다른 회차에 유효한 승인이 남아 있으면 번복해도 보상을 유지', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      const first = await submittedRecord(user, missionId);
      await ingest(ingestBody(first, 'rejected')).expect(200);
      const second = await submittedRecord(user, missionId);
      await ingest(ingestBody(second, 'approved')).expect(200);
      await redecide(first, 'approved', '이의 제기 인용'); // 두 회차 모두 승인

      const res = await redecide(second, 'rejected', '둘째 번복');
      expect(res).toMatchObject({
        transition: 'history',
        missionStatus: 'completed',
      });
      expect(await wallet(user.id)).toEqual({ available: 100, outstanding: 0 });
      expect(await userXp(user.id)).toBe(10);

      // 마지막 유효 승인이 사라질 때 비로소 회수
      const last = await redecide(first, 'rejected', '첫째 번복');
      expect(last.transition).toBe('revoked');
      expect(await wallet(user.id)).toEqual({ available: 0, outstanding: 0 });
    });

    it('잔액이 모자라면 가능한 만큼 회수하고 부족분은 미회수액으로 남고, 복구하면 정산분까지 돌려줌', async () => {
      const user = await createUser();
      const { recordId } = await submittedMission(user);
      await ingest(ingestBody(recordId, 'approved')).expect(200);
      await tx((t) =>
        app.get(PointsService).manualAdjust(t, {
          adminId,
          userId: user.id,
          kind: 'manual_recovery',
          amount: 70,
          reason: '테스트 사용',
        }),
      );

      await redecide(recordId, 'rejected', '번복');
      expect(await wallet(user.id)).toEqual({ available: 0, outstanding: 70 });

      await redecide(recordId, 'approved', '복구');
      expect(await wallet(user.id)).toEqual({ available: 30, outstanding: 0 });
    });
  });

  describe('부수 효과', () => {
    it('시작 때 고정된 대표 펫이 XP를 받고(버프 포함) 이후 대표를 바꿔도 달라지지 않음', async () => {
      const user = await createUser();
      const makeSpecies = async () => {
        const tag = next();
        const speciesId = randomUUID();
        const versionId = randomUUID();
        const imageId = randomUUID();
        await db.query(
          `INSERT INTO pet_species (id, code, name, status, created_by_admin_id)
           VALUES ($1,$2,$3,'public',$4)`,
          [speciesId, `dp${tag}`, `판정펫${tag}`, adminId],
        );
        await db.query(
          `INSERT INTO pet_species_versions
                  (id, species_id, version_no, name, category_id, unlock_condition_type,
                   hatch_mission_count, effective_at, created_by_admin_id)
           VALUES ($1,$2,1,$3,$4,'none',0, now() - interval '1 day', $5)`,
          [versionId, speciesId, `판정펫${tag}`, categoryId, adminId],
        );
        await db.query(
          `INSERT INTO pet_stage_images (id, species_id, r2_object_key, mime_type, size_bytes, uploaded_at, created_by_admin_id)
           VALUES ($1,$2,$3,'image/png',10,now(),$4)`,
          [imageId, speciesId, `pet/dp${tag}.png`, adminId],
        );
        for (const [stage, code, xp] of [
          [1, 'egg', 0],
          [2, 'baby', 100],
          [3, 'adult', 300],
        ]) {
          await db.query(
            `INSERT INTO pet_stage_versions
                    (species_version_id, species_id, stage_no, stage_code, min_total_xp, bonus_basis_points, image_id)
             VALUES ($1,$2,$3,$4,$5,500,$6)`,
            [versionId, speciesId, stage, code, xp, imageId],
          );
        }
        return speciesId;
      };
      const choose = async (speciesId, nickname) =>
        (
          await http
            .post('/api/v1/me/pets')
            .set(auth(user.token))
            .send({ speciesId, nickname, makeRepresentative: true })
            .expect(201)
        ).body;

      const first = await choose(await makeSpecies(), '첫째펫');
      const missionId = await createMission(user);
      const record = await startRecord(user, missionId);
      await http
        .post(`/api/v1/records/${record.id}/submit`)
        .set(auth(user.token))
        .send({ metrics: { a: 1 } })
        .expect(200);

      // 수행을 시작한 뒤 대표 펫을 바꿈
      const second = await choose(await makeSpecies(), '둘째펫');
      await http
        .put('/api/v1/me/pets/representative')
        .set(auth(user.token))
        .send({ petId: second.id })
        .expect(200);

      await ingest(ingestBody(record.id, 'approved')).expect(200);
      const pets = await http
        .get('/api/v1/me/pets')
        .set(auth(user.token))
        .expect(200);
      const byId = Object.fromEntries(pets.body.map((p) => [p.id, p]));
      // 펫 XP 20 + 버프 5%(= floor(20 * 500 / 10000) = 1)
      expect(byId[first.id].totalXp).toBe(21);
      expect(byId[second.id].totalXp).toBe(0);
      const { rows } = await db.query(
        `SELECT recipient_pet_id, bonus_pet_xp, bonus_basis_points FROM experience_awards
          WHERE user_id = $1 AND source_type = 'mission'`,
        [user.id],
      );
      expect(rows).toEqual([
        {
          recipient_pet_id: first.id,
          bonus_pet_xp: 1,
          bonus_basis_points: 500,
        },
      ]);
    });

    it('대표 펫이 없으면 펫 XP는 보류되고, 대표를 정하면 배정', async () => {
      const user = await createUser();
      const { recordId } = await submittedMission(user);
      await ingest(ingestBody(recordId, 'approved')).expect(200);
      const exp = await http
        .get('/api/v1/me/experience')
        .set(auth(user.token))
        .expect(200);
      expect(exp.body).toMatchObject({
        totalXp: 10,
        pendingPetXp: 20,
        representativePet: null,
      });
    });

    it('업적 평가: 승인이 조건을 채우면 지급, 번복으로 무너지면 회수', async () => {
      const user = await createUser();
      const definitionId = randomUUID();
      const tag = next();
      await db.query(
        `INSERT INTO achievement_definitions (id, code, status, created_by_admin_id)
         VALUES ($1,$2,'public',$3)`,
        [definitionId, `dm_${tag}`, adminId],
      );
      const imageId = randomUUID();
      await db.query(
        `INSERT INTO achievement_badge_images
                (id, achievement_id, version_no, r2_object_key, mime_type, size_bytes, uploaded_at, created_by_admin_id)
         VALUES ($1,$2,1,$3,'image/png',10,now() - interval '1 day',$4)`,
        [imageId, definitionId, `badge/dm${tag}`, adminId],
      );
      await db.query(
        `INSERT INTO achievement_versions
                (id, achievement_id, version_no, title, description, rarity, condition_type,
                 target_count, reward_points, badge_image_id, effective_at, created_by_admin_id)
         VALUES ($1,$2,1,'첫 승인','승인 미션 1회','common','approved_mission_count',
                 1,0,$3, now() - interval '1 day', $4)`,
        [randomUUID(), definitionId, imageId, adminId],
      );
      try {
        const { recordId } = await submittedMission(user);
        await ingest(ingestBody(recordId, 'approved')).expect(200);
        const statusOf = async () =>
          (
            await db.query(
              'SELECT status FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
              [user.id, definitionId],
            )
          ).rows[0]?.status;
        expect(await statusOf()).toBe('active');
        await redecide(recordId, 'rejected', '번복');
        expect(await statusOf()).toBe('revoked');
      } finally {
        // 공개로 남으면 이후 다른 스위트의 평가에 섞이므로 숨김 처리
        await db.query(
          `UPDATE achievement_definitions SET status = 'hidden' WHERE id = $1`,
          [definitionId],
        );
      }
    });

    it('승인으로 단계의 필수 미션이 모두 끝나면 종료일이 지난 단계가 완료됨', async () => {
      const user = await createUser();
      const goalId = randomUUID();
      const stepId = randomUUID();
      await db.query(
        `INSERT INTO goals (id, user_id, category_id, difficulty_id, title, start_date, end_date)
         VALUES ($1,$2,$3,$4,'지난 목표','2020-01-01','2020-12-31')`,
        [goalId, user.id, categoryId, difficultyId],
      );
      await db.query(
        `INSERT INTO goal_steps (id, goal_id, step_no, title, due_date) VALUES ($1,$2,1,'지난 단계','2020-03-01')`,
        [stepId, goalId],
      );
      const missionId = await createMission(user);
      await db.query(
        `UPDATE missions SET goal_id = $2, goal_step_id = $3 WHERE id = $1`,
        [missionId, goalId, stepId],
      );
      const recordId = await submittedRecord(user, missionId);
      expect(
        (
          await db.query('SELECT status FROM goal_steps WHERE id = $1', [
            stepId,
          ])
        ).rows[0].status,
      ).toBe('active');

      await ingest(ingestBody(recordId, 'approved')).expect(200);
      expect(
        (
          await db.query('SELECT status FROM goal_steps WHERE id = $1', [
            stepId,
          ])
        ).rows[0].status,
      ).toBe('completed');
      await redecide(recordId, 'rejected', '번복');
      expect(
        (
          await db.query('SELECT status FROM goal_steps WHERE id = $1', [
            stepId,
          ])
        ).rows[0].status,
      ).toBe('active');
    });

    it('유효한 승인 여부가 바뀔 때만 스트릭 훅에 알림, 이력만 남는 경우는 호출하지 않음', async () => {
      const user = await createUser();
      const events = [];
      const unregister = app
        .get(MissionOutcomeNotifier)
        .register(async (t, event) => {
          if (event.userId === user.id) events.push(event);
        });
      try {
        const missionId = await createMission(user);
        const first = await submittedRecord(user, missionId);
        await ingest(ingestBody(first, 'rejected')).expect(200);
        expect(events).toHaveLength(0);

        const second = await submittedRecord(user, missionId);
        await ingest(ingestBody(second, 'approved')).expect(200);
        await redecide(first, 'approved', '인용'); // 이력만
        await redecide(second, 'rejected', '번복'); // 첫째가 유효해 이력만
        await redecide(first, 'rejected', '번복'); // 마지막 승인이 사라짐

        expect(events.map((e) => e.hasValidApproval)).toEqual([true, false]);
        expect(events[0]).toMatchObject({
          userId: user.id,
          missionId,
          scheduledDate: today(),
        });
      } finally {
        unregister();
      }
    });
  });

  describe('원자성', () => {
    it('보상 처리가 실패하면 판정 이력·회차·미션 상태도 모두 롤백되고 같은 키로 다시 보낼 수 있음', async () => {
      const user = await createUser();
      const { missionId, recordId } = await submittedMission(user);
      const body = ingestBody(recordId, 'approved');

      const points = app.get(PointsService);
      const original = points.awardMissionPoints.bind(points);
      points.awardMissionPoints = async () => {
        throw new Error('포인트 서비스 장애');
      };
      try {
        await ingest(body).expect(500);
      } finally {
        points.awardMissionPoints = original;
      }
      expect(await results(recordId)).toEqual([]);
      expect((await recordRow(recordId)).status).toBe('submitted');
      expect(await missionStatus(missionId)).toBe('submitted');
      expect(await wallet(user.id)).toEqual({ available: 0, outstanding: 0 });
      expect(await userXp(user.id)).toBe(0);

      const retry = await ingest(body).expect(200);
      expect(retry.body.status).toBe('applied');
      expect(await wallet(user.id)).toEqual({ available: 100, outstanding: 0 });
    });
  });
});
