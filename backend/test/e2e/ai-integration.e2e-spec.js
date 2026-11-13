import { createServer } from 'node:http';
import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { addDays, kstDate } from '../../src/common/time/kst.js';
import { AiClient } from '../../src/integrations/ai/ai.client.js';
import { firstLevelUpXp } from '../../src/experience-pets/experience-ledger.js';
import { OBJECT_STORAGE } from '../../src/media/storage/object-storage.js';
import { AiDispatchService } from '../../src/verification/ai/ai-dispatch.service.js';
import { HttpAiDispatcher } from '../../src/verification/ai/ai-dispatcher.js';
import { createTestApp } from '../support/app.js';
import { createUser as createUserWith } from '../support/users.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);
const SECRET = process.env.INTERNAL_API_TOKEN;
const CHECKSUM = 'ab'.repeat(32);

/**
 * 승인(경험치 지급)에는 발효된 사용자·펫 레벨 정책이 필요하다. 마이그레이션만 한 빈 DB에는 없으므로 없을 때만 넣는다.
 * 다른 e2e 파일이 만드는 정책(1일 전)이 항상 더 최신이 되도록 오래된 시각(30일 전)으로 둔다.
 */
async function ensureLevelPolicies(db, adminId) {
  for (const [table, thresholds] of [
    [
      'user_level',
      [
        [1, 0],
        [2, 100],
      ],
    ],
    [
      'pet_level',
      [
        [1, 0],
        [2, 40],
        [3, 120],
        [4, 400],
      ],
    ],
  ]) {
    const { rowCount } = await db.query(
      `SELECT 1 FROM ${table}_policy_versions WHERE effective_at <= now() LIMIT 1`,
    );
    if (rowCount > 0) continue;
    const policyId = newId();
    await db.query(
      `INSERT INTO ${table}_policy_versions (id, version_no, effective_at, created_by_admin_id)
       VALUES ($1, $2, now() - interval '30 days', $3)`,
      [policyId, randomInt(1, 1_000_000_000), adminId],
    );
    for (const [level, xp] of thresholds) {
      await db.query(
        `INSERT INTO ${table}_thresholds (policy_version_id, level_no, min_total_xp) VALUES ($1, $2, $3)`,
        [policyId, level, xp],
      );
    }
  }
}

