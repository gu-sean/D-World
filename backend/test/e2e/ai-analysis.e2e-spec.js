import { createServer } from 'node:http';
import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { addDays, kstDate } from '../../src/common/time/kst.js';
import { AiReportsService } from '../../src/ai-analysis/ai-reports.service.js';
import { PlanAdjustmentRunsService } from '../../src/ai-analysis/plan-adjustment-runs.service.js';
import { AiClient } from '../../src/integrations/ai/ai.client.js';
import { createTestApp } from '../support/app.js';
import { createUser as createUserWith } from '../support/users.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);
const SECRET = process.env.INTERNAL_API_TOKEN;

// 다른 테스트 데이터와 섞이지 않게 먼 미래의 월요일 기준으로 "오늘"을 정한다
const BASE = addDays('2040-01-02', (RUN % 2000) * 7); // 2040-01-02는 월요일
const TODAY = addDays(BASE, 8); // 다음 주 화요일
const WEEK = { start: BASE, end: addDays(BASE, 6) };

describe.skipIf(!databaseUrl)(
  'AI 리포트 I05·재조정 I06 (PostgreSQL + 가짜 AI 서버)',
  () => {
    let app;
    let db;
    let http;
    let client;
    let originalConfig;
    let reports;
    let adjustments;
    let ai;
    let aiPort;
    let aiCalls;
    let aiReply;
    let ref;

    const auth = (user) => ({ Authorization: `Bearer ${user.token}` });
    const callback = (path, body) =>
      http
        .post(`/internal/v1/ai-callbacks/${path}`)
        .set('x-internal-token', SECRET)
        .send(body);

    beforeAll(async () => {
      ({ app, http, db } = await createTestApp());
      client = app.get(AiClient);
      originalConfig = client.config;
      reports = app.get(AiReportsService);
      adjustments = app.get(PlanAdjustmentRunsService);

      ai = createServer((request, response) => {
        let raw = '';
        request.on('data', (chunk) => (raw += chunk));
        request.on('end', () => {
          aiCalls.push({
            url: request.url,
            headers: request.headers,
            body: raw ? JSON.parse(raw) : null,
          });
          const { status, body } = aiReply();
          response.writeHead(status, { 'content-type': 'application/json' });
          response.end(JSON.stringify(body));
        });
      });
      await new Promise((resolve) => ai.listen(0, '127.0.0.1', resolve));
      aiPort = ai.address().port;

      const adminId = newId();
      await db.query(
        `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
        [adminId, `an_${RUN}`, `${adminId.toLowerCase()}@example.com`],
      );
      const category = newId();
      const difficulty = newId();
      await db.query(
        `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [category, `anc${RUN}`, `분석카테고리${RUN}`],
      );
      await db.query(
        `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [difficulty, `and${RUN}`, `분석난이도${RUN}`],
      );
      await db.query(
        `INSERT INTO mission_reward_rate_versions
              (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,$3,1,100,10,5, now() - interval '1 day', $4)`,
        [newId(), category, difficulty, adminId],
      );
      ref = { categoryCode: `anc${RUN}`, difficultyCode: `and${RUN}` };
    });

    afterAll(async () => {
      client.config = originalConfig;
      await new Promise((resolve) => ai.close(resolve));
      await app.close();
    });

    beforeEach(() => {
      aiCalls = [];
      aiReply = () => ({ status: 202, body: { status: 'accepted' } });
      reports.attempts.clear();
      adjustments.attempts.clear();
      const overrides = {
        AI_SERVICE_URL: `http://127.0.0.1:${aiPort}`,
        INTERNAL_API_TOKEN: SECRET,
        BACKEND_PUBLIC_URL: 'http://backend.test',
      };
      client.config = {
        get: (key) => overrides[key] ?? originalConfig.get(key),
      };
    });

    /** 오늘 미션을 API로 만든 뒤 날짜·상태를 바꿔 "지난주 기록"으로 만든다 */
    async function missionOn(
      user,
      { date, status = 'scheduled', goalId } = {},
    ) {
      const made = await http
        .post('/api/v1/missions')
        .set(auth(user))
        .send({
          title: '스쿼트 20개',
          categoryCode: ref.categoryCode,
          difficultyCode: ref.difficultyCode,
          exerciseCode: 'squat',
          verificationMethod: 'camera',
          targetValue: 20,
          targetUnit: 'reps',
          scheduledDate: kstDate(),
          ...(goalId ? { goalId } : {}),
        })
        .expect(201);
      await db.withTransaction(async (tx) => {
        await tx.query('SET LOCAL session_replication_role = replica');
        await tx.query(
          `UPDATE missions
            SET scheduled_date = $2::date, status = $3,
                due_at = ($2::date + 1)::timestamptz
          WHERE id = $1`,
          [made.body.id, date, status],
        );
      });
      return made.body;
    }

    const callsTo = (path) => aiCalls.filter((c) => c.url.endsWith(path));
    const runOf = async (userId, type) =>
      (
        await db.query(
          `SELECT * FROM ai_analysis_runs WHERE user_id = $1 AND run_type = $2`,
          [userId, type],
        )
      ).rows[0];

    describe('I05 주간 리포트', () => {
      it('지난주 계획이 있는 회원에게 통계와 함께 요청, 한 주에 한 번만', async () => {
        const user = await createUserWith(app, db);
        await missionOn(user, { date: addDays(BASE, 1), status: 'completed' });
        await missionOn(user, { date: addDays(BASE, 2), status: 'completed' });
        await missionOn(user, { date: addDays(BASE, 3), status: 'failed' });

        const result = await reports.dispatchDue({ today: TODAY, limit: 200 });
        expect(result.created).toBeGreaterThanOrEqual(1);
        const run = await runOf(user.id, 'weekly_report');
        expect(run).toMatchObject({
          status: 'requested',
          ingest_key: `report:${run.id}`,
        });

        const call = callsTo('/llm/reports').find(
          (c) => c.body.runId === run.id,
        );
        expect(call.url).toBe('/internal/v1/llm/reports');
        expect(call.headers['x-internal-token']).toBe(SECRET);
        expect(call.body).toMatchObject({
          ingestKey: `report:${run.id}`,
          runType: 'weekly_report',
          periodStart: WEEK.start,
          periodEnd: WEEK.end,
          callbackUrl: 'http://backend.test/internal/v1/ai-callbacks/reports',
        });
        expect(call.body.stats).toMatchObject({
          plannedMissionCount: 3,
          completedMissionCount: 2,
          failedMissionCount: 1,
          achievementRate: 0.6667,
          previousAchievementRate: null,
          streakDays: 0,
          categories: [
            {
              categoryCode: ref.categoryCode,
              completedValue: 2,
              targetValue: 3,
              unit: 'times',
              rate: 0.6667,
            },
          ],
        });

        // 같은 주기에 다시 돌려도 새 실행을 만들지 않음
        await reports.dispatchDue({ today: TODAY, limit: 200 });
        const again = await db.query(
          `SELECT count(*)::int AS n FROM ai_analysis_runs
          WHERE user_id = $1 AND run_type = 'weekly_report'`,
          [user.id],
        );
        expect(again.rows[0].n).toBe(1);
      });

      it('콜백(완료): 리포트 저장, 실행 완료, 알림, 앱 조회 가능, 재전송은 무시', async () => {
        const user = await createUserWith(app, db);
        await missionOn(user, { date: addDays(BASE, 1), status: 'completed' });
        await reports.dispatchDue({ today: TODAY, limit: 200 });
        const run = await runOf(user.id, 'weekly_report');

        const body = {
          ingestKey: run.ingest_key,
          runId: run.id,
          status: 'completed',
          engineVersion: 'gemini-report@0.1.0',
          title: '주간 리포트',
          summary: '이번 주는 운동 미션을 잘 해내셨어요.',
          feedback: '아침이 잘 맞아요.',
          nextGoals: [{ text: '내일은 아침에', categoryCode: null }],
          content: { highlights: ['운동 100%'] },
          failureReason: null,
        };
        const first = await callback('reports', body).expect(200);
        expect(first.body).toEqual({ status: 'applied' });

        expect((await runOf(user.id, 'weekly_report')).status).toBe(
          'completed',
        );
        const list = await http
          .get('/api/v1/ai-reports')
          .set(auth(user))
          .expect(200);
        expect(list.body.items[0]).toMatchObject({
          runId: run.id,
          runType: 'weekly_report',
          periodStart: WEEK.start,
          periodEnd: WEEK.end,
          summary: '이번 주는 운동 미션을 잘 해내셨어요.',
          feedback: '아침이 잘 맞아요.',
          highlights: ['운동 100%'],
          engineVersion: 'gemini-report@0.1.0',
        });
        const notices = await http
          .get('/api/v1/me/notifications')
          .set(auth(user))
          .expect(200);
        expect(notices.body.items[0]).toMatchObject({
          title: '주간 리포트가 도착했어요',
          linkScreen: `reports/ai/${run.id}`,
        });

        const again = await callback('reports', body).expect(200);
        expect(again.body).toEqual({
          status: 'ignored',
          runStatus: 'completed',
        });
      });

      it('콜백(실패): 실행을 실패로 닫고 리포트는 만들지 않음', async () => {
        const user = await createUserWith(app, db);
        await missionOn(user, { date: addDays(BASE, 1), status: 'completed' });
        await reports.dispatchDue({ today: TODAY, limit: 200 });
        const run = await runOf(user.id, 'weekly_report');
        await callback('reports', {
          ingestKey: run.ingest_key,
          runId: run.id,
          status: 'failed',
          engineVersion: 'gemini-report@0.1.0',
          failureReason: 'AI_LLM_UNAVAILABLE',
        }).expect(200);
        expect(await runOf(user.id, 'weekly_report')).toMatchObject({
          status: 'failed',
          failure_reason: 'AI_LLM_UNAVAILABLE',
        });
        const reportRows = await db.query(
          'SELECT 1 FROM ai_reports WHERE run_id = $1',
          [run.id],
        );
        expect(reportRows.rows).toHaveLength(0);
      });

      it('콜백 검증: 인증, 형식, 실행과 맞지 않는 ingestKey, 없는 실행', async () => {
        const base = {
          ingestKey: 'report:abcdef12',
          runId: newId(),
          status: 'completed',
          engineVersion: 'v',
          title: 't',
          summary: 's',
        };
        await http
          .post('/internal/v1/ai-callbacks/reports')
          .send(base)
          .expect(401);
        await callback('reports', { ...base, title: undefined }).expect(400);
        await callback('reports', base).expect(404);

        const user = await createUserWith(app, db);
        await missionOn(user, { date: addDays(BASE, 1), status: 'completed' });
        await reports.dispatchDue({ today: TODAY, limit: 200 });
        const run = await runOf(user.id, 'weekly_report');
        await callback('reports', {
          ...base,
          runId: run.id,
          ingestKey: 'report:wrong-key',
        }).expect(400);
      });

      it('요청이 영구 거절되면 실행을 실패로, 일시 실패면 다음 주기에 다시 보냄', async () => {
        const user = await createUserWith(app, db);
        await missionOn(user, { date: addDays(BASE, 1), status: 'completed' });
        aiReply = () => ({ status: 503, body: { detail: 'busy' } });
        await reports.dispatchDue({ today: TODAY, limit: 200 });
        const run = await runOf(user.id, 'weekly_report');
        expect(run.status).toBe('requested');
        expect(reports.attempts.get(run.id)).toBe(1);

        aiReply = () => ({
          status: 400,
          body: { error: { code: 'AI_INVALID_REQUEST' } },
        });
        await reports.dispatchDue({ today: TODAY, limit: 200 });
        expect(await runOf(user.id, 'weekly_report')).toMatchObject({
          status: 'failed',
          failure_reason: 'AI_INVALID_REQUEST',
        });
      });

      it('결과가 60분 안에 오지 않으면 실패로 닫음', async () => {
        const user = await createUserWith(app, db);
        await missionOn(user, { date: addDays(BASE, 1), status: 'completed' });
        await reports.dispatchDue({ today: TODAY, limit: 200 });
        const run = await runOf(user.id, 'weekly_report');
        await db.withTransaction(async (tx) => {
          await tx.query('SET LOCAL session_replication_role = replica');
          await tx.query(
            `UPDATE ai_analysis_runs SET requested_at = now() - interval '2 hours' WHERE id = $1`,
            [run.id],
          );
        });
        const result = await reports.dispatchDue({ today: TODAY, limit: 200 });
        expect(result.expired).toBeGreaterThanOrEqual(1);
        expect(await runOf(user.id, 'weekly_report')).toMatchObject({
          status: 'failed',
          failure_reason: 'AI_NO_RESULT',
        });
      });

      it('AI 설정이 없으면 아무것도 하지 않음', async () => {
        client.config = {
          get: (key) =>
            key === 'AI_SERVICE_URL' ? undefined : originalConfig.get(key),
        };
        expect(await reports.dispatchDue({ today: TODAY })).toEqual({
          skipped: true,
        });
        expect(await adjustments.dispatchDue({ today: TODAY })).toEqual({
          skipped: true,
        });
      });
    });

    describe('I06 계획 재조정', () => {
      /** 지난주 계획이 모두 실패한 목표와, 앞으로 남은 예정 미션 하나 */
      async function strugglingGoal(user) {
        const goal = (
          await http
            .post('/api/v1/goals')
            .set(auth(user))
            .send({
              title: `재조정 목표 ${RUN}`,
              categoryCode: ref.categoryCode,
              difficultyCode: ref.difficultyCode,
              startDate: kstDate(),
              endDate: addDays(kstDate(), 20),
              targetFrequency: 3,
              dailyAvailableMinutes: 30,
            })
            .expect(201)
        ).body;
        for (const offset of [0, 1, 2, 3]) {
          await missionOn(user, {
            date: addDays(BASE, offset),
            status: 'failed',
            goalId: goal.id,
          });
        }
        await missionOn(user, {
          date: addDays(TODAY, 3),
          status: 'scheduled',
          goalId: goal.id,
        });
        // 미션을 다 만든 뒤에 목표 기간을 지난주 기준으로 옮긴다(미션 생성은 목표 기간 안의 날짜만 허용)
        await db.withTransaction(async (tx) => {
          await tx.query('SET LOCAL session_replication_role = replica');
          await tx.query(
            `UPDATE goals SET start_date = $2::date, end_date = $3::date WHERE id = $1`,
            [goal.id, addDays(BASE, -7), addDays(BASE, 60)],
          );
        });
        return goal;
      }

      it('원인이 있는 목표만 골라 이전 계획·통계·원인과 함께 요청', async () => {
        const user = await createUserWith(app, db);
        const goal = await strugglingGoal(user);

        const quiet = await createUserWith(app, db);
        await missionOn(quiet, { date: addDays(BASE, 1), status: 'completed' });

        const result = await adjustments.dispatchDue({
          today: TODAY,
          limit: 200,
        });
        expect(result.created).toBeGreaterThanOrEqual(1);
        const run = await runOf(user.id, 'plan_adjustment');
        expect(run.ingest_key).toBe(`plan-adjust:${run.id}:${goal.id}`);
        expect(await runOf(quiet.id, 'plan_adjustment')).toBeUndefined();

        const call = callsTo('/llm/plan-adjustments').find(
          (c) => c.body.runId === run.id,
        );
        expect(call.body).toMatchObject({
          ingestKey: run.ingest_key,
          today: TODAY,
          goal: {
            title: `재조정 목표 ${RUN}`,
            categoryCode: ref.categoryCode,
            difficultyCode: ref.difficultyCode,
            targetFrequency: 3,
            dailyAvailableMinutes: 30,
          },
          stats: {
            periodStart: WEEK.start,
            periodEnd: WEEK.end,
            plannedCount: 4,
            completedCount: 0,
            failedCount: 4,
            achievementRate: 0,
          },
          callbackUrl:
            'http://backend.test/internal/v1/ai-callbacks/plan-adjustments',
        });
        expect(call.body.causes.map((c) => c.code)).toEqual([
          'low_completion',
          'overload',
          'missed_days',
        ]);
        expect(call.body.beforePlan).toHaveLength(1);
        expect(call.body.beforePlan[0].missions).toHaveLength(1);
        expect(call.body.beforePlan[0].missions[0]).toMatchObject({
          scheduledDate: addDays(TODAY, 3),
          exerciseCode: 'squat',
          targetValue: 20,
          targetUnit: 'reps',
        });
        expect(call.body.exerciseTypes).toHaveLength(6);
      });

      it('콜백(완료): 제안을 저장하고 앱 재조정 제안(A50·A51)에 나타남, 재전송은 무시', async () => {
        const user = await createUserWith(app, db);
        const goal = await strugglingGoal(user);
        await adjustments.dispatchDue({ today: TODAY, limit: 200 });
        const run = await runOf(user.id, 'plan_adjustment');

        const proposedPlan = [
          {
            stepNo: 1,
            title: '가볍게 다시',
            description: null,
            dueDate: addDays(TODAY, 7),
            missions: [
              {
                scheduledDate: addDays(TODAY, 3),
                title: '스쿼트 10개',
                description: null,
                categoryCode: ref.categoryCode,
                difficultyCode: ref.difficultyCode,
                exerciseCode: 'squat',
                verificationMethod: 'camera',
                targetValue: 10,
                targetUnit: 'reps',
                estimatedDurationSeconds: 300,
                isRequired: true,
              },
            ],
          },
        ];
        const body = {
          ingestKey: run.ingest_key,
          runId: run.id,
          status: 'completed',
          engineVersion: 'gemini-adjust@0.1.0',
          reason: '지난주 달성률이 낮아 목표를 낮췄어요.',
          proposedPlan,
          failureReason: null,
        };
        const first = await callback('plan-adjustments', body).expect(200);
        expect(first.body).toMatchObject({ status: 'applied' });
        expect((await runOf(user.id, 'plan_adjustment')).status).toBe(
          'completed',
        );

        const list = await http
          .get(`/api/v1/plan-adjustments?goalId=${goal.id}`)
          .set(auth(user))
          .expect(200);
        expect(list.body.items[0]).toMatchObject({
          id: first.body.adjustmentId,
          goalId: goal.id,
          status: 'proposed',
          reason: '지난주 달성률이 낮아 목표를 낮췄어요.',
        });
        expect(list.body.items[0].proposedPlan[0].missions[0].title).toBe(
          '스쿼트 10개',
        );
        const notices = await http
          .get('/api/v1/me/notifications')
          .set(auth(user))
          .expect(200);
        expect(notices.body.items[0]).toMatchObject({
          title: '계획 조정 제안이 도착했어요',
          linkScreen: `plan-adjustments/${first.body.adjustmentId}`,
        });

        const again = await callback('plan-adjustments', body).expect(200);
        expect(again.body).toEqual({
          status: 'ignored',
          runStatus: 'completed',
        });

        // 열려 있는 제안이 있는 목표는 다음 주기에 다시 요청하지 않음
        await adjustments.dispatchDue({ today: addDays(TODAY, 7), limit: 200 });
        const runs = await db.query(
          `SELECT count(*)::int AS n FROM ai_analysis_runs
          WHERE user_id = $1 AND run_type = 'plan_adjustment'`,
          [user.id],
        );
        expect(runs.rows[0].n).toBe(1);
      });

      it('콜백(실패·형식 오류·잘못된 키)', async () => {
        const user = await createUserWith(app, db);
        await strugglingGoal(user);
        await adjustments.dispatchDue({ today: TODAY, limit: 200 });
        const run = await runOf(user.id, 'plan_adjustment');
        const base = {
          ingestKey: run.ingest_key,
          runId: run.id,
          engineVersion: 'v',
        };

        // 완료인데 계획이 없음
        await callback('plan-adjustments', {
          ...base,
          status: 'completed',
        }).expect(400);
        // 키의 실행 id와 본문의 runId가 다름
        await callback('plan-adjustments', {
          ...base,
          runId: newId(),
          status: 'failed',
        }).expect(400);
        await http
          .post('/internal/v1/ai-callbacks/plan-adjustments')
          .send({ ...base, status: 'failed' })
          .expect(401);

        await callback('plan-adjustments', {
          ...base,
          status: 'failed',
          failureReason: 'AI_LLM_UNAVAILABLE',
        }).expect(200);
        expect(await runOf(user.id, 'plan_adjustment')).toMatchObject({
          status: 'failed',
          failure_reason: 'AI_LLM_UNAVAILABLE',
        });
        const proposals = await db.query(
          'SELECT 1 FROM plan_adjustment_proposals WHERE run_id = $1',
          [run.id],
        );
        expect(proposals.rows).toHaveLength(0);
      });

      it('결과가 30분 안에 오지 않으면 실패로 닫고, 기한이 지난 제안은 expired', async () => {
        const user = await createUserWith(app, db);
        await strugglingGoal(user);
        await adjustments.dispatchDue({ today: TODAY, limit: 200 });
        const run = await runOf(user.id, 'plan_adjustment');
        await db.withTransaction(async (tx) => {
          await tx.query('SET LOCAL session_replication_role = replica');
          await tx.query(
            `UPDATE ai_analysis_runs SET requested_at = now() - interval '1 hour' WHERE id = $1`,
            [run.id],
          );
        });
        const result = await adjustments.dispatchDue({
          today: TODAY,
          limit: 200,
        });
        expect(result.expired).toBeGreaterThanOrEqual(1);
        expect(await runOf(user.id, 'plan_adjustment')).toMatchObject({
          status: 'failed',
          failure_reason: 'AI_NO_RESULT',
        });
      });
    });
  },
);
