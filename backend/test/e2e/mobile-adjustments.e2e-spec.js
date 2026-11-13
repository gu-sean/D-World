import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { addDays, kstDate } from '../../src/common/time/kst.js';
import { createTestApp } from '../support/app.js';
import { createUser as createUserWith } from '../support/users.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)(
  '모바일 계획 재조정 API A50~A53 (PostgreSQL)',
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
        [adminId, `ma_${RUN}`, `${adminId.toLowerCase()}@example.com`],
      );
      const category = newId();
      const difficulty = newId();
      await db.query(
        `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [category, `mac${RUN}`, `재조정${RUN}`],
      );
      await db.query(
        `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [difficulty, `mad${RUN}`, `재조정난이도${RUN}`],
      );
      await db.query(
        `INSERT INTO mission_reward_rate_versions
              (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,$3,1,100,10,5, now() - interval '1 day', $4)`,
        [newId(), category, difficulty, adminId],
      );
      ref = { categoryCode: `mac${RUN}`, difficultyCode: `mad${RUN}` };
    });

    afterAll(() => app.close());

    async function proposedAdjustment(user) {
      const goal = await http
        .post('/api/v1/goals')
        .set(auth(user))
        .send({
          title: '재조정 목표',
          categoryCode: ref.categoryCode,
          difficultyCode: ref.difficultyCode,
          startDate: day(0),
          endDate: day(14),
        })
        .expect(201);
      const runId = newId();
      await db.query(
        `INSERT INTO ai_analysis_runs
              (id, user_id, run_type, period_start, period_end)
       VALUES ($1,$2,'plan_adjustment', $3, $4)`,
        [runId, user.id, day(-7), day(-1)],
      );
      const id = newId();
      const steps = [
        {
          stepNo: 1,
          title: '1단계',
          description: null,
          dueDate: day(7),
          missions: [
            {
              scheduledDate: day(2),
              title: '가볍게 걷기',
              categoryCode: ref.categoryCode,
              difficultyCode: ref.difficultyCode,
              verificationMethod: 'camera',
              isRequired: true,
            },
          ],
        },
      ];
      await db.query(
        `INSERT INTO plan_adjustment_proposals
              (id, run_id, user_id, goal_id, proposal_json, before_plan, reason, expires_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,'{}'::jsonb,'지난주 달성률이 낮아요', now() + interval '3 days')`,
        [id, runId, user.id, goal.body.id, JSON.stringify({ steps })],
      );
      // 결과는 열린(requested) 실행에만 붙으므로 제안을 넣은 뒤 실행을 완료한다
      await db.query(
        `UPDATE ai_analysis_runs
            SET status = 'completed', engine_version = 'test@1', completed_at = now()
          WHERE id = $1`,
        [runId],
      );
      return { id, goalId: goal.body.id };
    }

    it('A50·A51 목록과 상세', async () => {
      const user = await createUserWith(app, db);
      const made = await proposedAdjustment(user);
      const list = await http
        .get(
          `/api/v1/plan-adjustments?goalId=${made.goalId}&status=proposed,accepted`,
        )
        .set(auth(user))
        .expect(200);
      expect(list.body.items[0]).toEqual(
        expect.objectContaining({
          id: made.id,
          goalId: made.goalId,
          goalTitle: '재조정 목표',
          status: 'proposed',
          reason: '지난주 달성률이 낮아요',
          decidedAt: null,
        }),
      );
      expect(list.body.items[0].proposedPlan).toHaveLength(1);
      await http
        .get('/api/v1/plan-adjustments?status=bogus')
        .set(auth(user))
        .expect(400);

      const other = await createUserWith(app, db);
      await http
        .get(`/api/v1/plan-adjustments/${made.id}`)
        .set(auth(other))
        .expect(404);
    });

    it('A52 수락하면 미션이 만들어지고 다시 수락할 수 없음', async () => {
      const user = await createUserWith(app, db);
      const made = await proposedAdjustment(user);
      const res = await http
        .post(`/api/v1/plan-adjustments/${made.id}/accept`)
        .set(auth(user))
        .send({})
        .expect(201);
      expect(res.body.adjustment.status).toBe('accepted');
      expect(res.body.goal.id).toBe(made.goalId);
      expect(Array.isArray(res.body.todayMissions)).toBe(true);

      const missions = await http
        .get(`/api/v1/missions?goalId=${made.goalId}`)
        .set(auth(user))
        .expect(200);
      expect(missions.body.items).toHaveLength(1);

      await http
        .post(`/api/v1/plan-adjustments/${made.id}/accept`)
        .set(auth(user))
        .send({})
        .expect(409);
    });

    it('A53 거절(204) 후에는 수락할 수 없음', async () => {
      const user = await createUserWith(app, db);
      const made = await proposedAdjustment(user);
      await http
        .post(`/api/v1/plan-adjustments/${made.id}/reject`)
        .set(auth(user))
        .expect(204);
      const got = await http
        .get(`/api/v1/plan-adjustments/${made.id}`)
        .set(auth(user))
        .expect(200);
      expect(got.body.status).toBe('rejected');
      await http
        .post(`/api/v1/plan-adjustments/${made.id}/accept`)
        .set(auth(user))
        .send({})
        .expect(409);
    });
  },
);
