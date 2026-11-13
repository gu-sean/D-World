import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { addDays, kstDate } from '../../src/common/time/kst.js';
import { createTestApp } from '../support/app.js';
import { createUser as createUserWith } from '../support/users.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)(
  '모바일 목표·계획 API A20~A28 (PostgreSQL)',
  () => {
    let app;
    let db;
    let http;
    let ref;

    const auth = (user) => ({ Authorization: `Bearer ${user.token}` });
    const day = (offset) => addDays(kstDate(), offset);

    beforeAll(async () => {
      ({ app, http, db } = await createTestApp());
      const adminId = newId();
      await db.query(
        `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
        [adminId, `mg_${RUN}`, `${adminId.toLowerCase()}@example.com`],
      );
      const category = newId();
      const difficulty = newId();
      await db.query(
        `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [category, `mgc${RUN}`, `모바일목표${RUN}`],
      );
      await db.query(
        `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [difficulty, `mgd${RUN}`, `모바일목표난이도${RUN}`],
      );
      await db.query(
        `INSERT INTO mission_reward_rate_versions
              (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,$3,1,100,10,5, now() - interval '1 day', $4)`,
        [newId(), category, difficulty, adminId],
      );
      ref = { categoryCode: `mgc${RUN}`, difficultyCode: `mgd${RUN}` };
    });

    afterAll(() => app.close());

    const goalInput = (overrides = {}) => ({
      title: '한 달 안에 스쿼트 50개',
      categoryCode: ref.categoryCode,
      difficultyCode: ref.difficultyCode,
      startDate: day(0),
      endDate: day(20),
      targetFrequency: 3,
      dailyAvailableMinutes: 30,
      ...overrides,
    });

    async function createGoal(user, overrides) {
      return http
        .post('/api/v1/goals')
        .set(auth(user))
        .send(goalInput(overrides))
        .expect(201);
    }

    it('A20·A21·A23·A22·A24 목표 CRUD와 모바일 키', async () => {
      const user = await createUserWith(app, db);
      const made = await createGoal(user);
      expect(made.body).toEqual(
        expect.objectContaining({
          categoryCode: ref.categoryCode,
          difficultyCode: ref.difficultyCode,
          dailyAvailableMinutes: 30,
          progressRate: 0,
          hasAcceptedPlan: false,
          status: 'active',
        }),
      );

      const list = await http
        .get(
          `/api/v1/goals?status=active,paused&categoryCode=${ref.categoryCode}`,
        )
        .set(auth(user))
        .expect(200);
      expect(list.body.items).toHaveLength(1);
      await http.get('/api/v1/goals?status=bogus').set(auth(user)).expect(400);

      const detail = await http
        .get(`/api/v1/goals/${made.body.id}`)
        .set(auth(user))
        .expect(200);
      expect(detail.body).toEqual(
        expect.objectContaining({
          steps: [],
          totalMissionCount: 0,
          completedMissionCount: 0,
          todayMissionIds: [],
        }),
      );

      const patched = await http
        .patch(`/api/v1/goals/${made.body.id}`)
        .set(auth(user))
        .send({ title: '바뀐 제목', status: 'paused' })
        .expect(200);
      expect(patched.body).toMatchObject({
        title: '바뀐 제목',
        status: 'paused',
      });

      await http
        .delete(`/api/v1/goals/${made.body.id}`)
        .set(auth(user))
        .expect(204);
    });

    it('A25 → A26 → A27 계획 제안 만들기, 조회, 수락', async () => {
      const user = await createUserWith(app, db);
      const goal = (await createGoal(user)).body;

      await http
        .get(`/api/v1/goals/${goal.id}/plan-proposals/latest`)
        .set(auth(user))
        .expect(404);

      const proposal = await http
        .post(`/api/v1/goals/${goal.id}/plan-proposals`)
        .set(auth(user))
        .expect(201);
      expect(proposal.body).toEqual(
        expect.objectContaining({
          goalId: goal.id,
          generationNo: 1,
          status: 'draft',
          summary: expect.any(String),
          engineVersion: expect.any(String),
          acceptedAt: null,
        }),
      );
      expect(proposal.body.steps.length).toBeGreaterThan(0);

      const latest = await http
        .get(`/api/v1/goals/${goal.id}/plan-proposals/latest`)
        .set(auth(user))
        .expect(200);
      expect(latest.body.id).toBe(proposal.body.id);

      // 다른 세대 번호로 수락하면 최신이 아님
      await http
        .post(`/api/v1/plan-proposals/${proposal.body.id}/accept`)
        .set(auth(user))
        .send({ generationNo: 99 })
        .expect(409);

      const accepted = await http
        .post(`/api/v1/plan-proposals/${proposal.body.id}/accept`)
        .set(auth(user))
        .send({ generationNo: 1 })
        .expect(201);
      expect(accepted.body.goal.hasAcceptedPlan).toBe(true);
      expect(accepted.body.createdMissionCount).toBeGreaterThan(0);
      expect(Array.isArray(accepted.body.todayMissions)).toBe(true);
    });

    it('A28 draft 제안 거절(204)', async () => {
      const user = await createUserWith(app, db);
      const goal = (await createGoal(user)).body;
      const proposal = await http
        .post(`/api/v1/goals/${goal.id}/plan-proposals`)
        .set(auth(user))
        .expect(201);
      await http
        .post(`/api/v1/plan-proposals/${proposal.body.id}/reject`)
        .set(auth(user))
        .send({ reason: '마음에 안 들어요' })
        .expect(204);
      const latest = await http
        .get(`/api/v1/goals/${goal.id}/plan-proposals/latest`)
        .set(auth(user))
        .expect(200);
      expect(latest.body.status).toBe('rejected');
    });
  },
);
