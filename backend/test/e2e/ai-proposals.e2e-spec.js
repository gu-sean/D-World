import { createUser as createUserWith } from '../support/users.js';
import { createTestApp } from '../support/app.js';
import { randomInt, randomUUID } from 'node:crypto';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { addDays, kstDate, kstDayStart } from '../../src/common/time/kst.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { GoalsService } from '../../src/goals/goals.service.js';
import { ProposalsService } from '../../src/ai-proposals/proposals.service.js';

// DATABASE_URL이 있을 때만 실행, 마이그레이션 적용 필요
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999); // 반복 실행해도 고유 값이 겹치지 않게

describe.skipIf(!databaseUrl)('AI 제안 수락·거절·만료 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let proposalsService;
  let goalsService;
  let adminId;
  let counter = 0;

  const tx = (fn) => db.withTransaction(fn);
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const next = () => `${RUN}${counter++}`;
  const today = () => kstDate();
  const day = (offset) => addDays(today(), offset);

  const createUser = () => createUserWith(app, db);

  async function createReference({ rate = true } = {}) {
    const tag = next();
    const category = randomUUID();
    const difficulty = randomUUID();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [category, `pc${tag}`, `제안카테고리${tag}`],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [difficulty, `pd${tag}`, `제안난이도${tag}`],
    );
    let rateId = null;
    if (rate) {
      rateId = randomUUID();
      await db.query(
        `INSERT INTO mission_reward_rate_versions
                (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
                 effective_at, created_by_admin_id)
         VALUES ($1,$2,$3,1,80,8,4, now() - interval '1 day', $4)`,
        [rateId, category, difficulty, adminId],
      );
    }
    return {
      category,
      difficulty,
      rateId,
      categoryCode: `pc${tag}`,
      difficultyCode: `pd${tag}`,
    };
  }

  async function createGoal(user, ref, overrides = {}) {
    const res = await http
      .post('/api/v1/goals')
      .set(auth(user.token))
      .send({
        title: '운동 목표',
        categoryId: ref.category,
        difficultyId: ref.difficulty,
        startDate: day(-5),
        endDate: day(40),
        ...overrides,
      })
      .expect(201);
    return res.body;
  }

  /** AI가 만들어 넣는 draft 제안 (생성 로직은 범위 밖이라 직접 삽입) */
  async function createProposal(
    user,
    goalId,
    { generationNo, status = 'draft', ageDays = 0 } = {},
  ) {
    const id = randomUUID();
    const no =
      generationNo ??
      (
        await db.query(
          'SELECT coalesce(max(generation_no), 0) + 1 AS n FROM ai_plan_proposals WHERE goal_id = $1',
          [goalId],
        )
      ).rows[0].n;
    await db.query(
      `INSERT INTO ai_plan_proposals
              (id, user_id, goal_id, generation_no, status, proposal_json, generated_at)
       VALUES ($1,$2,$3,$4,'draft',$5::jsonb, now() - make_interval(days => $6))`,
      [
        id,
        user.id,
        goalId,
        no,
        JSON.stringify({ model: 'plan-v1', note: '원안' }),
        ageDays,
      ],
    );
    if (status === 'rejected' || status === 'expired') {
      await db.query('UPDATE ai_plan_proposals SET status = $2 WHERE id = $1', [
        id,
        status,
      ]);
    }
    return id;
  }

  const mission = (overrides = {}) => ({
    title: '30분 걷기',
    verificationMethod: 'sensor',
    scheduledDate: day(1),
    ...overrides,
  });

  const accept = (user, goalId, proposalId, plan) =>
    http
      .post(`/api/v1/goals/${goalId}/proposals/${proposalId}/accept`)
      .set(auth(user.token))
      .send({ plan });

  const row = async (sql, params) => (await db.query(sql, params)).rows;

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    proposalsService = app.get(ProposalsService);
    goalsService = app.get(GoalsService);

    adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `ap_${RUN}`, `${adminId}@example.com`],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('수락', () => {
    it('계획의 단계와 미션을 만들고 보상은 보상표에서 확정, 원안은 보존하고 확정안을 따로 저장', async () => {
      const user = await createUser();
      const ref = await createReference();
      const goal = await createGoal(user, ref);
      const proposalId = await createProposal(user, goal.id);

      const plan = {
        steps: [
          {
            title: '1주차',
            description: '적응 기간',
            dueDate: day(7),
            missions: [
              mission({ scheduledDate: day(1), title: '걷기' }),
              mission({
                scheduledDate: day(2),
                title: '스트레칭',
                verificationMethod: 'camera',
                targetValue: 10,
                targetUnit: '분',
              }),
            ],
          },
          {
            title: '2주차',
            dueDate: day(14),
            missions: [mission({ scheduledDate: day(8) })],
          },
        ],
        missions: [
          mission({
            scheduledDate: day(3),
            title: '단계 없는 미션',
            isRequired: false,
          }),
        ],
      };
      const res = await accept(user, goal.id, proposalId, plan).expect(200);

      expect(res.body).toMatchObject({ proposalId, status: 'accepted' });
      expect(res.body.steps.map((s) => [s.stepNo, s.title, s.dueDate])).toEqual(
        [
          [1, '1주차', day(7)],
          [2, '2주차', day(14)],
        ],
      );
      expect(res.body.missions).toHaveLength(4);
      for (const m of res.body.missions) {
        expect(m).toMatchObject({
          sourceType: 'ai',
          goalId: goal.id,
          status: 'scheduled',
          categoryCode: ref.categoryCode, // 생략하면 목표의 값
          difficultyCode: ref.difficultyCode,
          reward: { points: 80, userXp: 8, petXp: 4 },
        });
      }
      const byTitle = Object.fromEntries(
        res.body.missions.map((m) => [m.title, m]),
      );
      expect(byTitle['걷기'].stepId).toBe(res.body.steps[0].id);
      expect(byTitle['스트레칭']).toMatchObject({
        targetValue: 10,
        targetUnit: '분',
        verificationMethod: 'camera',
      });
      expect(byTitle['단계 없는 미션']).toMatchObject({
        stepId: null,
        isRequired: false,
      });
      expect(byTitle['걷기'].dueAt).toBe(kstDayStart(day(2)).toISOString());

      const saved = await row(
        `SELECT status, proposal_json, accepted_plan_json, accepted_at FROM ai_plan_proposals WHERE id = $1`,
        [proposalId],
      );
      expect(saved[0].status).toBe('accepted');
      expect(saved[0].proposal_json).toEqual({
        model: 'plan-v1',
        note: '원안',
      });
      expect(saved[0].accepted_plan_json).toEqual(plan);
      expect(saved[0].accepted_at).not.toBeNull();

      const rows = await row(
        'SELECT reward_rate_version_id, source_proposal_id FROM missions WHERE user_id = $1',
        [user.id],
      );
      expect(
        rows.every(
          (r) =>
            r.reward_rate_version_id === ref.rateId &&
            r.source_proposal_id === proposalId,
        ),
      ).toBe(true);
    });

    it('같은 계획으로 다시 수락하면 만든 결과를 그대로 돌려주고 중복 생성하지 않음', async () => {
      const user = await createUser();
      const ref = await createReference();
      const goal = await createGoal(user, ref);
      const proposalId = await createProposal(user, goal.id);
      const plan = {
        steps: [
          {
            title: '1주차',
            dueDate: day(7),
            missions: [mission(), mission({ scheduledDate: day(2) })],
          },
        ],
      };

      const first = await accept(user, goal.id, proposalId, plan).expect(200);
      const second = await accept(user, goal.id, proposalId, plan).expect(200);
      expect(second.body.missions.map((m) => m.id)).toEqual(
        first.body.missions.map((m) => m.id),
      );
      expect(second.body.steps.map((s) => s.id)).toEqual(
        first.body.steps.map((s) => s.id),
      );
      expect(second.body.acceptedAt).toBe(first.body.acceptedAt);
      expect(
        await row('SELECT 1 FROM missions WHERE user_id = $1', [user.id]),
      ).toHaveLength(2);
      expect(
        await row('SELECT 1 FROM goal_steps WHERE goal_id = $1', [goal.id]),
      ).toHaveLength(1);

      // 키 순서만 다른 같은 계획도 같은 것으로 봄
      const reordered = {
        steps: [
          { dueDate: day(7), title: '1주차', missions: plan.steps[0].missions },
        ],
      };
      await accept(user, goal.id, proposalId, reordered).expect(200);

      const different = await accept(user, goal.id, proposalId, {
        missions: [mission({ title: '다른 계획' })],
      }).expect(409);
      expect(different.body.error.code).toBe('PLAN_PROPOSAL_NOT_DRAFT');
    });

    it('거절·만료된 제안과 남의 제안, 다른 목표의 제안은 수락할 수 없음', async () => {
      const user = await createUser();
      const other = await createUser();
      const ref = await createReference();
      const goal = await createGoal(user, ref);
      const otherGoal = await createGoal(user, ref);
      const plan = { missions: [mission()] };

      for (const status of ['rejected', 'expired']) {
        const id = await createProposal(user, goal.id, { status });
        const res = await accept(user, goal.id, id, plan).expect(409);
        expect(res.body.error).toMatchObject({
          code: 'PLAN_PROPOSAL_NOT_DRAFT',
          details: { status },
        });
      }
      const draft = await createProposal(user, goal.id);
      const stranger = await accept(other, goal.id, draft, plan).expect(404);
      expect(stranger.body.error.code).toBe('GOAL_NOT_FOUND');
      const wrongGoal = await accept(user, otherGoal.id, draft, plan).expect(
        404,
      );
      expect(wrongGoal.body.error.code).toBe('PROPOSAL_NOT_FOUND');
      await accept(user, goal.id, randomUUID(), plan).expect(404);
      expect(
        await row('SELECT 1 FROM missions WHERE user_id = $1', [user.id]),
      ).toHaveLength(0);
    });

    it('생성 후 만료 기간이 지난 초안은 만료 작업 전이라도 수락할 수 없음', async () => {
      const user = await createUser();
      const ref = await createReference();
      const goal = await createGoal(user, ref);
      const stale = await createProposal(user, goal.id, { ageDays: 8 });
      const res = await accept(user, goal.id, stale, {
        missions: [mission()],
      }).expect(409);
      expect(res.body.error).toMatchObject({
        code: 'PLAN_PROPOSAL_NOT_DRAFT',
        details: { status: 'expired' },
      });
      const fresh = await createProposal(user, goal.id, { ageDays: 6 });
      await accept(user, goal.id, fresh, { missions: [mission()] }).expect(200);
    });

    it('일시정지·완료된 목표에는 적용할 수 없음', async () => {
      const user = await createUser();
      const ref = await createReference();
      const goal = await createGoal(user, ref);
      const proposalId = await createProposal(user, goal.id);
      const plan = { missions: [mission()] };

      await http
        .post(`/api/v1/goals/${goal.id}/pause`)
        .set(auth(user.token))
        .expect(200);
      expect(
        (await accept(user, goal.id, proposalId, plan).expect(409)).body.error
          .code,
      ).toBe('GOAL_PAUSED');
      await http
        .post(`/api/v1/goals/${goal.id}/resume`)
        .set(auth(user.token))
        .expect(200);
      await http
        .post(`/api/v1/goals/${goal.id}/complete`)
        .set(auth(user.token))
        .expect(200);
      expect(
        (await accept(user, goal.id, proposalId, plan).expect(409)).body.error
          .code,
      ).toBe('GOAL_ALREADY_COMPLETED');
      const { 0: p } = await row(
        'SELECT status FROM ai_plan_proposals WHERE id = $1',
        [proposalId],
      );
      expect(p.status).toBe('draft');
    });
  });

  describe('입력 검증과 규칙', () => {
    it('형식 오류는 400', async () => {
      const user = await createUser();
      const ref = await createReference();
      const goal = await createGoal(user, ref);
      const proposalId = await createProposal(user, goal.id);
      const bad = [
        {},
        { missions: [] },
        { steps: [] },
        { steps: [{ title: '단계', dueDate: day(5) }] }, // 미션 없음
        { missions: [mission({ title: ' ' })] },
        { missions: [mission({ verificationMethod: 'manual' })] },
        { missions: [mission({ scheduledDate: '2026-02-31' })] },
        { missions: [mission({ targetValue: 5 })] },
        { missions: [mission({ dueAt: '2026-11-05 10:00' })] },
        { steps: [{ dueDate: day(5), missions: [mission()] }] }, // 단계 제목 없음
      ];
      for (const plan of bad) {
        const res = await accept(user, goal.id, proposalId, plan);
        expect(res.status, JSON.stringify(plan)).toBe(400);
      }
      await http
        .post(`/api/v1/goals/${goal.id}/proposals/${proposalId}/accept`)
        .set(auth(user.token))
        .send({})
        .expect(400);
      await http
        .post(`/api/v1/goals/${goal.id}/proposals/not-a-uuid/accept`)
        .set(auth(user.token))
        .send({ plan: { missions: [mission()] } })
        .expect(400);
      expect(
        (
          await row('SELECT status FROM ai_plan_proposals WHERE id = $1', [
            proposalId,
          ])
        )[0].status,
      ).toBe('draft');
    });

    it('날짜·마감·단계 마감일 규칙 위반은 422이고 아무것도 만들지 않으며 제안은 draft로 남음', async () => {
      const user = await createUser();
      const ref = await createReference();
      const goal = await createGoal(user, ref, { endDate: day(10) });
      const proposalId = await createProposal(user, goal.id);

      const cases = [
        [
          { missions: [mission({ scheduledDate: day(-1) })] },
          'MISSION_DATE_OUT_OF_RANGE',
        ],
        [
          { missions: [mission({ scheduledDate: day(11) })] },
          'MISSION_DATE_OUT_OF_RANGE',
        ],
        [
          { missions: [mission({ dueAt: kstDayStart(day(5)).toISOString() })] },
          'INVALID_DUE_AT',
        ],
        [
          {
            steps: [{ title: '단계', dueDate: day(11), missions: [mission()] }],
          },
          'STEP_DUE_OUT_OF_PERIOD',
        ],
        [
          { missions: [mission(), mission({ categoryId: randomUUID() })] },
          'INACTIVE_REFERENCE',
        ],
      ];
      for (const [plan, code] of cases) {
        const res = await accept(user, goal.id, proposalId, plan);
        expect([400, 422]).toContain(res.status);
        expect(res.body.error.code, JSON.stringify(plan)).toBe(code);
      }
      expect(
        await row('SELECT 1 FROM missions WHERE user_id = $1', [user.id]),
      ).toHaveLength(0);
      expect(
        await row('SELECT 1 FROM goal_steps WHERE goal_id = $1', [goal.id]),
      ).toHaveLength(0);
      expect(
        (
          await row(
            'SELECT status, accepted_plan_json FROM ai_plan_proposals WHERE id = $1',
            [proposalId],
          )
        )[0],
      ).toEqual({
        status: 'draft',
        accepted_plan_json: null,
      });
    });

    it('보상표가 없으면 계획 전체를 거절하고 아무것도 만들지 않음', async () => {
      const user = await createUser();
      const ref = await createReference();
      const noRate = await createReference({ rate: false });
      const goal = await createGoal(user, ref);
      const proposalId = await createProposal(user, goal.id);
      const res = await accept(user, goal.id, proposalId, {
        steps: [{ title: '단계', dueDate: day(5), missions: [mission()] }],
        missions: [
          mission({
            categoryId: noRate.category,
            difficultyId: noRate.difficulty,
          }),
        ],
      }).expect(422);
      expect(res.body.error.code).toBe('REWARD_RATE_MISSING');
      expect(
        await row('SELECT 1 FROM missions WHERE user_id = $1', [user.id]),
      ).toHaveLength(0);
      expect(
        await row('SELECT 1 FROM goal_steps WHERE goal_id = $1', [goal.id]),
      ).toHaveLength(0);
      expect(
        (
          await row('SELECT status FROM ai_plan_proposals WHERE id = $1', [
            proposalId,
          ])
        )[0].status,
      ).toBe('draft');
    });

    it('하루 20개 상한을 계획 전체로 검사하고 실패하면 모두 롤백', async () => {
      const user = await createUser();
      const ref = await createReference();
      const goal = await createGoal(user, ref);
      const proposalId = await createProposal(user, goal.id);
      const busy = day(3);
      for (let i = 0; i < 18; i++) {
        await db.query(
          `INSERT INTO missions (id, user_id, source_type, title, category_id, difficulty_id,
                                 verification_method, scheduled_date)
           VALUES ($1,$2,'user','기존',$3,$4,'sensor',$5)`,
          [randomUUID(), user.id, ref.category, ref.difficulty, busy],
        );
      }
      const over = await accept(user, goal.id, proposalId, {
        missions: [
          mission({ scheduledDate: busy }),
          mission({ scheduledDate: busy }),
          mission({ scheduledDate: busy }),
        ],
      }).expect(409);
      expect(over.body.error).toMatchObject({
        code: 'DAILY_LIMIT_REACHED',
        details: { date: busy },
      });
      expect(
        await row(
          'SELECT 1 FROM missions WHERE user_id = $1 AND source_type = $2',
          [user.id, 'ai'],
        ),
      ).toHaveLength(0);
      expect(
        (
          await row('SELECT status FROM ai_plan_proposals WHERE id = $1', [
            proposalId,
          ])
        )[0].status,
      ).toBe('draft');

      await accept(user, goal.id, proposalId, {
        missions: [
          mission({ scheduledDate: busy }),
          mission({ scheduledDate: busy }),
        ],
      }).expect(200);
    });

    it('한 번에 적용하는 미션은 100개까지, 단계는 목표당 30개까지', async () => {
      const user = await createUser();
      const ref = await createReference();
      const goal = await createGoal(user, ref);
      const proposalId = await createProposal(user, goal.id);

      const many = Array.from({ length: 101 }, (_, i) =>
        mission({ scheduledDate: day(1 + (i % 30)), title: `미션${i}` }),
      );
      const tooMany = await accept(user, goal.id, proposalId, {
        missions: many,
      });
      expect(tooMany.status).toBe(400); // 배열 상한(100) 초과

      const steps = Array.from({ length: 29 }, (_, i) => ({
        title: `단계${i}`,
        dueDate: day(5),
        missions: [mission({ scheduledDate: day(1 + (i % 20)) })],
      }));
      for (let i = 0; i < 2; i++) {
        await http
          .post(`/api/v1/goals/${goal.id}/steps`)
          .set(auth(user.token))
          .send({ title: `기존${i}`, dueDate: day(6) })
          .expect(201);
      }
      const limit = await accept(user, goal.id, proposalId, { steps }).expect(
        409,
      );
      expect(limit.body.error.code).toBe('STEP_LIMIT_REACHED');
      expect(
        await row('SELECT 1 FROM goal_steps WHERE goal_id = $1', [goal.id]),
      ).toHaveLength(2);
    });
  });

  describe('재생성', () => {
    it('계획에 포함된 날짜의 시작 전 AI 미션만 취소하고 새로 만듦', async () => {
      const user = await createUser();
      const ref = await createReference();
      const goal = await createGoal(user, ref);

      const first = await createProposal(user, goal.id);
      const firstResult = await accept(user, goal.id, first, {
        missions: [
          mission({ scheduledDate: day(1), title: 'AI 1일차' }),
          mission({ scheduledDate: day(2), title: 'AI 2일차' }),
          mission({ scheduledDate: day(3), title: 'AI 3일차' }),
        ],
      }).expect(200);
      const ids = Object.fromEntries(
        firstResult.body.missions.map((m) => [m.title, m.id]),
      );

      // 사용자가 직접 만든 미션, 이미 시작한 AI 미션
      const direct = await http
        .post('/api/v1/missions')
        .set(auth(user.token))
        .send({
          title: '직접 만든 1일차',
          categoryId: ref.category,
          difficultyId: ref.difficulty,
          verificationMethod: 'sensor',
          scheduledDates: [day(1)],
          goalId: goal.id,
        })
        .expect(201);
      await db.query(
        `UPDATE missions SET status = 'in_progress' WHERE id = $1`,
        [ids['AI 2일차']],
      );

      const second = await createProposal(user, goal.id);
      const secondResult = await accept(user, goal.id, second, {
        missions: [
          mission({ scheduledDate: day(1), title: '새 1일차' }),
          mission({ scheduledDate: day(2), title: '새 2일차' }),
        ],
      }).expect(200);

      const states = Object.fromEntries(
        (
          await row(
            `SELECT title, status, cancel_reason FROM missions WHERE user_id = $1`,
            [user.id],
          )
        ).map((r) => [r.title, [r.status, r.cancel_reason]]),
      );
      expect(states).toEqual({
        'AI 1일차': ['cancelled', 'ai_regenerated'], // 같은 날짜, 시작 전 → 취소
        'AI 2일차': ['in_progress', null], // 시작한 미션은 유지
        'AI 3일차': ['scheduled', null], // 계획에 없는 날짜는 유지
        '직접 만든 1일차': ['scheduled', null], // 직접 만든 미션은 유지
        '새 1일차': ['scheduled', null],
        '새 2일차': ['scheduled', null],
      });
      expect(direct.body.items[0].sourceType).toBe('user');
      expect(secondResult.body.missions.map((m) => m.title).sort()).toEqual([
        '새 1일차',
        '새 2일차',
      ]);

      // 취소 행은 이력으로 남고 기본 목록에서는 빠짐
      const list = await http
        .get('/api/v1/missions')
        .query({ goalId: goal.id })
        .set(auth(user.token))
        .expect(200);
      expect(list.body.items.map((m) => m.title)).not.toContain('AI 1일차');
      const cancelled = await http
        .get('/api/v1/missions')
        .query({ goalId: goal.id, status: 'cancelled' })
        .set(auth(user.token))
        .expect(200);
      expect(cancelled.body.items.map((m) => m.title)).toEqual(['AI 1일차']);
    });

    it('취소로 하루 상한이 비면 같은 날짜에 새로 채울 수 있음', async () => {
      const user = await createUser();
      const ref = await createReference();
      const goal = await createGoal(user, ref);
      const busy = day(4);
      const first = await createProposal(user, goal.id);
      await accept(user, goal.id, first, {
        missions: Array.from({ length: 20 }, (_, i) =>
          mission({ scheduledDate: busy, title: `AI${i}` }),
        ),
      }).expect(200);

      const second = await createProposal(user, goal.id);
      await accept(user, goal.id, second, {
        missions: Array.from({ length: 20 }, (_, i) =>
          mission({ scheduledDate: busy, title: `새${i}` }),
        ),
      }).expect(200);
      const rows = await row(
        `SELECT status, count(*)::int AS n FROM missions WHERE user_id = $1 GROUP BY status ORDER BY status`,
        [user.id],
      );
      expect(rows).toEqual([
        { status: 'cancelled', n: 20 },
        { status: 'scheduled', n: 20 },
      ]);
    });

    it('미션을 잃은 이전 단계는 자동 완료 조건을 다시 평가', async () => {
      const user = await createUser();
      const ref = await createReference();
      const goal = await createGoal(user, ref);
      // 종료일이 지난 단계에 완료 미션 하나와 곧 취소될 AI 미션 하나
      const step = await http
        .post(`/api/v1/goals/${goal.id}/steps`)
        .set(auth(user.token))
        .send({ title: '지난 단계', dueDate: day(-1) })
        .expect(201);
      await db.query(
        `INSERT INTO missions (id, user_id, goal_id, goal_step_id, source_type, title, category_id,
                               difficulty_id, verification_method, scheduled_date, status)
         VALUES ($1,$2,$3,$4,'user','끝난 미션',$5,$6,'sensor',$7,'completed')`,
        [
          randomUUID(),
          user.id,
          goal.id,
          step.body.id,
          ref.category,
          ref.difficulty,
          day(-3),
        ],
      );
      const first = await createProposal(user, goal.id);
      await accept(user, goal.id, first, {
        missions: [mission({ scheduledDate: day(2) })],
      }).expect(200);
      // AI 미션을 지난 단계에 붙여(다음 단계 상태를 재현) 단계를 열린 상태로 만든 뒤 재생성
      await db.query(
        `UPDATE missions SET goal_step_id = $1 WHERE user_id = $2 AND source_type = 'ai'`,
        [step.body.id, user.id],
      );
      await tx((t) => goalsService.reevaluateStep(t, step.body.id));
      expect(
        (
          await row('SELECT status FROM goal_steps WHERE id = $1', [
            step.body.id,
          ])
        )[0].status,
      ).toBe('active');

      const second = await createProposal(user, goal.id);
      await accept(user, goal.id, second, {
        missions: [mission({ scheduledDate: day(2), title: '재생성' })],
      }).expect(200);
      expect(
        (
          await row('SELECT status FROM goal_steps WHERE id = $1', [
            step.body.id,
          ])
        )[0].status,
      ).toBe('completed');
    });
  });

  describe('거절과 목록', () => {
    it('거절은 draft만 가능하고 다시 거절하면 같은 결과, 거절 후에는 수락 불가', async () => {
      const user = await createUser();
      const other = await createUser();
      const ref = await createReference();
      const goal = await createGoal(user, ref);
      const proposalId = await createProposal(user, goal.id);
      const reject = (u, id = proposalId) =>
        http
          .post(`/api/v1/goals/${goal.id}/proposals/${id}/reject`)
          .set(auth(u.token));

      await reject(other).expect(404);
      expect((await reject(user).expect(200)).body).toEqual({
        id: proposalId,
        status: 'rejected',
      });
      expect((await reject(user).expect(200)).body.status).toBe('rejected');
      await accept(user, goal.id, proposalId, { missions: [mission()] }).expect(
        409,
      );

      const accepted = await createProposal(user, goal.id);
      await accept(user, goal.id, accepted, { missions: [mission()] }).expect(
        200,
      );
      const res = await reject(user, accepted).expect(409);
      expect(res.body.error).toMatchObject({
        code: 'PLAN_PROPOSAL_NOT_DRAFT',
        details: { status: 'accepted' },
      });
      await reject(user, randomUUID()).expect(404);
    });

    it('목록은 최신 생성순 커서 페이지네이션과 상태 필터, 원안과 확정안·만료 시각을 포함', async () => {
      const user = await createUser();
      const other = await createUser();
      const ref = await createReference();
      const goal = await createGoal(user, ref);
      const otherGoal = await createGoal(other, ref);
      const ids = [];
      for (let i = 0; i < 4; i++) ids.push(await createProposal(user, goal.id));
      await createProposal(other, otherGoal.id);
      await accept(user, goal.id, ids[0], { missions: [mission()] }).expect(
        200,
      );
      await http
        .post(`/api/v1/goals/${goal.id}/proposals/${ids[1]}/reject`)
        .set(auth(user.token))
        .expect(200);

      const seen = [];
      let cursor;
      for (let page = 0; page < 4; page++) {
        const res = await http
          .get(`/api/v1/goals/${goal.id}/proposals`)
          .query({ limit: 2, ...(cursor ? { cursor } : {}) })
          .set(auth(user.token))
          .expect(200);
        seen.push(...res.body.items);
        cursor = res.body.nextCursor;
        if (!cursor) break;
      }
      expect(seen.map((p) => p.id)).toEqual([...ids].reverse());
      expect(seen.map((p) => p.generationNo)).toEqual([4, 3, 2, 1]);

      const byId = Object.fromEntries(seen.map((p) => [p.id, p]));
      expect(byId[ids[0]]).toMatchObject({
        status: 'accepted',
        proposal: { note: '원안' },
        expiresAt: null,
      });
      expect(byId[ids[0]].acceptedPlan).toEqual({ missions: [mission()] });
      expect(byId[ids[1]].status).toBe('rejected');
      expect(byId[ids[2]]).toMatchObject({
        status: 'draft',
        acceptedPlan: null,
        acceptedAt: null,
      });
      expect(
        Date.parse(byId[ids[2]].expiresAt) -
          Date.parse(byId[ids[2]].generatedAt),
      ).toBe(7 * 86_400_000);

      const drafts = await http
        .get(`/api/v1/goals/${goal.id}/proposals`)
        .query({ status: 'draft' })
        .set(auth(user.token))
        .expect(200);
      expect(drafts.body.items.map((p) => p.id)).toEqual([ids[3], ids[2]]);
      await http
        .get(`/api/v1/goals/${otherGoal.id}/proposals`)
        .set(auth(user.token))
        .expect(404);
      for (const query of [{ limit: 0 }, { status: 'x' }, { cursor: 'zzz' }]) {
        await http
          .get(`/api/v1/goals/${goal.id}/proposals`)
          .query(query)
          .set(auth(user.token))
          .expect(400);
      }
    });
  });

  describe('만료 작업', () => {
    it('기간이 지난 draft만 expired로 바꾸고 다른 상태는 건드리지 않음', async () => {
      const user = await createUser();
      const ref = await createReference();
      const goal = await createGoal(user, ref);
      const old = await createProposal(user, goal.id, { ageDays: 8 });
      const fresh = await createProposal(user, goal.id, { ageDays: 3 });
      const oldAccepted = await createProposal(user, goal.id, { ageDays: 1 });
      await accept(user, goal.id, oldAccepted, {
        missions: [mission()],
      }).expect(200);
      await db.query(
        `UPDATE ai_plan_proposals SET generated_at = now() - interval '30 days' WHERE id = $1`,
        [oldAccepted],
      );

      const result = await proposalsService.expireStale({ limit: 10_000 });
      expect(result.expired).toBeGreaterThanOrEqual(1);
      const statuses = Object.fromEntries(
        (
          await row(
            'SELECT id, status FROM ai_plan_proposals WHERE goal_id = $1',
            [goal.id],
          )
        ).map((r) => [r.id, r.status]),
      );
      expect(statuses).toEqual({
        [old]: 'expired',
        [fresh]: 'draft',
        [oldAccepted]: 'accepted',
      });
      expect(
        (await proposalsService.expireStale({ limit: 10_000 })).expired,
      ).toBe(0);
    });
  });

  describe('이용 제한', () => {
    it('제한 중에는 수락을 막고 거절·목록 조회는 허용', async () => {
      const user = await createUser();
      const ref = await createReference();
      const goal = await createGoal(user, ref);
      const toAccept = await createProposal(user, goal.id);
      const toReject = await createProposal(user, goal.id);
      await db.query(
        `INSERT INTO account_actions (id, user_id, admin_id, action_type, reason, starts_at, ends_at)
         VALUES ($1,$2,$3,'restriction','사유', now() - interval '1 hour', now() + interval '1 hour')`,
        [randomUUID(), user.id, adminId],
      );
      const blocked = await accept(user, goal.id, toAccept, {
        missions: [mission()],
      }).expect(403);
      expect(blocked.body.error.code).toBe('AUTH_ACCOUNT_RESTRICTED');
      await http
        .get(`/api/v1/goals/${goal.id}/proposals`)
        .set(auth(user.token))
        .expect(200);
      await http
        .post(`/api/v1/goals/${goal.id}/proposals/${toReject}/reject`)
        .set(auth(user.token))
        .expect(200);
      expect(
        (
          await row('SELECT status FROM ai_plan_proposals WHERE id = $1', [
            toAccept,
          ])
        )[0].status,
      ).toBe('draft');
    });

    it('인증이 필요', async () => {
      await http.get(`/api/v1/goals/${randomUUID()}/proposals`).expect(401);
      await http
        .post(`/api/v1/goals/${randomUUID()}/proposals/${randomUUID()}/accept`)
        .send({})
        .expect(401);
    });
  });
});
