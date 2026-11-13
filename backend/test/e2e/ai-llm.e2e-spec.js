import { createServer } from 'node:http';
import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { addDays, kstDate } from '../../src/common/time/kst.js';
import { AiClient } from '../../src/integrations/ai/ai.client.js';
import { createTestApp } from '../support/app.js';
import { createUser as createUserWith } from '../support/users.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);
const SECRET = process.env.INTERNAL_API_TOKEN;

describe.skipIf(!databaseUrl)(
  'AI 서버 연동 I03·I04 (PostgreSQL + 가짜 AI 서버)',
  () => {
    let app;
    let db;
    let http;
    let client;
    let originalConfig;
    let ai;
    let aiPort;
    let aiCalls;
    let aiHandler;
    let ref;
    let definitions;

    const auth = (user) => ({ Authorization: `Bearer ${user.token}` });
    const day = (offset) => addDays(kstDate(), offset);

    beforeAll(async () => {
      ({ app, http, db } = await createTestApp());
      client = app.get(AiClient);
      originalConfig = client.config;

      ai = createServer((request, response) => {
        let raw = '';
        request.on('data', (chunk) => (raw += chunk));
        request.on('end', () => {
          const call = {
            url: request.url,
            headers: request.headers,
            body: raw ? JSON.parse(raw) : null,
          };
          aiCalls.push(call);
          const { status = 200, body, delayMs = 0 } = aiHandler(call);
          setTimeout(() => {
            response.writeHead(status, { 'content-type': 'application/json' });
            response.end(JSON.stringify(body));
          }, delayMs);
        });
      });
      await new Promise((resolve) => ai.listen(0, '127.0.0.1', resolve));
      aiPort = ai.address().port;

      const adminId = newId();
      await db.query(
        `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
        [adminId, `llm_${RUN}`, `${adminId.toLowerCase()}@example.com`],
      );
      const category = newId();
      const difficulty = newId();
      await db.query(
        `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [category, `llc${RUN}`, `LLM카테고리${RUN}`],
      );
      await db.query(
        `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [difficulty, `lld${RUN}`, `LLM난이도${RUN}`],
      );
      await db.query(
        `INSERT INTO mission_reward_rate_versions
              (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,$3,1,100,10,5, now() - interval '1 day', $4)`,
        [newId(), category, difficulty, adminId],
      );
      ref = { categoryCode: `llc${RUN}`, difficultyCode: `lld${RUN}` };
      definitions = [];
      for (const [title, exercise] of [
        ['플랭크 60초', 'plank'],
        ['스쿼트 20개', 'squat'],
      ]) {
        const id = newId();
        definitions.push({ id, title });
        await db.query(
          `INSERT INTO mission_definitions
                (id, origin, title, category_id, difficulty_id, estimated_duration_seconds,
                 verification_method, publication_status, exercise_code,
                 base_points, base_user_xp, base_pet_xp)
         VALUES ($1,'admin',$2,$3,$4,300,'camera','public',$5,70,7,3)`,
          [id, `${title} ${RUN}`, category, difficulty, exercise],
        );
      }
    });

    afterAll(async () => {
      client.config = originalConfig;
      await new Promise((resolve) => ai.close(resolve));
      await app.close();
    });

    beforeEach(() => {
      aiCalls = [];
      aiHandler = () => ({ status: 500, body: {} });
      const overrides = {
        AI_SERVICE_URL: `http://127.0.0.1:${aiPort}`,
        INTERNAL_API_TOKEN: SECRET,
        AI_PLAN_TIMEOUT_MS: 2000,
        AI_RECOMMEND_TIMEOUT_MS: 2000,
      };
      client.config = {
        get: (key) => overrides[key] ?? originalConfig.get(key),
      };
    });

    async function createGoal(user) {
      return (
        await http
          .post('/api/v1/goals')
          .set(auth(user))
          .send({
            title: 'AI 계획 목표',
            categoryCode: ref.categoryCode,
            difficultyCode: ref.difficultyCode,
            startDate: day(0),
            endDate: day(14),
            targetFrequency: 3,
            dailyAvailableMinutes: 30,
          })
          .expect(201)
      ).body;
    }

    /** AI가 돌려줄 GoalPlanResponse */
    const goalPlanResponse = (call) => ({
      ingestKey: call.body.ingestKey,
      engineVersion: 'gemini-goals@0.1.0',
      proposal: {
        summary: '2주 동안 단계적으로 늘려 가요.',
        steps: [
          {
            stepNo: 1,
            title: '몸 풀기',
            description: null,
            dueDate: day(7),
            missions: [
              {
                scheduledDate: day(2),
                title: '스쿼트 15개',
                description: null,
                categoryCode: ref.categoryCode,
                difficultyCode: ref.difficultyCode,
                exerciseCode: 'squat',
                verificationMethod: 'camera',
                targetValue: 15,
                targetUnit: 'reps',
                estimatedDurationSeconds: 600,
                isRequired: true,
              },
            ],
          },
        ],
      },
    });

    describe('I03 계획 생성', () => {
      it('AI 계약대로 요청하고 응답을 제안으로 저장, 수락하면 미션이 만들어짐', async () => {
        const user = await createUserWith(app, db);
        const goal = await createGoal(user);
        aiHandler = (call) => ({ body: goalPlanResponse(call) });

        const res = await http
          .post(`/api/v1/goals/${goal.id}/plan-proposals`)
          .set(auth(user))
          .expect(201);
        expect(res.body).toMatchObject({
          goalId: goal.id,
          generationNo: 1,
          status: 'draft',
          summary: '2주 동안 단계적으로 늘려 가요.',
          engineVersion: 'gemini-goals@0.1.0',
        });
        expect(res.body.steps[0].missions[0].title).toBe('스쿼트 15개');

        const [call] = aiCalls;
        expect(call.url).toBe('/internal/v1/llm/goal-plans');
        expect(call.headers['x-internal-token']).toBe(SECRET);
        expect(call.body).toMatchObject({
          ingestKey: `goal-plan:${goal.id}:1`,
          today: kstDate(),
          goal: {
            title: 'AI 계획 목표',
            categoryCode: ref.categoryCode,
            difficultyCode: ref.difficultyCode,
            startDate: day(0),
            endDate: day(14),
            targetFrequency: 3,
            dailyAvailableMinutes: 30,
          },
          generationNo: 1,
          previousSummary: null,
        });
        expect(call.body.exerciseTypes).toHaveLength(6);

        const accepted = await http
          .post(`/api/v1/plan-proposals/${res.body.id}/accept`)
          .set(auth(user))
          .send({ generationNo: 1 })
          .expect(201);
        expect(accepted.body.createdMissionCount).toBe(1);
        const mission = await http
          .get(`/api/v1/missions?goalId=${goal.id}`)
          .set(auth(user))
          .expect(200);
        expect(mission.body.items[0]).toMatchObject({
          title: '스쿼트 15개',
          exerciseCode: 'squat',
        });
      });

      it('다시 만들면 세대 번호가 늘고 이전 요약을 보냄', async () => {
        const user = await createUserWith(app, db);
        const goal = await createGoal(user);
        aiHandler = (call) => ({ body: goalPlanResponse(call) });
        await http
          .post(`/api/v1/goals/${goal.id}/plan-proposals`)
          .set(auth(user))
          .expect(201);
        const second = await http
          .post(`/api/v1/goals/${goal.id}/plan-proposals`)
          .set(auth(user))
          .expect(201);
        expect(second.body.generationNo).toBe(2);
        expect(aiCalls[1].body).toMatchObject({
          ingestKey: `goal-plan:${goal.id}:2`,
          generationNo: 2,
          previousSummary: '2주 동안 단계적으로 늘려 가요.',
        });
      });

      it.each([
        [
          'AI가 LLM 불가를 알림',
          {
            status: 503,
            body: { detail: { code: 'AI_LLM_UNAVAILABLE', message: 'x' } },
          },
          503,
          'AI_LLM_UNAVAILABLE',
        ],
        [
          'AI가 형식 오류(코드 없는 502)',
          {
            status: 502,
            body: { detail: '계획의 JSON 구조가 올바르지 않습니다.' },
          },
          502,
          'AI_INVALID_OUTPUT',
        ],
        [
          'AI 서버 내부 오류',
          { status: 500, body: { error: { code: 'COMMON_INTERNAL' } } },
          503,
          'AI_LLM_UNAVAILABLE',
        ],
        [
          '응답에 단계가 없음',
          {
            body: { engineVersion: 'x', proposal: { summary: 's', steps: [] } },
          },
          502,
          'AI_INVALID_OUTPUT',
        ],
        ['시간 초과', { body: {}, delayMs: 3000 }, 504, 'AI_TIMEOUT'],
      ])(
        '실패(%s)는 규칙 기반으로 바꾸지 않고 오류를 앱에 전달',
        async (_name, reply, status, code) => {
          const user = await createUserWith(app, db);
          const goal = await createGoal(user);
          aiHandler = () => reply;
          const res = await http
            .post(`/api/v1/goals/${goal.id}/plan-proposals`)
            .set(auth(user))
            .expect(status);
          expect(res.body.error.code).toBe(code);
          await http
            .get(`/api/v1/goals/${goal.id}/plan-proposals/latest`)
            .set(auth(user))
            .expect(404);
        },
      );

      it('AI 설정이 없으면 규칙 기반으로 만듦', async () => {
        client.config = {
          get: (key) =>
            key === 'AI_SERVICE_URL' ? undefined : originalConfig.get(key),
        };
        const user = await createUserWith(app, db);
        const goal = await createGoal(user);
        const res = await http
          .post(`/api/v1/goals/${goal.id}/plan-proposals`)
          .set(auth(user))
          .expect(201);
        expect(res.body.engineVersion).toBe('rule-plan@0.1.0');
        expect(aiCalls).toHaveLength(0);
      });
    });

    describe('I04 상황 추천', () => {
      const ask = (
        user,
        body = { kind: 'weather', latitude: 37.5, longitude: 127 },
      ) =>
        http
          .post('/api/v1/recommendations/situational')
          .set(auth(user))
          .send(body);

      /** 받은 후보를 뒤집어 순서대로 추천하는 AI */
      const reverseAi = (call) => ({
        body: {
          ingestKey: call.body.ingestKey,
          engineVersion: 'gemini-recommend@0.1.0',
          items: [...call.body.candidates]
            .reverse()
            .slice(0, call.body.maxResults)
            .map((candidate, index) => ({
              rankNo: index + 1,
              definitionId: candidate.definitionId,
              reason: `AI 이유 ${index + 1}`,
            })),
        },
      });

      it('후보·프로필·상황을 보내고 AI가 고른 순서와 이유로 저장', async () => {
        const user = await createUserWith(app, db);
        await createGoal(user);
        aiHandler = reverseAi;

        const res = await ask(user).expect(201);
        expect(aiCalls).toHaveLength(1);
        const [call] = aiCalls;
        expect(call.url).toBe('/internal/v1/llm/situational-recommendations');
        expect(call.body.context).toMatchObject({
          weather: 'clear',
          temperatureC: 20,
          kind: 'weather',
          isMoving: false,
        });
        expect(JSON.stringify(call.body)).not.toMatch(/latitude|longitude/);
        expect(call.body.profile).toMatchObject({
          activeGoalCategories: [ref.categoryCode],
          streakDays: 0,
          recentExerciseCount: 0,
          availableMinutes: 30,
        });
        const sent = call.body.candidates.map((c) => c.definitionId);
        for (const def of definitions) expect(sent).toContain(def.id);
        expect(call.body.maxResults).toBe(3);

        // 첫 추천은 AI가 1순위로 고른 후보, 이유도 AI 문구
        expect(res.body[0].missionDefinition.id).toBe(
          call.body.candidates.at(-1).definitionId,
        );
        expect(res.body[0].reason).toBe('AI 이유 1');

        const run = await db.query(
          `SELECT engine_version FROM ai_analysis_runs
          WHERE user_id = $1 AND run_type = 'situational_recommendation'`,
          [user.id],
        );
        expect(run.rows[0].engine_version).toBe('gemini-recommend@0.1.0');
      });

      it.each([
        [
          'AI 오류',
          { status: 503, body: { detail: { code: 'AI_LLM_UNAVAILABLE' } } },
        ],
        ['형식 오류(502)', { status: 502, body: { detail: 'x' } }],
        [
          '후보 밖의 id',
          {
            body: {
              engineVersion: 'v',
              items: [{ rankNo: 1, definitionId: newId(), reason: 'x' }],
            },
          },
        ],
        ['시간 초과', { body: {}, delayMs: 3000 }],
      ])('AI 실패(%s)면 규칙 기반 추천으로 대체', async (_name, reply) => {
        const user = await createUserWith(app, db);
        aiHandler = () => reply;
        const res = await ask(user).expect(201);
        expect(aiCalls).toHaveLength(1);
        expect(res.body.length).toBeGreaterThan(0);
        const run = await db.query(
          `SELECT engine_version FROM ai_analysis_runs
          WHERE user_id = $1 AND run_type = 'situational_recommendation'`,
          [user.id],
        );
        expect(run.rows[0].engine_version).toBe('rule-rec@0.1.0');
      });

      it('AI 설정이 없으면 호출 없이 규칙 기반', async () => {
        client.config = {
          get: (key) =>
            key === 'AI_SERVICE_URL' ? undefined : originalConfig.get(key),
        };
        const user = await createUserWith(app, db);
        const res = await ask(user).expect(201);
        expect(aiCalls).toHaveLength(0);
        expect(res.body.length).toBeGreaterThan(0);
      });

      it('10분 제한은 AI를 부르기 전에 확인', async () => {
        const user = await createUserWith(app, db);
        aiHandler = reverseAi;
        await ask(user).expect(201);
        aiCalls.length = 0;
        await ask(user).expect(429);
        expect(aiCalls).toHaveLength(0);
      });
    });
  },
);