describe.skipIf(!databaseUrl)(
  'AI 서버 연동 I01 (PostgreSQL + 가짜 AI 서버)',
  () => {
    let app;
    let db;
    let http;
    let service;
    let storage;
    let ai; // 가짜 AI 서버
    let aiPort;
    let aiCalls;
    let aiRespond;
    let categoryCode;

    const auth = (user) => ({ Authorization: `Bearer ${user.token}` });
    const MB = 1024 * 1024;

    beforeAll(async () => {
      ({ app, http, db } = await createTestApp());
      service = app.get(AiDispatchService);
      storage = app.get(OBJECT_STORAGE);

      ai = createServer((request, response) => {
        let raw = '';
        request.on('data', (chunk) => (raw += chunk));
        request.on('end', () => {
          aiCalls.push({
            url: request.url,
            headers: request.headers,
            body: raw ? JSON.parse(raw) : null,
          });
          const { status, body } = aiRespond(raw ? JSON.parse(raw) : null);
          response.writeHead(status, { 'content-type': 'application/json' });
          response.end(JSON.stringify(body));
        });
      });
      await new Promise((resolve) => ai.listen(0, '127.0.0.1', resolve));
      aiPort = ai.address().port;

      const adminId = newId();
      await db.query(
        `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
        [adminId, `ai_${RUN}`, `${adminId.toLowerCase()}@example.com`],
      );
      const category = newId();
      const difficulty = newId();
      categoryCode = `aic${RUN}`;
      await db.query(
        `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [category, categoryCode, `AI카테고리${RUN}`],
      );
      await db.query(
        `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [difficulty, `aid${RUN}`, `AI난이도${RUN}`],
      );
      await db.query(
        `INSERT INTO mission_reward_rate_versions
              (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,$3,1,100,10,5, now() - interval '1 day', $4)`,
        [newId(), category, difficulty, adminId],
      );
      await db.query(
        `INSERT INTO verification_criteria_versions
              (id, category_id, verification_method, version_no, rules_json, effective_at,
               created_by_admin_id)
       VALUES ($1,$2,'camera',1,'{"minReps":5}'::jsonb, now() - interval '30 days', $3)`,
        [newId(), category, adminId],
      );
      await db.query(
        `INSERT INTO verification_criteria_versions
              (id, category_id, verification_method, version_no, rules_json, effective_at,
               created_by_admin_id)
       VALUES ($1,$2,'sensor',1,'{"minDurationSeconds":300}'::jsonb, now() - interval '30 days', $3)`,
        [newId(), category, adminId],
      );
      await ensureLevelPolicies(db, adminId);
    });

    afterAll(async () => {
      await new Promise((resolve) => ai.close(resolve));
      await app.close();
    });

    beforeEach(() => {
      aiCalls = [];
      aiRespond = () => ({ status: 202, body: { status: 'accepted' } });
      service.attempts.clear();
      // 실제 어댑터가 가짜 AI 서버로 나가도록 연결
      service.dispatcher = new HttpAiDispatcher(
        new AiClient({
          get: (key) =>
            ({
              AI_SERVICE_URL: `http://127.0.0.1:${aiPort}`,
              INTERNAL_API_TOKEN: SECRET,
              PORT: 3000,
              BACKEND_PUBLIC_URL: 'http://backend.test',
            })[key],
        }),
      );
    });

    /** 사용자, 오늘 카메라 미션(스쿼트), 시작한 회차 */
    async function startedRecord({ exerciseCode = 'squat' } = {}) {
      const user = await createUserWith(app, db);
      const mission = await http
        .post('/api/v1/missions')
        .set(auth(user))
        .send({
          title: '스쿼트 20개',
          categoryCode,
          difficultyCode: `aid${RUN}`,
          exerciseCode,
          verificationMethod: 'camera',
          targetValue: 20,
          targetUnit: 'reps',
          scheduledDate: kstDate(),
        })
        .expect(201);
      const record = await http
        .post(`/api/v1/missions/${mission.body.id}/records`)
        .set(auth(user))
        .expect(201);
      return { user, mission: mission.body, record: record.body };
    }

    async function uploadAndSubmit(
      { user, record },
      {
        mediaKind = 'camera_video',
        mimeType = 'video/mp4',
        checksum = CHECKSUM,
      } = {},
    ) {
      const ticket = await http
        .post(`/api/v1/mission-records/${record.id}/media`)
        .set(auth(user))
        .send({
          mediaKind,
          mimeType,
          sizeBytes: MB,
          ...(checksum ? { checksumSha256: checksum } : {}),
        })
        .expect(201);
      const { rows } = await db.query(
        'SELECT object_key FROM media_files WHERE id = $1',
        [ticket.body.mediaId],
      );
      storage.simulateUpload(rows[0].object_key, {
        size: MB,
        contentType: mimeType,
        checksumSha256: checksum,
      });
      await http
        .post(`/api/v1/media/${ticket.body.mediaId}/complete`)
        .set(auth(user))
        .expect(200);
      await http
        .post(`/api/v1/mission-records/${record.id}/submit`)
        .set(auth(user))
        .send({ evidenceKind: 'camera_media' })
        .expect(202);
      return { mediaId: ticket.body.mediaId, objectKey: rows[0].object_key };
    }

    const statusOf = async (recordId) =>
      (
        await db.query('SELECT status FROM mission_records WHERE id = $1', [
          recordId,
        ])
      ).rows[0].status;

    const callback = (path, body) =>
      http.post(path).set('x-internal-token', SECRET).send(body);

    it('A19 운동 종류 6종', async () => {
      const user = await createUserWith(app, db);
      const res = await http
        .get('/api/v1/exercise-types')
        .set(auth(user))
        .expect(200);
      expect(res.body.map((t) => t.code)).toEqual([
        'push_up',
        'burpee',
        'squat',
        'lunge',
        'plank',
        'running',
      ]);
      expect(res.body[0]).toEqual({
        code: 'push_up',
        name: '푸시업',
        verificationMethod: 'camera',
        targetUnit: 'reps',
        minTarget: 1,
        maxTarget: 100,
      });
      expect(res.body.at(-1)).toMatchObject({
        verificationMethod: 'sensor',
        targetUnit: 'meters',
      });
      await http.get('/api/v1/exercise-types').expect(401);
    });

    /** 러닝 센서 회차: 센서 미션(러닝 3km), 시작·기록 파일 업로드·제출 */
    async function submittedRun() {
      const user = await createUserWith(app, db);
      const mission = await http
        .post('/api/v1/missions')
        .set(auth(user))
        .send({
          title: '러닝 3km',
          categoryCode,
          difficultyCode: `aid${RUN}`,
          exerciseCode: 'running',
          verificationMethod: 'sensor',
          targetValue: 3000,
          targetUnit: 'meters',
          scheduledDate: kstDate(),
        })
        .expect(201);
      const record = await http
        .post(`/api/v1/missions/${mission.body.id}/records`)
        .set(auth(user))
        .expect(201);
      const ticket = await http
        .post(`/api/v1/mission-records/${record.body.id}/media`)
        .set(auth(user))
        .send({
          mediaKind: 'sensor_raw',
          mimeType: 'application/gzip',
          sizeBytes: MB,
          checksumSha256: CHECKSUM,
        })
        .expect(201);
      const { rows } = await db.query(
        'SELECT object_key FROM media_files WHERE id = $1',
        [ticket.body.mediaId],
      );
      storage.simulateUpload(rows[0].object_key, {
        size: MB,
        contentType: 'application/gzip',
        checksumSha256: CHECKSUM,
      });
      await http
        .post(`/api/v1/media/${ticket.body.mediaId}/complete`)
        .set(auth(user))
        .expect(200);
      await http
        .post(`/api/v1/mission-records/${record.body.id}/submit`)
        .set(auth(user))
        .send({
          evidenceKind: 'sensor_raw',
          clientMetrics: {
            distanceMeters: 3100,
            activeSeconds: 1200,
            appVersion: '1.0.0',
          },
        })
        .expect(202);
      return {
        user,
        mission: mission.body,
        record: record.body,
        mediaId: ticket.body.mediaId,
        objectKey: rows[0].object_key,
      };
    }

    const sensorDispatcher = (enabled) => {
      service.dispatcher = new HttpAiDispatcher(
        new AiClient({
          get: (key) =>
            ({
              AI_SERVICE_URL: `http://127.0.0.1:${aiPort}`,
              INTERNAL_API_TOKEN: SECRET,
              PORT: 3000,
              BACKEND_PUBLIC_URL: 'http://backend.test',
              AI_SENSOR_ENABLED: enabled,
            })[key],
        }),
      );
    };
    const recordStatus = async (recordId) =>
      (
        await db.query('SELECT status FROM mission_records WHERE id = $1', [
          recordId,
        ])
      ).rows[0].status;
    const sensorAnswer = (req, decision, confidence = 0) => ({
      status: 200,
      body: {
        ingestKey: req.ingestKey,
        decision,
        confidence,
        reason: '개발용 규칙 결과',
        engineVersion: 'sensor-run-dev@0.1.0',
        metrics: { exerciseCode: 'running', distanceMeters: 3050, flags: [] },
      },
    });

    it('I02 센서: AI_SENSOR_ENABLED가 꺼져 있으면 AI를 부르지 않고 관리자 검수', async () => {
      const ctx = await submittedRun();
      sensorDispatcher(false);
      await service.dispatchPending({ limit: 1000 });
      expect(aiCalls.some((c) => c.body?.recordId === ctx.record.id)).toBe(
        false,
      );
      expect(await recordStatus(ctx.record.id)).toBe('review_required');
    });

    it('I02 센서: 계약 본문으로 동기 호출하고 응답을 판정으로 저장', async () => {
      const ctx = await submittedRun();
      sensorDispatcher(true);
      aiRespond = (req) => sensorAnswer(req, 'review_required');
      await service.dispatchPending({ limit: 1000 });

      const call = aiCalls.find((c) => c.body?.recordId === ctx.record.id);
      expect(call.url).toBe('/internal/v1/sensor/evaluations');
      expect(call.headers['x-internal-token']).toBe(SECRET);
      expect(call.body).toEqual({
        ingestKey: `sensor:${ctx.record.id}:1`,
        recordId: ctx.record.id,
        exerciseCode: 'running',
        targetValue: 3000,
        targetUnit: 'meters',
        media: [
          {
            mediaId: ctx.mediaId,
            objectKey: ctx.objectKey,
            mimeType: 'application/gzip',
            mediaKind: 'sensor_raw',
            sizeBytes: MB,
            checksumSha256: CHECKSUM,
          },
        ],
        recordStartedAt: expect.any(String),
        submittedAt: expect.any(String),
        clientMetrics: {
          distanceMeters: 3100,
          activeSeconds: 1200,
          appVersion: '1.0.0',
        },
        duplicateOfMediaId: null,
        criteria: {
          versionId: expect.any(String),
          rules: { minDurationSeconds: 300 },
        },
      });
      const { rows } = await db.query(
        'SELECT source, decision, engine_version FROM verification_results WHERE record_id = $1',
        [ctx.record.id],
      );
      expect(rows).toEqual([
        {
          source: 'ai',
          decision: 'review_required',
          engine_version: 'sensor-run-dev@0.1.0',
        },
      ]);
      expect(await recordStatus(ctx.record.id)).toBe('review_required');
    });

    it('I02 센서: 승인 응답이면 미션이 완료됨', async () => {
      const ctx = await submittedRun();
      sensorDispatcher(true);
      aiRespond = (req) => sensorAnswer(req, 'approved', 0.9);
      await service.dispatchPending({ limit: 1000 });
      const mission = await http
        .get(`/api/v1/missions/${ctx.mission.id}`)
        .set(auth(ctx.user))
        .expect(200);
      expect(mission.body.status).toBe('completed');
    });

    it('I02 센서: AI 오류·계약과 다른 응답은 관리자 검수 (판정 행 없음)', async () => {
      for (const respond of [
        () => ({ status: 404, body: { detail: 'Not Found' } }),
        () => ({ status: 200, body: { decision: 'maybe' } }),
      ]) {
        const ctx = await submittedRun();
        sensorDispatcher(true);
        aiRespond = respond;
        await service.dispatchPending({ limit: 1000 });
        expect(await recordStatus(ctx.record.id)).toBe('review_required');
        const { rows } = await db.query(
          'SELECT 1 FROM verification_results WHERE record_id = $1',
          [ctx.record.id],
        );
        expect(rows).toHaveLength(0);
      }
    });

    it('I01 요청: AI 경로·헤더·계약 본문으로 보냄', async () => {
      const ctx = await startedRecord();
      const media = await uploadAndSubmit(ctx);

      const result = await service.dispatchPending({ limit: 1000 });
      expect(result.sent).toBeGreaterThanOrEqual(1);

      const call = aiCalls.find((c) => c.body.recordId === ctx.record.id);
      expect(call.url).toBe('/internal/v1/vision/analyses');
      expect(call.headers['x-internal-token']).toBe(SECRET);
      expect(call.headers['x-request-id']).toEqual(expect.any(String));
      expect(call.body).toEqual({
        ingestKey: `vision:${ctx.record.id}:1`,
        recordId: ctx.record.id,
        missionId: ctx.mission.id,
        submissionNo: 1,
        categoryCode,
        exerciseCode: 'squat',
        targetValue: 20,
        targetUnit: 'reps',
        media: [
          {
            mediaId: media.mediaId,
            objectKey: media.objectKey,
            mimeType: 'video/mp4',
            mediaKind: 'camera_video',
            sizeBytes: MB,
            checksumSha256: CHECKSUM,
          },
        ],
        recordStartedAt: expect.any(String),
        submittedAt: expect.any(String),
        duplicateOfMediaId: null,
        criteria: { versionId: expect.any(String), rules: { minReps: 5 } },
        callbackUrl: 'http://backend.test/internal/v1/ai-callbacks',
      });
      expect(await statusOf(ctx.record.id)).toBe('submitted');
    });

    it('AI가 일시적으로 거절(용량 초과)하면 재시도, 영구 거절(400)이면 바로 관리자 검수', async () => {
      const busy = await startedRecord();
      await uploadAndSubmit(busy);
      aiRespond = () => ({
        status: 503,
        body: {
          error: { code: 'AI_VISION_BUSY', message: 'x', details: null },
        },
      });
      const first = await service.dispatchPending({ limit: 1000 });
      expect(first.failed).toBeGreaterThanOrEqual(1);
      expect(await statusOf(busy.record.id)).toBe('submitted');

      const invalid = await startedRecord();
      await uploadAndSubmit(invalid);
      service.attempts.clear();
      aiRespond = () => ({
        status: 400,
        body: {
          error: { code: 'AI_INVALID_REQUEST', message: 'x', details: null },
        },
      });
      const second = await service.dispatchPending({ limit: 1000 });
      expect(second.gaveUp).toBeGreaterThanOrEqual(1);
      expect(await statusOf(invalid.record.id)).toBe('review_required');
    });

    it('체크섬이 없는 파일은 AI에 보내지 않고 관리자 검수로 넘김', async () => {
      const ctx = await startedRecord();
      await uploadAndSubmit(ctx, { checksum: null });
      const result = await service.dispatchPending({ limit: 1000 });
      expect(result.gaveUp).toBeGreaterThanOrEqual(1);
      expect(aiCalls.some((c) => c.body.recordId === ctx.record.id)).toBe(
        false,
      );
      expect(await statusOf(ctx.record.id)).toBe('review_required');
    });

    it('콜백(AI 모양): 완료 → 판정 저장, 같은 ingestKey 재전송은 첫 결과', async () => {
      const ctx = await startedRecord();
      await uploadAndSubmit(ctx);
      const body = {
        ingestKey: `vision:${ctx.record.id}:1`,
        recordId: ctx.record.id,
        status: 'completed',
        decision: 'review_required',
        reason: '운동 알고리즘 정확도 검증 전이므로 수동 검토가 필요합니다.',
        engineVersion: 'vision-rule@0.1.0',
        metrics: {
          exerciseCode: 'squat',
          repCount: 18,
          personDetected: true,
          mediaSha256: CHECKSUM,
          flags: ['algorithm_unverified'],
          issues: [],
        },
      };
      const first = await callback('/internal/v1/ai-callbacks', body).expect(
        200,
      );
      expect(first.body).toMatchObject({ status: 'applied' });

      const { rows } = await db.query(
        `SELECT decision, engine_version, ingest_key, metrics, raw_result, criteria_version_id
         FROM verification_results WHERE record_id = $1`,
        [ctx.record.id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        decision: 'review_required',
        engine_version: 'vision-rule@0.1.0',
        ingest_key: body.ingestKey,
      });
      expect(rows[0].metrics.repCount).toBe(18);
      expect(rows[0].raw_result.status).toBe('completed');
      expect(rows[0].criteria_version_id).toEqual(expect.any(String));
      expect(await statusOf(ctx.record.id)).toBe('review_required');

      const again = await callback('/internal/v1/ai-callbacks', body).expect(
        200,
      );
      expect(again.body.status).toBe('duplicate');
    });

    it('콜백: 승인 판정이면 미션이 완료됨(기존 경로도 동일하게 동작)', async () => {
      const ctx = await startedRecord();
      await uploadAndSubmit(ctx);
      await callback('/internal/v1/ai-callbacks/verification-results', {
        ingestKey: `vision:${ctx.record.id}:1`,
        recordId: ctx.record.id,
        decision: 'approved',
        engineVersion: 'model-v1',
        confidence: 0.93,
        rawResult: {},
      }).expect(200);
      const mission = await http
        .get(`/api/v1/missions/${ctx.mission.id}`)
        .set(auth(ctx.user))
        .expect(200);
      expect(mission.body.status).toBe('completed');
    });

    it('콜백: 승인되면 지급한 보상이 회차 조회(A41)의 rewards로 내려감', async () => {
      const ctx = await startedRecord();
      await uploadAndSubmit(ctx);
      const pending = await http
        .get(`/api/v1/mission-records/${ctx.record.id}`)
        .set(auth(ctx.user))
        .expect(200);
      expect(pending.body.rewards).toBeNull();

      await callback('/internal/v1/ai-callbacks', {
        ingestKey: `vision:${ctx.record.id}:1`,
        recordId: ctx.record.id,
        status: 'completed',
        decision: 'approved',
        confidence: 0.95,
        engineVersion: 'vision-rule@0.1.0',
      }).expect(200);

      const done = await http
        .get(`/api/v1/mission-records/${ctx.record.id}`)
        .set(auth(ctx.user))
        .expect(200);
      expect(Object.keys(done.body.rewards).sort()).toEqual(
        [
          'levelUp',
          'newBadges',
          'newLevelNo',
          'petEvolved',
          'petId',
          'points',
          'pointsCapped',
          'streakDays',
          'userXp',
          'petXp',
        ].sort(),
      );
      expect(done.body.rewards).toMatchObject({
        userXp: 10,
        petId: null,
        levelUp: false,
        newLevelNo: null,
        petEvolved: false,
        newBadges: expect.any(Array),
      });
      // 지급 기록과 같은 값
      const { rows } = await db.query(
        'SELECT paid_points FROM mission_point_awards WHERE mission_id = $1',
        [ctx.mission.id],
      );
      expect(done.body.rewards.points).toBe(rows[0].paid_points);
      expect(done.body.rewards.streakDays).toBeGreaterThanOrEqual(1);
      // 저장된 값(metrics.rewards)이 그대로 쓰임
      const stored = await db.query(
        `SELECT metrics->'rewards'->>'userXp' AS xp FROM mission_records WHERE id = $1`,
        [ctx.record.id],
      );
      expect(stored.rows[0].xp).toBe('10');
    });

    it('이전 기록(metrics.rewards 없음)의 rewards는 원장에서 복원되고, 승인 때 저장한 값과 같음(레벨업 포함)', async () => {
      const ctx = await startedRecord();
      // 이 승인 한 번(userXp 10)으로 레벨 2가 되도록 다음 레벨 기준에서 5 모자란 상태로 만든다
      const next = await firstLevelUpXp(db);
      if (next === null) {
        throw new Error(
          '레벨 정책(user_level_policy_versions)이 있는 DB가 필요함',
        );
      }
      const policy = await db.query(
        `SELECT id FROM user_level_policy_versions
          WHERE effective_at <= now() ORDER BY effective_at DESC LIMIT 1`,
      );
      await db.query(
        `INSERT INTO user_experience (user_id, level_policy_version_id, total_xp, level_no)
         VALUES ($1, $2, $3, 1)`,
        [ctx.user.id, policy.rows[0].id, next - 5],
      );

      await uploadAndSubmit(ctx);
      await callback('/internal/v1/ai-callbacks', {
        ingestKey: `vision:${ctx.record.id}:1`,
        recordId: ctx.record.id,
        status: 'completed',
        decision: 'approved',
        confidence: 0.95,
        engineVersion: 'vision-rule@0.1.0',
      }).expect(200);

      const read = async () =>
        (
          await http
            .get(`/api/v1/mission-records/${ctx.record.id}`)
            .set(auth(ctx.user))
            .expect(200)
        ).body.rewards;
      const stored = await read();
      expect(stored).toMatchObject({
        userXp: 10,
        levelUp: true,
        newLevelNo: 2,
      });

      // 저장분을 지우면 지급 기록·원장에서 다시 만들고, 결과가 승인 때 저장한 값과 같아야 함
      await db.query(
        `UPDATE mission_records SET metrics = metrics - 'rewards' WHERE id = $1`,
        [ctx.record.id],
      );
      const restored = await read();
      expect(restored).toEqual(stored);
    });

    it('콜백: 분석 실패(status=failed)는 판정 없이 관리자 검수로, 재전송·늦은 도착은 무시', async () => {
      const ctx = await startedRecord();
      await uploadAndSubmit(ctx);
      const body = {
        ingestKey: `vision:${ctx.record.id}:1`,
        recordId: ctx.record.id,
        status: 'failed',
        engineVersion: 'vision-rule@0.1.0',
        failureReason: 'AI_VIDEO_ANALYSIS_FAILED',
      };
      const first = await callback('/internal/v1/ai-callbacks', body).expect(
        200,
      );
      expect(first.body).toEqual({
        status: 'failed_handled',
        recordStatus: 'review_required',
      });
      expect(await statusOf(ctx.record.id)).toBe('review_required');
      const results = await db.query(
        'SELECT 1 FROM verification_results WHERE record_id = $1',
        [ctx.record.id],
      );
      expect(results.rows).toHaveLength(0);

      const again = await callback('/internal/v1/ai-callbacks', body).expect(
        200,
      );
      expect(again.body.status).toBe('ignored');
      await callback('/internal/v1/ai-callbacks', {
        ...body,
        recordId: newId(),
      }).expect(404);
    });

    it('콜백 인증·형식 검증', async () => {
      const body = {
        ingestKey: 'vision:abc:1',
        recordId: newId(),
        status: 'completed',
        engineVersion: 'v',
      };
      await http.post('/internal/v1/ai-callbacks').send(body).expect(401);
      await http
        .post('/internal/v1/ai-callbacks')
        .set('x-internal-token', 'wrong-token')
        .send(body)
        .expect(401);
      // 완료인데 decision이 없음
      await callback('/internal/v1/ai-callbacks', body).expect(400);
      await callback('/internal/v1/ai-callbacks', {
        ...body,
        decision: 'maybe',
      }).expect(400);
    });

    it('제출 날짜 범위: 어제 미션은 만들 수 없음(회차 시작 전제 확인)', async () => {
      // 테스트 전제(오늘 미션만 시작 가능)가 바뀌면 위 시나리오가 깨지므로 가드
      const user = await createUserWith(app, db);
      await http
        .post('/api/v1/missions')
        .set(auth(user))
        .send({
          title: '어제',
          categoryCode,
          difficultyCode: `aid${RUN}`,
          verificationMethod: 'camera',
          scheduledDate: addDays(kstDate(), -1),
        })
        .expect((res) => expect(res.status).toBeGreaterThanOrEqual(400));
    });
  },
);
