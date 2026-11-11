import { randomInt, randomUUID } from 'node:crypto';
import { kstDate } from '../../src/common/time/kst.js';
import { createTestApp } from '../support/app.js';
import { createUser as createUserWith } from '../support/users.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)(
  '모바일 상황 추천 API A90~A93 (PostgreSQL)',
  () => {
    let app;
    let db;
    let http;
    let definitionId;

    const auth = (user) => ({ Authorization: `Bearer ${user.token}` });
    const situational = (
      user,
      body = { kind: 'weather', latitude: 37.5, longitude: 127 },
    ) =>
      http
        .post('/api/v1/recommendations/situational')
        .set(auth(user))
        .send(body);

    beforeAll(async () => {
      ({ app, http, db } = await createTestApp());
      const adminId = randomUUID();
      await db.query(
        `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
        [adminId, `mrec_${RUN}`, `${adminId}@example.com`],
      );
      const category = randomUUID();
      const difficulty = randomUUID();
      await db.query(
        `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [category, `mrc${RUN}`, `추천카테고리${RUN}`],
      );
      await db.query(
        `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [difficulty, `mrd${RUN}`, `추천난이도${RUN}`],
      );
      await db.query(
        `INSERT INTO mission_reward_rate_versions
              (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,$3,1,100,10,5, now() - interval '1 day', $4)`,
        [randomUUID(), category, difficulty, adminId],
      );
      definitionId = randomUUID();
      await db.query(
        `INSERT INTO mission_definitions
              (id, origin, title, category_id, difficulty_id, estimated_duration_seconds,
               target_value, target_unit, verification_method, publication_status,
               exercise_code, base_points, base_user_xp, base_pet_xp)
       VALUES ($1,'admin',$2,$3,$4,300,15,'reps','camera','public','plank',70,7,3)`,
        [definitionId, `추천 틀 ${RUN}`, category, difficulty],
      );
    });

    afterAll(() => app.close());

    it('A90 추천을 받고 A93에서 다시 보이며, 10분 안에는 다시 받을 수 없음', async () => {
      const user = await createUserWith(app, db);
      const res = await situational(user).expect(201);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body.length).toBeLessThanOrEqual(3);

      const rec = res.body.find((r) => r.missionDefinition.id === definitionId);
      expect(rec).toEqual(
        expect.objectContaining({
          rankNo: expect.any(Number),
          title: `추천 틀 ${RUN}`,
          reason: expect.any(String),
          status: 'shown',
          rewardPreview: { points: 70, userXp: 7, petXp: 3 },
          expiresAt: expect.any(String),
        }),
      );
      // 좌표는 저장하지 않는다
      expect(rec.context).toEqual(
        expect.objectContaining({
          weather: 'clear',
          temperatureC: 20,
          timeSlot: expect.any(String),
          isMoving: false,
          outdoorSuitable: true,
        }),
      );
      expect(JSON.stringify(rec.context)).not.toMatch(/latitude|longitude/);

      const active = await http
        .get('/api/v1/recommendations/active')
        .set(auth(user))
        .expect(200);
      expect(active.body.map((r) => r.id).sort()).toEqual(
        res.body.map((r) => r.id).sort(),
      );

      await situational(user)
        .expect(429)
        .expect((again) =>
          expect(again.body.error.code).toBe('RECOMMENDATION_RATE_LIMITED'),
        );
    });

    it('A90 입력 검증', async () => {
      const user = await createUserWith(app, db);
      await situational(user, { kind: 'teleport' }).expect(400);
      await situational(user, { kind: 'location', latitude: 999 }).expect(400);
    });

    it('A91 수락하면 오늘 미션이 생기고 나머지 추천은 닫힘', async () => {
      const user = await createUserWith(app, db);
      const res = await situational(user).expect(201);
      const rec = res.body.find((r) => r.missionDefinition.id === definitionId);

      const mission = await http
        .post(`/api/v1/recommendations/${rec.id}/accept`)
        .set(auth(user))
        .expect(201);
      expect(mission.body).toEqual(
        expect.objectContaining({
          sourceType: 'template',
          scheduledDate: kstDate(),
          exerciseCode: 'plank',
          status: 'scheduled',
          challengeId: null,
        }),
      );

      const active = await http
        .get('/api/v1/recommendations/active')
        .set(auth(user))
        .expect(200);
      expect(active.body).toEqual([]);

      await http
        .post(`/api/v1/recommendations/${rec.id}/accept`)
        .set(auth(user))
        .expect(409)
        .expect((again) =>
          expect(again.body.error.code).toBe('RECOMMENDATION_NOT_OPEN'),
        );
    });

    it('A92 거절은 204이고 같은 추천을 다시 거절해도 성공, 남의 추천은 404', async () => {
      const user = await createUserWith(app, db);
      const res = await situational(user).expect(201);
      const [first] = res.body;
      await http
        .post(`/api/v1/recommendations/${first.id}/dismiss`)
        .set(auth(user))
        .send({})
        .expect(204);
      await http
        .post(`/api/v1/recommendations/${first.id}/dismiss`)
        .set(auth(user))
        .send({})
        .expect(204);
      const active = await http
        .get('/api/v1/recommendations/active')
        .set(auth(user))
        .expect(200);
      expect(active.body.map((r) => r.id)).not.toContain(first.id);

      const stranger = await createUserWith(app, db);
      await http
        .post(`/api/v1/recommendations/${first.id}/dismiss`)
        .set(auth(stranger))
        .send({})
        .expect(404);
    });

    it('A91 기한이 지난 추천은 410', async () => {
      const user = await createUserWith(app, db);
      const res = await situational(user).expect(201);
      const [first] = res.body;
      await db.withTransaction(async (tx) => {
        await tx.query('SET LOCAL session_replication_role = replica');
        await tx.query(
          `UPDATE ai_mission_recommendations
            SET created_at = now() - interval '5 hours',
                expires_at = now() - interval '1 hour'
          WHERE id = $1`,
          [first.id],
        );
      });
      await http
        .post(`/api/v1/recommendations/${first.id}/accept`)
        .set(auth(user))
        .expect(410)
        .expect((gone) =>
          expect(gone.body.error.code).toBe('RECOMMENDATION_EXPIRED'),
        );
    });
  },
);
