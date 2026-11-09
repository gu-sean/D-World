import { createUser as createUserWith } from '../support/users.js';
import { createTestApp } from '../support/app.js';
import { randomInt, randomUUID } from 'node:crypto';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { GoalsService } from '../../src/goals/goals.service.js';

// DATABASE_URL이 있을 때만 실행, 마이그레이션 적용 필요
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999); // 반복 실행해도 고유 값이 겹치지 않게

describe.skipIf(!databaseUrl)('목표·단계 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let goalsService;
  let adminId;
  let categoryId;
  let difficultyId;
  let refCodes;
  let counter = 0;

  const tx = (fn) => db.withTransaction(fn);
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const next = () => `${RUN}${counter++}`;

  const createUser = () => createUserWith(app, db);

  async function createReference(isActive = true) {
    const tag = next();
    const category = randomUUID();
    const difficulty = randomUUID();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order, is_active) VALUES ($1,$2,$3,1,$4)`,
      [category, `gc${tag}`, `목표카테고리${tag}`, isActive],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order, is_active) VALUES ($1,$2,$3,1,$4)`,
      [difficulty, `gd${tag}`, `목표난이도${tag}`, isActive],
    );
    return {
      category,
      difficulty,
      categoryCode: `gc${tag}`,
      difficultyCode: `gd${tag}`,
    };
  }

  const goalBody = (overrides = {}) => ({
    title: '매일 운동하기',
    categoryId,
    difficultyId,
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    ...overrides,
  });

  async function createGoal(user, overrides = {}) {
    const res = await http
      .post('/api/v1/goals')
      .set(auth(user.token))
      .send(goalBody(overrides))
      .expect(201);
    return res.body;
  }

  async function createStep(user, goalId, overrides = {}) {
    const res = await http
      .post(`/api/v1/goals/${goalId}/steps`)
      .set(auth(user.token))
      .send({ title: '1주차', dueDate: '2026-11-07', ...overrides })
      .expect(201);
    return res.body;
  }

  /** 미션 생성 API를 거치지 않고 직접 넣음 */
  async function insertMission(
    userId,
    goalId,
    stepId,
    {
      status = 'scheduled',
      required = true,
      date = '2026-11-05',
      deleted = false,
    } = {},
  ) {
    const id = randomUUID();
    await db.query(
      `INSERT INTO missions
              (id, user_id, goal_id, goal_step_id, source_type, title, category_id,
               difficulty_id, verification_method, scheduled_date, is_required, status,
               cancel_reason, cancelled_at, deleted_at)
       VALUES ($1,$2,$3,$4,'user','걷기',$5,$6,'sensor',$7,$8,$9,
               CASE WHEN $11::text = 'cancelled' THEN 'user_cancelled' END,
               CASE WHEN $11::text = 'cancelled' THEN now() END,
               CASE WHEN $10 THEN now() END)`,
      [
        id,
        userId,
        goalId,
        stepId,
        categoryId,
        difficultyId,
        date,
        required,
        status,
        deleted,
        status,
      ],
    );
    return id;
  }

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    goalsService = app.get(GoalsService);

    adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `gl_${RUN}`, `${adminId}@example.com`],
    );
    const reference = await createReference();
    ({ category: categoryId, difficulty: difficultyId } = reference);
    refCodes = reference;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('참조 데이터', () => {
    it('활성 카테고리·난이도만 보여 주고 인증이 필요', async () => {
      const user = await createUser();
      const inactive = await createReference(false);
      await http.get('/api/v1/categories').expect(401);

      const categories = await http
        .get('/api/v1/categories')
        .set(auth(user.token))
        .expect(200);
      const ids = categories.body.map((c) => c.id);
      expect(ids).toContain(categoryId);
      expect(ids).not.toContain(inactive.category);
      expect(categories.body[0]).toEqual(
        expect.objectContaining({
          code: expect.any(String),
          name: expect.any(String),
        }),
      );

      const levels = await http
        .get('/api/v1/difficulty-levels')
        .set(auth(user.token))
        .expect(200);
      expect(levels.body.map((d) => d.id)).toContain(difficultyId);
      expect(levels.body.map((d) => d.id)).not.toContain(inactive.difficulty);
    });
  });

  describe('목표 생성', () => {
    it('목표를 만들고 진행률은 0으로 시작', async () => {
      const user = await createUser();
      const goal = await createGoal(user, {
        description: '설명',
        targetFrequency: 3,
      });
      expect(goal).toMatchObject({
        title: '매일 운동하기',
        description: '설명',
        categoryCode: refCodes.categoryCode,
        difficultyCode: refCodes.difficultyCode,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        targetFrequency: 3,
        status: 'active',
        completedAt: null,
        progress: {
          missions: { total: 0, completed: 0, rate: 0 },
          steps: { total: 0, completed: 0, rate: 0 },
        },
      });
    });

    it('입력 검증: 제목·날짜·기간·횟수', async () => {
      const user = await createUser();
      const bad = [
        { title: '   ' },
        { title: 'a'.repeat(201) },
        { startDate: '2026-02-31' },
        { startDate: '20261101' },
        { targetFrequency: 8 },
        { targetFrequency: 0 },
        { targetFrequency: 1.5 },
        { categoryId: 'x' },
      ];
      for (const overrides of bad) {
        await http
          .post('/api/v1/goals')
          .set(auth(user.token))
          .send(goalBody(overrides))
          .expect(400);
      }
      const reversed = await http
        .post('/api/v1/goals')
        .set(auth(user.token))
        .send(goalBody({ endDate: '2026-10-31' }))
        .expect(400);
      expect(reversed.body.error.code).toBe('GOAL_INVALID_PERIOD');
      const long = await http
        .post('/api/v1/goals')
        .set(auth(user.token))
        .send(goalBody({ startDate: '2026-01-01', endDate: '2027-01-02' }))
        .expect(400);
      expect(long.body.error.code).toBe('GOAL_INVALID_PERIOD');
      // 366일은 허용
      await http
        .post('/api/v1/goals')
        .set(auth(user.token))
        .send(goalBody({ startDate: '2026-01-01', endDate: '2027-01-01' }))
        .expect(201);
    });

    it('없거나 비활성인 카테고리·난이도는 422', async () => {
      const user = await createUser();
      const inactive = await createReference(false);
      for (const overrides of [
        { categoryId: inactive.category },
        { difficultyId: inactive.difficulty },
        { categoryId: randomUUID() },
      ]) {
        const res = await http
          .post('/api/v1/goals')
          .set(auth(user.token))
          .send(goalBody(overrides))
          .expect(422);
        expect(res.body.error.code).toBe('INACTIVE_REFERENCE');
      }
    });

    it('진행 중 목표는 20개까지, 완료·삭제한 목표는 세지 않음', async () => {
      const user = await createUser();
      const goals = [];
      for (let i = 0; i < 20; i++) goals.push(await createGoal(user));
      const over = await http
        .post('/api/v1/goals')
        .set(auth(user.token))
        .send(goalBody())
        .expect(409);
      expect(over.body.error.code).toBe('GOAL_LIMIT_REACHED');

      await http
        .post(`/api/v1/goals/${goals[0].id}/complete`)
        .set(auth(user.token))
        .expect(200);
      await http
        .delete(`/api/v1/goals/${goals[1].id}`)
        .set(auth(user.token))
        .expect(204);
      await createGoal(user);
      await createGoal(user);
      await http
        .post('/api/v1/goals')
        .set(auth(user.token))
        .send(goalBody())
        .expect(409);
    });

    it('동시 생성에서도 상한을 넘지 않음', async () => {
      const user = await createUser();
      for (let i = 0; i < 18; i++) await createGoal(user);
      const results = await Promise.all(
        [1, 2, 3, 4, 5].map(() =>
          http.post('/api/v1/goals').set(auth(user.token)).send(goalBody()),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(2);
      expect(results.filter((r) => r.status === 409)).toHaveLength(3);
    });
  });

  describe('목표 조회', () => {
    it('목록은 최신순 커서 페이지네이션, 상태 필터, 삭제·남의 목표 제외', async () => {
      const user = await createUser();
      const other = await createUser();
      const goals = [];
      for (let i = 0; i < 5; i++)
        goals.push(await createGoal(user, { title: `목표${i}` }));
      await createGoal(other);
      await http
        .delete(`/api/v1/goals/${goals[4].id}`)
        .set(auth(user.token))
        .expect(204);
      await http
        .post(`/api/v1/goals/${goals[3].id}/pause`)
        .set(auth(user.token))
        .expect(200);

      const seen = [];
      let cursor;
      for (let page = 0; page < 5; page++) {
        const res = await http
          .get('/api/v1/goals')
          .query({ limit: 2, ...(cursor ? { cursor } : {}) })
          .set(auth(user.token))
          .expect(200);
        seen.push(...res.body.items.map((g) => g.id));
        cursor = res.body.nextCursor;
        if (!cursor) break;
      }
      expect(seen).toEqual([
        goals[3].id,
        goals[2].id,
        goals[1].id,
        goals[0].id,
      ]);

      const paused = await http
        .get('/api/v1/goals')
        .query({ status: 'paused' })
        .set(auth(user.token))
        .expect(200);
      expect(paused.body.items.map((g) => g.id)).toEqual([goals[3].id]);

      await http
        .get('/api/v1/goals')
        .query({ limit: 0 })
        .set(auth(user.token))
        .expect(400);
      await http
        .get('/api/v1/goals')
        .query({ status: 'x' })
        .set(auth(user.token))
        .expect(400);
      await http
        .get('/api/v1/goals')
        .query({ cursor: 'zzz' })
        .set(auth(user.token))
        .expect(400);
    });

    it('상세는 단계와 진행률을 포함하고, 남의 목표나 잘못된 id는 거절', async () => {
      const user = await createUser();
      const other = await createUser();
      const goal = await createGoal(user);
      const step = await createStep(user, goal.id);
      await insertMission(user.id, goal.id, step.id, { status: 'completed' });
      await insertMission(user.id, goal.id, step.id);
      await insertMission(user.id, goal.id, step.id, { status: 'cancelled' });
      await insertMission(user.id, goal.id, step.id, {
        status: 'completed',
        deleted: true,
      });
      await insertMission(user.id, goal.id, step.id, {
        status: 'scheduled',
        required: false,
      });

      const res = await http
        .get(`/api/v1/goals/${goal.id}`)
        .set(auth(user.token))
        .expect(200);
      expect(res.body.progress.missions).toEqual({
        total: 3,
        completed: 1,
        rate: 0.3333,
      });
      expect(res.body.progress.steps).toEqual({
        total: 1,
        completed: 0,
        rate: 0,
      });
      expect(res.body.steps).toHaveLength(1);
      expect(res.body.steps[0]).toMatchObject({
        stepNo: 1,
        title: '1주차',
        status: 'active',
        // 필수 미션만 센다(선택·취소·삭제 제외)
        requiredMissions: { total: 2, completed: 1 },
      });

      const list = await http
        .get('/api/v1/goals')
        .set(auth(user.token))
        .expect(200);
      expect(list.body.items[0].progress.missions.total).toBe(3);

      const stranger = await http
        .get(`/api/v1/goals/${goal.id}`)
        .set(auth(other.token))
        .expect(404);
      expect(stranger.body.error.code).toBe('GOAL_NOT_FOUND');
      await http
        .get('/api/v1/goals/not-a-uuid')
        .set(auth(user.token))
        .expect(400);
      await http
        .get(`/api/v1/goals/${randomUUID()}`)
        .set(auth(user.token))
        .expect(404);
    });
  });

  describe('목표 수정', () => {
    it('필드를 수정하고 설명은 빈 문자열로 지움', async () => {
      const user = await createUser();
      const goal = await createGoal(user, { description: '처음' });
      const res = await http
        .patch(`/api/v1/goals/${goal.id}`)
        .set(auth(user.token))
        .send({ title: '새 제목', targetFrequency: 5 })
        .expect(200);
      expect(res.body).toMatchObject({
        title: '새 제목',
        targetFrequency: 5,
        description: '처음',
      });

      const cleared = await http
        .patch(`/api/v1/goals/${goal.id}`)
        .set(auth(user.token))
        .send({ description: '' })
        .expect(200);
      expect(cleared.body.description).toBeNull();

      await http
        .patch(`/api/v1/goals/${goal.id}`)
        .set(auth(user.token))
        .send({})
        .expect(400);
      await http
        .patch(`/api/v1/goals/${goal.id}`)
        .set(auth(user.token))
        .send({ title: ' ' })
        .expect(400);
    });

    it('기간을 줄일 때 기간 밖 미션·단계가 있으면 거절', async () => {
      const user = await createUser();
      const goal = await createGoal(user);
      const step = await createStep(user, goal.id, { dueDate: '2026-11-20' });
      await insertMission(user.id, goal.id, step.id, { date: '2026-11-25' });

      const missions = await http
        .patch(`/api/v1/goals/${goal.id}`)
        .set(auth(user.token))
        .send({ endDate: '2026-11-22' })
        .expect(422);
      expect(missions.body.error.code).toBe('PLAN_INVALID');

      // 취소한 미션은 영향 없음, 단계 마감일은 막음
      const goal2 = await createGoal(user);
      await createStep(user, goal2.id, { dueDate: '2026-11-20' });
      await insertMission(user.id, goal2.id, null, {
        date: '2026-11-25',
        status: 'cancelled',
      });
      const steps = await http
        .patch(`/api/v1/goals/${goal2.id}`)
        .set(auth(user.token))
        .send({ endDate: '2026-11-15' })
        .expect(422);
      expect(steps.body.error.code).toBe('PLAN_INVALID');

      await http
        .patch(`/api/v1/goals/${goal2.id}`)
        .set(auth(user.token))
        .send({ endDate: '2026-11-21' })
        .expect(200);
      const reversed = await http
        .patch(`/api/v1/goals/${goal2.id}`)
        .set(auth(user.token))
        .send({ startDate: '2026-12-01' })
        .expect(400);
      expect(reversed.body.error.code).toBe('GOAL_INVALID_PERIOD');
    });

    it('카테고리·난이도를 바꿀 수 있고 비활성 값은 거절, 남의 목표는 404', async () => {
      const user = await createUser();
      const other = await createUser();
      const goal = await createGoal(user);
      const fresh = await createReference();
      const changed = await http
        .patch(`/api/v1/goals/${goal.id}`)
        .set(auth(user.token))
        .send({ categoryId: fresh.category, difficultyId: fresh.difficulty })
        .expect(200);
      expect(changed.body).toMatchObject({
        categoryCode: fresh.categoryCode,
        difficultyCode: fresh.difficultyCode,
      });

      const inactive = await createReference(false);
      await http
        .patch(`/api/v1/goals/${goal.id}`)
        .set(auth(user.token))
        .send({ categoryId: inactive.category })
        .expect(422);
      await http
        .patch(`/api/v1/goals/${goal.id}`)
        .set(auth(other.token))
        .send({ title: '남의 것' })
        .expect(404);
    });
  });

  describe('상태 전이', () => {
    it('일시정지·재개·완료·완료 취소', async () => {
      const user = await createUser();
      const goal = await createGoal(user);
      const post = (action) =>
        http.post(`/api/v1/goals/${goal.id}/${action}`).set(auth(user.token));

      expect((await post('pause').expect(200)).body.status).toBe('paused');
      const invalid = await post('pause').expect(409);
      expect(invalid.body.error).toMatchObject({
        code: 'ADMIN_STATE_CONFLICT',
        details: { status: 'paused', action: 'pause' },
      });
      expect((await post('resume').expect(200)).body.status).toBe('active');
      await post('resume').expect(409);
      await post('reopen').expect(409);

      const done = await post('complete').expect(200);
      expect(done.body.status).toBe('completed');
      expect(done.body.completedAt).toEqual(expect.any(String));
      expect(Array.isArray(done.body.achievements)).toBe(true);
      await post('complete').expect(409);
      await post('pause').expect(409);

      const reopened = await post('reopen').expect(200);
      expect(reopened.body.status).toBe('active');
      expect(reopened.body.completedAt).toBeNull();

      // 일시정지 상태에서도 완료 확정 가능
      await post('pause').expect(200);
      await post('complete').expect(200);
    });

    it('완료 확정이 첫 목표 완료 업적을 평가해 지급', async () => {
      const user = await createUser();
      const definitionId = randomUUID();
      const tag = next();
      await db.query(
        `INSERT INTO achievement_definitions (id, code, status, created_by_admin_id)
         VALUES ($1, $2, 'public', $3)`,
        [definitionId, `first_goal_${tag}`, adminId],
      );
      const imageId = randomUUID();
      await db.query(
        `INSERT INTO achievement_badge_images
                (id, achievement_id, version_no, r2_object_key, mime_type, size_bytes,
                 uploaded_at, created_by_admin_id)
         VALUES ($1,$2,1,$3,'image/png',10,now() - interval '1 day',$4)`,
        [imageId, definitionId, `badge/goal${tag}`, adminId],
      );
      await db.query(
        `INSERT INTO achievement_versions
                (id, achievement_id, version_no, title, description, rarity, condition_type,
                 target_count, reward_points, badge_image_id, effective_at, created_by_admin_id)
         VALUES ($1,$2,1,'첫 목표','첫 목표를 완료한다','common','first_goal_completed',
                 1,0,$3, now() - interval '1 day', $4)`,
        [randomUUID(), definitionId, imageId, adminId],
      );

      try {
        const goal = await createGoal(user);
        const res = await http
          .post(`/api/v1/goals/${goal.id}/complete`)
          .set(auth(user.token))
          .expect(200);
        expect(res.body.achievements.map((a) => a.achievementId)).toContain(
          definitionId,
        );
        const { rows } = await db.query(
          'SELECT status FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
          [user.id, definitionId],
        );
        expect(rows).toEqual([{ status: 'active' }]);
      } finally {
        // 공개 상태로 남으면 이후 다른 스위트의 첫 목표 완료 평가에 섞이므로 숨김 처리
        await db.query(
          `UPDATE achievement_definitions SET status = 'hidden' WHERE id = $1`,
          [definitionId],
        );
      }
    });

    it('남의 목표 전이는 404', async () => {
      const user = await createUser();
      const other = await createUser();
      const goal = await createGoal(user);
      await http
        .post(`/api/v1/goals/${goal.id}/pause`)
        .set(auth(other.token))
        .expect(404);
    });
  });

  describe('목표 삭제', () => {
    it('소프트 삭제하고 시작 전 미션만 취소, 시작·완료한 미션은 유지', async () => {
      const user = await createUser();
      const goal = await createGoal(user);
      const scheduled = await insertMission(user.id, goal.id, null);
      const inProgress = await insertMission(user.id, goal.id, null, {
        status: 'in_progress',
      });
      const completed = await insertMission(user.id, goal.id, null, {
        status: 'completed',
      });

      await http
        .delete(`/api/v1/goals/${goal.id}`)
        .set(auth(user.token))
        .expect(204);
      await http
        .get(`/api/v1/goals/${goal.id}`)
        .set(auth(user.token))
        .expect(404);
      await http
        .delete(`/api/v1/goals/${goal.id}`)
        .set(auth(user.token))
        .expect(404);

      const { rows } = await db.query(
        `SELECT id, status, cancel_reason, deleted_at IS NOT NULL AS deleted
           FROM missions WHERE goal_id = $1`,
        [goal.id],
      );
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
      expect(byId[scheduled]).toMatchObject({
        status: 'cancelled',
        cancel_reason: 'goal_deleted',
        deleted: true,
      });
      expect(byId[inProgress]).toMatchObject({
        status: 'in_progress',
        deleted: false,
      });
      expect(byId[completed]).toMatchObject({
        status: 'completed',
        deleted: false,
      });
    });

    it('삭제된 목표에는 단계를 추가할 수 없음', async () => {
      const user = await createUser();
      const goal = await createGoal(user);
      await http
        .delete(`/api/v1/goals/${goal.id}`)
        .set(auth(user.token))
        .expect(204);
      await http
        .post(`/api/v1/goals/${goal.id}/steps`)
        .set(auth(user.token))
        .send({ title: '단계', dueDate: '2026-11-07' })
        .expect(404);
    });
  });

  describe('단계', () => {
    it('번호는 1부터 순서대로, 동시 생성에서도 겹치지 않음', async () => {
      const user = await createUser();
      const goal = await createGoal(user);
      const first = await createStep(user, goal.id);
      expect(first).toMatchObject({
        stepNo: 1,
        status: 'active',
        goalId: goal.id,
      });

      const results = await Promise.all(
        [1, 2, 3, 4, 5].map((i) =>
          http
            .post(`/api/v1/goals/${goal.id}/steps`)
            .set(auth(user.token))
            .send({ title: `단계${i}`, dueDate: '2026-11-10' }),
        ),
      );
      expect(results.every((r) => r.status === 201)).toBe(true);
      expect(results.map((r) => r.body.stepNo).sort()).toEqual([2, 3, 4, 5, 6]);
    });

    it('마감일은 목표 기간 안, 완료된 목표에는 추가 불가, 목표당 30개', async () => {
      const user = await createUser();
      const goal = await createGoal(user);
      for (const dueDate of ['2026-10-31', '2026-12-01']) {
        const res = await http
          .post(`/api/v1/goals/${goal.id}/steps`)
          .set(auth(user.token))
          .send({ title: '단계', dueDate })
          .expect(422);
        expect(res.body.error.code).toBe('STEP_DUE_OUT_OF_PERIOD');
      }
      await http
        .post(`/api/v1/goals/${goal.id}/steps`)
        .set(auth(user.token))
        .send({ title: '단계', dueDate: '2026-11-01' })
        .expect(201);

      for (let i = 1; i < 30; i++) await createStep(user, goal.id);
      const over = await http
        .post(`/api/v1/goals/${goal.id}/steps`)
        .set(auth(user.token))
        .send({ title: '단계', dueDate: '2026-11-07' })
        .expect(409);
      expect(over.body.error.code).toBe('STEP_LIMIT_REACHED');

      const done = await createGoal(user);
      await http
        .post(`/api/v1/goals/${done.id}/complete`)
        .set(auth(user.token))
        .expect(200);
      const completed = await http
        .post(`/api/v1/goals/${done.id}/steps`)
        .set(auth(user.token))
        .send({ title: '단계', dueDate: '2026-11-07' })
        .expect(409);
      expect(completed.body.error.code).toBe('GOAL_ALREADY_COMPLETED');
    });

    it('단계 수정과 남의 목표·다른 목표의 단계 접근 거절', async () => {
      const user = await createUser();
      const other = await createUser();
      const goal = await createGoal(user);
      const otherGoal = await createGoal(user);
      const step = await createStep(user, goal.id);

      const res = await http
        .patch(`/api/v1/goals/${goal.id}/steps/${step.id}`)
        .set(auth(user.token))
        .send({
          title: '바뀐 단계',
          dueDate: '2026-11-14',
          description: '메모',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        title: '바뀐 단계',
        dueDate: '2026-11-14',
        description: '메모',
        stepNo: 1,
      });
      await http
        .patch(`/api/v1/goals/${goal.id}/steps/${step.id}`)
        .set(auth(user.token))
        .send({ dueDate: '2026-12-31' })
        .expect(422);
      await http
        .patch(`/api/v1/goals/${goal.id}/steps/${step.id}`)
        .set(auth(user.token))
        .send({})
        .expect(400);

      await http
        .patch(`/api/v1/goals/${goal.id}/steps/${step.id}`)
        .set(auth(other.token))
        .send({ title: '남의 것' })
        .expect(404);
      const wrongGoal = await http
        .patch(`/api/v1/goals/${otherGoal.id}/steps/${step.id}`)
        .set(auth(user.token))
        .send({ title: '잘못된 목표' })
        .expect(404);
      expect(wrongGoal.body.error.code).toBe('STEP_NOT_FOUND');
    });

    it('삭제: 시작 전 미션은 단계 연결만 풀고, 이력이 있으면 거절', async () => {
      const user = await createUser();
      const goal = await createGoal(user);
      const clean = await createStep(user, goal.id);
      const scheduled = await insertMission(user.id, goal.id, clean.id);

      await http
        .delete(`/api/v1/goals/${goal.id}/steps/${clean.id}`)
        .set(auth(user.token))
        .expect(204);
      const { rows } = await db.query(
        'SELECT goal_id, goal_step_id, status, deleted_at FROM missions WHERE id = $1',
        [scheduled],
      );
      expect(rows[0]).toMatchObject({
        goal_id: goal.id,
        goal_step_id: null,
        status: 'scheduled',
        deleted_at: null,
      });

      for (const status of ['in_progress', 'completed', 'cancelled']) {
        const step = await createStep(user, goal.id);
        const mission = await insertMission(user.id, goal.id, step.id, {
          status,
        });
        const res = await http
          .delete(`/api/v1/goals/${goal.id}/steps/${step.id}`)
          .set(auth(user.token))
          .expect(409);
        expect(res.body.error.code).toBe('STEP_HAS_HISTORY');
        // 단계와 미션 행이 그대로 남아 있음
        const still = await db.query(
          'SELECT goal_step_id FROM missions WHERE id = $1',
          [mission],
        );
        expect(still.rows[0].goal_step_id).toBe(step.id);
      }
      await http
        .delete(`/api/v1/goals/${goal.id}/steps/${randomUUID()}`)
        .set(auth(user.token))
        .expect(404);
    });
  });

  describe('단계 자동 완료', () => {
    // 종료일이 지난 단계를 만들려고 과거 기간의 목표를 씀
    async function pastGoal(user) {
      const goal = await createGoal(user, {
        startDate: '2020-01-01',
        endDate: '2020-12-31',
      });
      const step = await createStep(user, goal.id, { dueDate: '2020-03-01' });
      return { goal, step };
    }
    const reevaluate = (stepId) =>
      tx((t) => goalsService.reevaluateStep(t, stepId));
    const stepStatus = async (stepId) =>
      (
        await db.query(
          'SELECT status, completed_at FROM goal_steps WHERE id = $1',
          [stepId],
        )
      ).rows[0];

    it('종료일이 지나고 필수 미션이 모두 완료되면 완료, 새 필수 미션이 생기면 다시 열림', async () => {
      const user = await createUser();
      const { goal, step } = await pastGoal(user);
      await insertMission(user.id, goal.id, step.id, {
        status: 'completed',
        date: '2020-02-01',
      });
      await insertMission(user.id, goal.id, step.id, {
        status: 'completed',
        date: '2020-02-02',
      });
      // 선택·취소·삭제 미션은 판단에서 제외
      await insertMission(user.id, goal.id, step.id, {
        status: 'scheduled',
        required: false,
        date: '2020-02-03',
      });
      await insertMission(user.id, goal.id, step.id, {
        status: 'cancelled',
        date: '2020-02-04',
      });
      await insertMission(user.id, goal.id, step.id, {
        status: 'scheduled',
        date: '2020-02-05',
        deleted: true,
      });

      expect(await reevaluate(step.id)).toBe('completed');
      const done = await stepStatus(step.id);
      expect(done.status).toBe('completed');
      expect(done.completed_at).not.toBeNull();
      expect(await reevaluate(step.id)).toBe('unchanged');

      const detail = await http
        .get(`/api/v1/goals/${goal.id}`)
        .set(auth(user.token))
        .expect(200);
      expect(detail.body.progress.steps).toEqual({
        total: 1,
        completed: 1,
        rate: 1,
      });

      await insertMission(user.id, goal.id, step.id, { date: '2020-02-06' });
      expect(await reevaluate(step.id)).toBe('reopened');
      expect(await stepStatus(step.id)).toMatchObject({
        status: 'active',
        completed_at: null,
      });
    });

    it('필수 미션이 없거나 미완료가 있거나 종료일 전이면 완료하지 않음', async () => {
      const user = await createUser();
      const { goal, step } = await pastGoal(user);
      expect(await reevaluate(step.id)).toBe('unchanged'); // 미션 없음

      await insertMission(user.id, goal.id, step.id, {
        status: 'completed',
        required: false,
        date: '2020-02-01',
      });
      expect(await reevaluate(step.id)).toBe('unchanged'); // 필수 미션 없음

      await insertMission(user.id, goal.id, step.id, {
        status: 'failed',
        date: '2020-02-02',
      });
      expect(await reevaluate(step.id)).toBe('unchanged'); // 실패한 필수 미션

      const future = await createStep(user, goal.id, { dueDate: '2020-12-31' });
      const futureGoal = await createGoal(user, {
        startDate: '2099-01-01',
        endDate: '2099-12-31',
      });
      const futureStep = await createStep(user, futureGoal.id, {
        dueDate: '2099-06-01',
      });
      await insertMission(user.id, futureGoal.id, futureStep.id, {
        status: 'completed',
        date: '2099-05-01',
      });
      expect(await reevaluate(futureStep.id)).toBe('unchanged'); // 종료일 전
      expect(await reevaluate(future.id)).toBe('unchanged');
    });

    it('마감일을 뒤로 미루면 완료된 단계가 다시 열리고, 정리 작업이 종료일 지난 단계를 완료', async () => {
      const user = await createUser();
      const { goal, step } = await pastGoal(user);
      await insertMission(user.id, goal.id, step.id, {
        status: 'completed',
        date: '2020-02-01',
      });

      const swept = await goalsService.sweepDueSteps({ limit: 10_000 });
      expect(swept.completed).toBeGreaterThanOrEqual(1);
      expect((await stepStatus(step.id)).status).toBe('completed');

      await http
        .patch(`/api/v1/goals/${goal.id}/steps/${step.id}`)
        .set(auth(user.token))
        .send({ dueDate: '2020-12-31' })
        .expect(200);
      expect((await stepStatus(step.id)).status).toBe('completed'); // 여전히 과거

      const futureGoal = await createGoal(user, {
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });
      const futureStep = await createStep(user, futureGoal.id, {
        dueDate: '2026-01-15',
      });
      await insertMission(user.id, futureGoal.id, futureStep.id, {
        status: 'completed',
        date: '2020-02-01',
      });
      expect(await reevaluate(futureStep.id)).toBe('completed');
      await http
        .patch(`/api/v1/goals/${futureGoal.id}/steps/${futureStep.id}`)
        .set(auth(user.token))
        .send({ dueDate: '2026-12-01' })
        .expect(200);
      expect((await stepStatus(futureStep.id)).status).toBe('active');
    });
  });

  describe('이용 제한', () => {
    it('제한 중에는 새로 만드는 쓰기를 막고 조회·삭제·정지는 허용', async () => {
      const user = await createUser();
      const goal = await createGoal(user);
      const step = await createStep(user, goal.id);
      await db.query(
        `INSERT INTO account_actions
                (id, user_id, admin_id, action_type, reason, starts_at, ends_at)
         VALUES ($1,$2,$3,'restriction','사유', now() - interval '1 hour', now() + interval '1 hour')`,
        [randomUUID(), user.id, adminId],
      );

      for (const [method, path, body] of [
        ['post', '/api/v1/goals', goalBody()],
        [
          'post',
          `/api/v1/goals/${goal.id}/steps`,
          { title: '단계', dueDate: '2026-11-07' },
        ],
        ['post', `/api/v1/goals/${goal.id}/complete`, undefined],
      ]) {
        const res = await http[method](path)
          .set(auth(user.token))
          .send(body)
          .expect(403);
        expect(res.body.error.code).toBe('AUTH_ACCOUNT_RESTRICTED');
      }

      await http.get('/api/v1/goals').set(auth(user.token)).expect(200);
      await http
        .get(`/api/v1/goals/${goal.id}`)
        .set(auth(user.token))
        .expect(200);
      await http
        .patch(`/api/v1/goals/${goal.id}/steps/${step.id}`)
        .set(auth(user.token))
        .send({ title: '수정' })
        .expect(200);
      await http
        .post(`/api/v1/goals/${goal.id}/pause`)
        .set(auth(user.token))
        .expect(200);
      await http
        .post(`/api/v1/goals/${goal.id}/resume`)
        .set(auth(user.token))
        .expect(200);
      await http
        .delete(`/api/v1/goals/${goal.id}/steps/${step.id}`)
        .set(auth(user.token))
        .expect(204);
      await http
        .delete(`/api/v1/goals/${goal.id}`)
        .set(auth(user.token))
        .expect(204);
    });
  });
});
