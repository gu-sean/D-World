import { createServer } from 'node:http';
import { randomInt, randomUUID } from 'node:crypto';
import { addDays, kstDate } from '../../src/common/time/kst.js';
import { AiClient } from '../../src/integrations/ai/ai.client.js';
import { OBJECT_STORAGE } from '../../src/media/storage/object-storage.js';
import { AiDispatchService } from '../../src/verification/ai/ai-dispatch.service.js';
import { HttpAiDispatcher } from '../../src/verification/ai/ai-dispatcher.js';
import { createTestApp } from '../support/app.js';
import { createUser as createUserWith } from '../support/users.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);
const SECRET = process.env.INTERNAL_API_TOKEN;
const CHECKSUM = 'ab'.repeat(32);

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
          const { status, body } = aiRespond();
          response.writeHead(status, { 'content-type': 'application/json' });
          response.end(JSON.stringify(body));
        });
      });
      await new Promise((resolve) => ai.listen(0, '127.0.0.1', resolve));
      aiPort = ai.address().port;

      const adminId = randomUUID();
      await db.query(
        `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
        [adminId, `ai_${RUN}`, `${adminId}@example.com`],
      );
      const category = randomUUID();
      const difficulty = randomUUID();
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
        [randomUUID(), category, difficulty, adminId],
      );
      await db.query(
        `INSERT INTO verification_criteria_versions
              (id, category_id, verification_method, version_no, rules_json, effective_at,
               created_by_admin_id)
       VALUES ($1,$2,'camera',1,'{"minReps":5}'::jsonb, now() - interval '30 days', $3)`,
        [randomUUID(), category, adminId],
      );
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
        recordId: randomUUID(),
      }).expect(404);
    });

    it('콜백 인증·형식 검증', async () => {
      const body = {
        ingestKey: 'vision:abc:1',
        recordId: randomUUID(),
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
