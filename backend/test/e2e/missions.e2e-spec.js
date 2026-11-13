import { createUser as createUserWith } from '../support/users.js';
import { createTestApp } from '../support/app.js';
import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { addDays, kstDate, kstDayStart } from '../../src/common/time/kst.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { GoalsService } from '../../src/goals/goals.service.js';

// DATABASE_URL이 있을 때만 실행, 마이그레이션 적용 필요
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999); // 반복 실행해도 고유 값이 겹치지 않게

describe.skipIf(!databaseUrl)('미션 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let goalsService;
  let adminId;
  let counter = 0;

  const tx = (fn) => db.withTransaction(fn);
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const next = () => `${RUN}${counter++}`;
  const today = () => kstDate();
  const day = (offset) => addDays(today(), offset);

  const createUser = () => createUserWith(app, db);

  /** 카테고리·난이도 한 쌍, rate를 주면 보상표 버전 1도 함께 만듦 */
  async function createReference({ rate, isActive = true } = {}) {
    const tag = next();
    const category = newId();
    const difficulty = newId();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order, is_active) VALUES ($1,$2,$3,1,$4)`,
      [category, `mc${tag}`, `미션카테고리${tag}`, isActive],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order, is_active) VALUES ($1,$2,$3,1,$4)`,
      [difficulty, `md${tag}`, `미션난이도${tag}`, isActive],
    );
    const ref = {
      category,
      difficulty,
      categoryCode: `mc${tag}`,
      difficultyCode: `md${tag}`,
      rates: [],
    };
    if (rate) ref.rates.push(await createRate(ref, { versionNo: 1, ...rate }));
    return ref;
  }

  async function createRate(
    ref,
    {
      versionNo,
      points,
      userXp = 0,
      petXp = 0,
      effectiveAt = "now() - interval '1 day'",
    },
  ) {
    const id = newId();
    await db.query(
      `INSERT INTO mission_reward_rate_versions
              (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7, ${effectiveAt}, $8)`,
      [
        id,
        ref.category,
        ref.difficulty,
        versionNo,
        points,
        userXp,
        petXp,
        adminId,
      ],
    );
    return id;
  }

  const DEFAULT_RATE = { points: 100, userXp: 10, petXp: 5 };

  const body = (ref, overrides = {}) => ({
    title: '30분 걷기',
    categoryId: ref.category,
    difficultyId: ref.difficulty,
    verificationMethod: 'sensor',
    scheduledDates: [day(1)],
    ...overrides,
  });

  async function post(user, payload, expected = 201) {
    return http
      .post('/api/v1/missions')
      .set(auth(user.token))
      .send(payload)
      .expect(expected);
  }

  async function createGoal(user, ref, overrides = {}) {
    const res = await http
      .post('/api/v1/goals')
      .set(auth(user.token))
      .send({
        title: '운동 목표',
        categoryId: ref.category,
        difficultyId: ref.difficulty,
        startDate: day(-30),
        endDate: day(30),
        ...overrides,
      })
      .expect(201);
    return res.body;
  }

  async function createStep(user, goalId, dueDate) {
    const res = await http
      .post(`/api/v1/goals/${goalId}/steps`)
      .set(auth(user.token))
      .send({ title: '단계', dueDate })
      .expect(201);
    return res.body;
  }

  /** 수행 상태가 필요한 미션은 직접 넣음 */
  async function insertMission(
    userId,
    ref,
    {
      goalId = null,
      stepId = null,
      status = 'scheduled',
      required = true,
      date = day(1),
    } = {},
  ) {
    const id = newId();
    await db.query(
      `INSERT INTO missions
              (id, user_id, goal_id, goal_step_id, source_type, title, category_id,
               difficulty_id, verification_method, scheduled_date, is_required, status,
               cancel_reason, cancelled_at)
       VALUES ($1,$2,$3,$4,'user','걷기',$5,$6,'sensor',$7,$8,$9,
               CASE WHEN $10::text = 'cancelled' THEN 'user_cancelled' END,
               CASE WHEN $10::text = 'cancelled' THEN now() END)`,
      [
        id,
        userId,
        goalId,
        stepId,
        ref.category,
        ref.difficulty,
        date,
        required,
        status,
        status,
      ],
    );
    return id;
  }

  async function createDefinition(
    ref,
    {
      origin = 'user',
      ownerId = null,
      status = 'private',
      basePoints = 0,
      baseUserXp = 0,
      basePetXp = 0,
      deleted = false,
    } = {},
  ) {
    const id = newId();
    await db.query(
      `INSERT INTO mission_definitions
              (id, origin, created_by_user_id, title, description, category_id, difficulty_id,
               estimated_duration_seconds, target_value, target_unit, verification_method,
               publication_status, base_points, base_user_xp, base_pet_xp, deleted_at)
       VALUES ($1,$2,$3,'원형 미션','원형 설명',$4,$5,1800,30,'분','sensor',
               $6,$7,$8,$9, CASE WHEN $10 THEN now() END)`,
      [
        id,
        origin,
        ownerId,
        ref.category,
        ref.difficulty,
        status,
        basePoints,
        baseUserXp,
        basePetXp,
        deleted,
      ],
    );
    return id;
  }

  const row = async (id) =>
    (await db.query('SELECT * FROM missions WHERE id = $1', [id])).rows[0];

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    goalsService = app.get(GoalsService);

    adminId = newId();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `ms_${RUN}`, `${adminId.toLowerCase()}@example.com`],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('직접 생성과 보상 확정', () => {
    it('보상표의 포인트·XP를 복사하고 마감은 예정일 다음 날 00:00(KST)', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const date = day(2);
      const res = await post(
        user,
        body(ref, { scheduledDates: [date], description: '설명' }),
      );

      expect(res.body.items).toHaveLength(1);
      const mission = res.body.items[0];
      expect(mission).toMatchObject({
        title: '30분 걷기',
        description: '설명',
        sourceType: 'user',
        status: 'scheduled',
        scheduledDate: date,
        verificationMethod: 'sensor',
        isRequired: true,
        goalId: null,
        stepId: null,
        definitionId: null,
        reward: { points: 100, userXp: 10, petXp: 5 },
      });
      expect(mission.dueAt).toBe(kstDayStart(addDays(date, 1)).toISOString());
      const saved = await row(mission.id);
      expect(saved.reward_rate_version_id).toBe(ref.rates[0]);
    });

    it('날짜마다 별도 행을 만들고 중복 날짜는 하나로 합침, 보상은 모두 같음', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const res = await post(
        user,
        body(ref, {
          scheduledDates: [day(3), day(1), day(2), day(2)],
          targetValue: 30,
          targetUnit: '분',
        }),
      );
      expect(res.body.items.map((m) => m.scheduledDate)).toEqual([
        day(1),
        day(2),
        day(3),
      ]);
      expect(new Set(res.body.items.map((m) => m.id)).size).toBe(3);
      expect(res.body.items.every((m) => m.reward.points === 100)).toBe(true);
      expect(res.body.items[0]).toMatchObject({
        targetValue: 30,
        targetUnit: '분',
      });
    });

    it('보상표가 없으면 생성을 거절하고 아무 행도 만들지 않음', async () => {
      const user = await createUser();
      const ref = await createReference();
      const res = await post(
        user,
        body(ref, { scheduledDates: [day(1), day(2)] }),
        422,
      );
      expect(res.body.error).toMatchObject({
        code: 'REWARD_RATE_MISSING',
        details: { categoryId: ref.category, difficultyId: ref.difficulty },
      });
      const { rows } = await db.query(
        'SELECT 1 FROM missions WHERE user_id = $1',
        [user.id],
      );
      expect(rows).toHaveLength(0);
    });

    it('가장 최근 유효 버전을 쓰고, 이후 새 버전이 나와도 이미 만든 미션의 보상은 그대로', async () => {
      const user = await createUser();
      const ref = await createReference({
        rate: { points: 10, userXp: 1, petXp: 1 },
      });
      const v2 = await createRate(ref, {
        versionNo: 2,
        points: 50,
        userXp: 5,
        petXp: 3,
      });
      // 시행 전 버전은 무시
      await createRate(ref, {
        versionNo: 3,
        points: 999,
        effectiveAt: "now() + interval '7 days'",
      });

      const first = (await post(user, body(ref))).body.items[0];
      expect(first.reward).toEqual({ points: 50, userXp: 5, petXp: 3 });
      expect((await row(first.id)).reward_rate_version_id).toBe(v2);

      const v4 = await createRate(ref, {
        versionNo: 4,
        points: 70,
        userXp: 7,
        petXp: 4,
      });
      const second = (await post(user, body(ref, { scheduledDates: [day(2)] })))
        .body.items[0];
      expect(second.reward).toEqual({ points: 70, userXp: 7, petXp: 4 });
      expect((await row(second.id)).reward_rate_version_id).toBe(v4);

      const unchanged = await http
        .get(`/api/v1/missions/${first.id}`)
        .set(auth(user.token))
        .expect(200);
      expect(unchanged.body.reward).toEqual({
        points: 50,
        userXp: 5,
        petXp: 3,
      });
    });

    it('보상은 생성 뒤 DB에서도 바꿀 수 없음', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const mission = (await post(user, body(ref))).body.items[0];
      for (const sql of [
        'UPDATE missions SET reward_points = 1 WHERE id = $1',
        'UPDATE missions SET reward_user_xp = 99 WHERE id = $1',
        'UPDATE missions SET reward_rate_version_id = NULL WHERE id = $1',
      ]) {
        await expect(db.query(sql, [mission.id])).rejects.toMatchObject({
          code: '23514',
        });
      }
    });

    it('입력 검증: 형식 오류는 400, 날짜 규칙 위반은 422', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const bad = [
        { title: '  ' },
        { scheduledDates: [] },
        { scheduledDates: Array.from({ length: 32 }, (_, i) => day(i)) },
        { scheduledDates: ['2026-02-31'] },
        { verificationMethod: 'manual' },
        { targetValue: 30 }, // 단위 없이
        { targetUnit: '분' }, // 값 없이
        { targetValue: 0, targetUnit: '분' },
        { estimatedDurationSeconds: 0 },
        { scheduledDates: [day(1), day(2)], dueAt: new Date().toISOString() },
        { dueAt: '2026-11-05 10:00' },
        { stepId: newId() }, // goalId 없이
        { categoryId: undefined }, // 목표 없이 생략
      ];
      for (const overrides of bad) {
        // 어떤 입력이 통과했는지 실패 메시지에 드러나게 함
        const res = await http
          .post('/api/v1/missions')
          .set(auth(user.token))
          .send(body(ref, overrides));
        expect(res.status, JSON.stringify(overrides)).toBe(400);
      }

      const past = await post(
        user,
        body(ref, { scheduledDates: [day(-1)] }),
        400,
      );
      expect(past.body.error).toMatchObject({
        code: 'MISSION_DATE_OUT_OF_RANGE',
        details: { date: day(-1), reason: 'past' },
      });
      const far = await post(
        user,
        body(ref, { scheduledDates: [day(367)] }),
        400,
      );
      expect(far.body.error.details.reason).toBe('too_far');
      // 오늘과 366일 뒤는 허용
      await post(user, body(ref, { scheduledDates: [today(), day(366)] }));
    });

    it('마감 시각은 예정일 00:00 이후 ~ 다음 날 00:00 이전만 허용', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const date = day(2);
      const start = kstDayStart(date).getTime();
      const end = kstDayStart(addDays(date, 1)).getTime();

      const ok = await post(
        user,
        body(ref, {
          scheduledDates: [date],
          dueAt: new Date(start + 12 * 3_600_000).toISOString(),
        }),
      );
      expect(ok.body.items[0].dueAt).toBe(
        new Date(start + 12 * 3_600_000).toISOString(),
      );
      await post(
        user,
        body(ref, {
          scheduledDates: [date],
          dueAt: new Date(end).toISOString(),
        }),
      );

      for (const at of [start, end + 1, start - 3_600_000]) {
        const res = await post(
          user,
          body(ref, {
            scheduledDates: [date],
            dueAt: new Date(at).toISOString(),
          }),
          422,
        );
        expect(res.body.error.code).toBe('INVALID_DUE_AT');
      }
    });

    it('비활성·없는 카테고리나 난이도는 422', async () => {
      const user = await createUser();
      const inactive = await createReference({
        rate: DEFAULT_RATE,
        isActive: false,
      });
      const res = await post(user, body(inactive), 422);
      expect(res.body.error.code).toBe('INACTIVE_REFERENCE');
      await post(user, body(inactive, { categoryId: newId() }), 422);
    });

    it('인증이 필요', async () => {
      await http.post('/api/v1/missions').send({}).expect(401);
      await http.get('/api/v1/missions').expect(401);
    });
  });

  describe('목표·단계 연결', () => {
    it('목표에 연결하면 카테고리·난이도를 생략할 수 있고 목표 기간 안이어야 함', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const goal = await createGoal(user, ref);

      const res = await post(user, {
        title: '목표 미션',
        verificationMethod: 'camera',
        scheduledDates: [day(1)],
        goalId: goal.id,
      });
      expect(res.body.items[0]).toMatchObject({
        goalId: goal.id,
        categoryCode: ref.categoryCode,
        difficultyCode: ref.difficultyCode,
      });

      const outside = await post(
        user,
        body(ref, { goalId: goal.id, scheduledDates: [day(31)] }),
        400,
      );
      expect(outside.body.error.details.reason).toBe('outside_goal_period');
    });

    it('일시정지·완료된 목표와 남의 목표, 다른 목표의 단계는 거절', async () => {
      const user = await createUser();
      const other = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const goal = await createGoal(user, ref);
      const otherGoal = await createGoal(user, ref);
      const foreignStep = await createStep(user, otherGoal.id, day(5));

      const stepWrongGoal = await post(
        user,
        body(ref, { goalId: goal.id, stepId: foreignStep.id }),
        404,
      );
      expect(stepWrongGoal.body.error.code).toBe('STEP_NOT_FOUND');
      await post(other, body(ref, { goalId: goal.id }), 404);

      await http
        .post(`/api/v1/goals/${goal.id}/pause`)
        .set(auth(user.token))
        .expect(200);
      expect(
        (await post(user, body(ref, { goalId: goal.id }), 409)).body.error.code,
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
        (await post(user, body(ref, { goalId: goal.id }), 409)).body.error.code,
      ).toBe('GOAL_ALREADY_COMPLETED');
    });

    it('종료된 단계에 필수 미션을 추가하면 단계가 다시 열림', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const goal = await createGoal(user, ref);
      const step = await createStep(user, goal.id, day(-10));
      await insertMission(user.id, ref, {
        goalId: goal.id,
        stepId: step.id,
        status: 'completed',
        date: day(-12),
      });
      expect(await tx((t) => goalsService.reevaluateStep(t, step.id))).toBe(
        'completed',
      );

      await post(user, body(ref, { goalId: goal.id, stepId: step.id }));
      const { rows } = await db.query(
        'SELECT status FROM goal_steps WHERE id = $1',
        [step.id],
      );
      expect(rows[0].status).toBe('active');
    });
  });

  describe('템플릿(원형) 생성', () => {
    it('관리자 템플릿은 원형의 기본 보상을 복사하고 보상표 버전은 없음', async () => {
      const user = await createUser();
      const ref = await createReference({
        rate: { points: 1, userXp: 1, petXp: 1 },
      });
      const definitionId = await createDefinition(ref, {
        origin: 'admin',
        status: 'public',
        basePoints: 300,
        baseUserXp: 30,
        basePetXp: 20,
      });
      const res = await post(user, {
        definitionId,
        scheduledDates: [day(1), day(2)],
      });
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0]).toMatchObject({
        sourceType: 'template',
        definitionId,
        title: '원형 미션',
        description: '원형 설명',
        targetValue: 30,
        targetUnit: '분',
        estimatedDurationSeconds: 1800,
        verificationMethod: 'sensor',
        reward: { points: 300, userXp: 30, petXp: 20 },
      });
      expect(
        (await row(res.body.items[0].id)).reward_rate_version_id,
      ).toBeNull();
    });

    it('사용자 원형은 작성자만(공개 전), 공개된 뒤에는 누구나 쓰되 보상은 보상표 기준', async () => {
      const owner = await createUser();
      const other = await createUser();
      const ref = await createReference({
        rate: { points: 40, userXp: 4, petXp: 2 },
      });
      const definitionId = await createDefinition(ref, {
        ownerId: owner.id,
        status: 'private',
        basePoints: 9999, // 사용자 원형의 기본 보상은 쓰이지 않음
      });

      const mine = await post(owner, {
        definitionId,
        scheduledDates: [day(1)],
      });
      expect(mine.body.items[0].reward).toEqual({
        points: 40,
        userXp: 4,
        petXp: 2,
      });
      expect(mine.body.items[0].sourceType).toBe('template');
      expect((await row(mine.body.items[0].id)).reward_rate_version_id).toBe(
        ref.rates[0],
      );

      const stranger = await post(
        other,
        { definitionId, scheduledDates: [day(1)] },
        404,
      );
      expect(stranger.body.error.code).toBe('DEFINITION_NOT_FOUND');

      await db.query(
        `UPDATE mission_definitions SET publication_status = 'public' WHERE id = $1`,
        [definitionId],
      );
      const shared = await post(other, {
        definitionId,
        scheduledDates: [day(1)],
      });
      expect(shared.body.items[0].reward.points).toBe(40);
    });

    it('숨김·삭제된 원형과 없는 원형은 사용할 수 없음', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const hidden = await createDefinition(ref, {
        ownerId: user.id,
        status: 'hidden',
      });
      const deleted = await createDefinition(ref, {
        ownerId: user.id,
        deleted: true,
      });
      for (const definitionId of [hidden, deleted, newId()]) {
        await post(user, { definitionId, scheduledDates: [day(1)] }, 404);
      }
    });

    it('원형의 카테고리가 비활성이면 거절', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const definitionId = await createDefinition(ref, { ownerId: user.id });
      await db.query(
        `UPDATE goal_categories SET is_active = false WHERE id = $1`,
        [ref.category],
      );
      const res = await post(
        user,
        { definitionId, scheduledDates: [day(1)] },
        422,
      );
      expect(res.body.error.code).toBe('INACTIVE_REFERENCE');
    });
  });

  describe('하루 상한', () => {
    it('하루 20개까지, 취소·삭제한 미션은 세지 않고 날짜 전체가 실패하면 하나도 만들지 않음', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const busy = day(5);
      for (let i = 0; i < 18; i++)
        await insertMission(user.id, ref, { date: busy });
      await insertMission(user.id, ref, { date: busy, status: 'cancelled' });

      await post(user, body(ref, { scheduledDates: [busy] })); // 19번째
      await post(user, body(ref, { scheduledDates: [busy] })); // 20번째
      const over = await post(
        user,
        body(ref, { scheduledDates: [day(6), busy] }),
        409,
      );
      expect(over.body.error).toMatchObject({
        code: 'DAILY_LIMIT_REACHED',
        details: { date: busy },
      });
      const { rows } = await db.query(
        'SELECT 1 FROM missions WHERE user_id = $1 AND scheduled_date = $2',
        [user.id, day(6)],
      );
      expect(rows).toHaveLength(0);
    });

    it('동시 요청에서도 상한을 넘지 않음', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const date = day(7);
      for (let i = 0; i < 17; i++) await insertMission(user.id, ref, { date });
      const results = await Promise.all(
        [1, 2, 3, 4, 5].map(() =>
          http
            .post('/api/v1/missions')
            .set(auth(user.token))
            .send(body(ref, { scheduledDates: [date] })),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(3);
      expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    });
  });

  describe('조회', () => {
    it('날짜·범위·목표·단계·상태로 거르고 취소 미션은 기본에서 숨김', async () => {
      const user = await createUser();
      const other = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const goal = await createGoal(user, ref);
      const step = await createStep(user, goal.id, day(5));

      const a = (
        await post(
          user,
          body(ref, {
            scheduledDates: [day(1)],
            goalId: goal.id,
            stepId: step.id,
          }),
        )
      ).body.items[0];
      const b = (await post(user, body(ref, { scheduledDates: [day(2)] }))).body
        .items[0];
      const c = (
        await post(
          user,
          body(ref, { scheduledDates: [day(3)], title: '취소할 것' }),
        )
      ).body.items[0];
      await post(other, body(ref, { scheduledDates: [day(1)] }));
      await http
        .post(`/api/v1/missions/${c.id}/cancel`)
        .set(auth(user.token))
        .expect(200);

      const ids = async (query) =>
        (
          await http
            .get('/api/v1/missions')
            .query(query)
            .set(auth(user.token))
            .expect(200)
        ).body.items.map((m) => m.id);
      expect(await ids({})).toEqual([a.id, b.id]);
      expect(await ids({ date: day(1) })).toEqual([a.id]);
      expect(await ids({ from: day(1), to: day(3) })).toEqual([a.id, b.id]);
      expect(await ids({ goalId: goal.id })).toEqual([a.id]);
      expect(await ids({ stepId: step.id })).toEqual([a.id]);
      expect(await ids({ status: 'cancelled' })).toEqual([c.id]);
      expect(await ids({ status: 'scheduled' })).toEqual([a.id, b.id]);
    });

    it('예정일·생성순 오름차순 커서 페이지네이션, 같은 날짜 미션도 누락·중복 없음', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const created = [];
      for (const date of [day(2), day(1), day(1), day(3), day(2)]) {
        created.push(
          ...(await post(user, body(ref, { scheduledDates: [date] }))).body
            .items,
        );
      }
      const expected = [...created]
        .sort((x, y) =>
          x.scheduledDate === y.scheduledDate
            ? 0
            : x.scheduledDate < y.scheduledDate
              ? -1
              : 1,
        )
        .map((m) => m.scheduledDate);

      const seen = [];
      let cursor;
      for (let page = 0; page < 6; page++) {
        const res = await http
          .get('/api/v1/missions')
          .query({ limit: 2, ...(cursor ? { cursor } : {}) })
          .set(auth(user.token))
          .expect(200);
        seen.push(...res.body.items);
        cursor = res.body.nextCursor;
        if (!cursor) break;
      }
      expect(seen).toHaveLength(5);
      expect(new Set(seen.map((m) => m.id)).size).toBe(5);
      expect(seen.map((m) => m.scheduledDate)).toEqual(expected);
    });

    it('조회 조건 검증', async () => {
      const user = await createUser();
      for (const query of [
        { from: day(1) },
        { to: day(1) },
        { from: day(1), to: day(0) },
        { from: day(0), to: day(62) }, // 63일
        { date: day(1), from: day(1), to: day(2) },
        { limit: 0 },
        { limit: 101 },
        { status: 'x' },
        { date: '2026-13-01' },
        { cursor: 'zzz' },
      ]) {
        await http
          .get('/api/v1/missions')
          .query(query)
          .set(auth(user.token))
          .expect(400);
      }
      await http
        .get('/api/v1/missions')
        .query({ from: day(0), to: day(61) })
        .set(auth(user.token))
        .expect(200);
    });

    it('상세 조회: 남의 미션·삭제된 미션·잘못된 id는 거절', async () => {
      const user = await createUser();
      const other = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const mission = (await post(user, body(ref))).body.items[0];
      const detail = await http
        .get(`/api/v1/missions/${mission.id}`)
        .set(auth(user.token))
        .expect(200);
      expect(detail.body.id).toBe(mission.id);

      const stranger = await http
        .get(`/api/v1/missions/${mission.id}`)
        .set(auth(other.token))
        .expect(404);
      expect(stranger.body.error.code).toBe('MISSION_NOT_FOUND');
      await http
        .get('/api/v1/missions/not-a-uuid')
        .set(auth(user.token))
        .expect(400);
      await http
        .delete(`/api/v1/missions/${mission.id}`)
        .set(auth(user.token))
        .expect(204);
      await http
        .get(`/api/v1/missions/${mission.id}`)
        .set(auth(user.token))
        .expect(404);
    });
  });

  describe('수정', () => {
    it('시작 전에는 필드를 수정하고, 빈 문자열은 설명·메모를 지움', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const mission = (
        await post(
          user,
          body(ref, {
            description: '처음',
            memo: '메모',
            targetValue: 10,
            targetUnit: '회',
          }),
        )
      ).body.items[0];

      const res = await http
        .patch(`/api/v1/missions/${mission.id}`)
        .set(auth(user.token))
        .send({
          title: '바뀐 제목',
          description: '',
          targetValue: 20,
          targetUnit: '분',
          estimatedDurationSeconds: 600,
          verificationMethod: 'camera',
          isRequired: false,
          memo: '',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        title: '바뀐 제목',
        description: null,
        targetValue: 20,
        targetUnit: '분',
        estimatedDurationSeconds: 600,
        verificationMethod: 'camera',
        isRequired: false,
        memo: null,
        reward: mission.reward,
      });
    });

    it('예정일을 옮기면 마감도 새 예정일 기준으로 옮기고, 규칙 위반과 상한은 거절', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const goal = await createGoal(user, ref);
      const mission = (await post(user, body(ref, { goalId: goal.id }))).body
        .items[0];

      const moved = await http
        .patch(`/api/v1/missions/${mission.id}`)
        .set(auth(user.token))
        .send({ scheduledDate: day(4) })
        .expect(200);
      expect(moved.body.scheduledDate).toBe(day(4));
      expect(moved.body.dueAt).toBe(kstDayStart(day(5)).toISOString());

      const custom = new Date(
        kstDayStart(day(4)).getTime() + 3_600_000,
      ).toISOString();
      const dueOnly = await http
        .patch(`/api/v1/missions/${mission.id}`)
        .set(auth(user.token))
        .send({ dueAt: custom })
        .expect(200);
      expect(dueOnly.body.dueAt).toBe(custom);

      for (const [payload, code] of [
        [{ scheduledDate: day(-1) }, 'MISSION_DATE_OUT_OF_RANGE'],
        [{ scheduledDate: day(31) }, 'MISSION_DATE_OUT_OF_RANGE'],
        [
          {
            dueAt: new Date(kstDayStart(day(6)).getTime() + 1000).toISOString(),
          },
          'INVALID_DUE_AT',
        ],
      ]) {
        const res = await http
          .patch(`/api/v1/missions/${mission.id}`)
          .set(auth(user.token))
          .send(payload);
        expect([400, 422]).toContain(res.status);
        expect(res.body.error.code).toBe(code);
      }

      const full = day(9);
      for (let i = 0; i < 20; i++)
        await insertMission(user.id, ref, { date: full });
      const over = await http
        .patch(`/api/v1/missions/${mission.id}`)
        .set(auth(user.token))
        .send({ scheduledDate: full })
        .expect(409);
      expect(over.body.error.code).toBe('DAILY_LIMIT_REACHED');
      // 같은 날짜로 "옮기는" 요청은 자기 자신을 세지 않아 통과
      await http
        .patch(`/api/v1/missions/${mission.id}`)
        .set(auth(user.token))
        .send({ scheduledDate: day(4), title: '같은 날짜' })
        .expect(200);
    });

    it('카테고리·난이도는 바꿀 수 없고, 빈 요청·단위 불일치·남의 미션은 거절', async () => {
      const user = await createUser();
      const other = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const mission = (await post(user, body(ref))).body.items[0];
      const patch = (token, payload) =>
        http
          .patch(`/api/v1/missions/${mission.id}`)
          .set(auth(token))
          .send(payload);

      await patch(user.token, { categoryId: ref.category }).expect(400);
      await patch(user.token, { difficultyId: ref.difficulty }).expect(400);
      await patch(user.token, {}).expect(400);
      await patch(user.token, { targetValue: 5 }).expect(400); // 단위 없이
      await patch(user.token, { title: ' ' }).expect(400);
      await patch(other.token, { title: '남의 것' }).expect(404);
    });

    it('단계 연결을 바꾸고 null로 해제, 목표가 없으면 거절', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const goal = await createGoal(user, ref);
      const otherGoal = await createGoal(user, ref);
      const step = await createStep(user, goal.id, day(5));
      const foreign = await createStep(user, otherGoal.id, day(5));
      const linked = (await post(user, body(ref, { goalId: goal.id }))).body
        .items[0];
      const standalone = (await post(user, body(ref))).body.items[0];
      const patch = (id, payload) =>
        http
          .patch(`/api/v1/missions/${id}`)
          .set(auth(user.token))
          .send(payload);

      expect(
        (await patch(linked.id, { stepId: step.id }).expect(200)).body.stepId,
      ).toBe(step.id);
      expect(
        (await patch(linked.id, { stepId: null }).expect(200)).body.stepId,
      ).toBeNull();
      await patch(linked.id, { stepId: foreign.id }).expect(404);
      await patch(standalone.id, { stepId: step.id }).expect(400);
    });

    it('시작한 미션은 메모만 수정할 수 있음', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      for (const status of [
        'in_progress',
        'submitted',
        'completed',
        'failed',
      ]) {
        const id = await insertMission(user.id, ref, { status });
        const memo = await http
          .patch(`/api/v1/missions/${id}`)
          .set(auth(user.token))
          .send({ memo: '메모만' })
          .expect(200);
        expect(memo.body.memo).toBe('메모만');

        const blocked = await http
          .patch(`/api/v1/missions/${id}`)
          .set(auth(user.token))
          .send({ title: '바꾸기', memo: '같이' })
          .expect(409);
        expect(blocked.body.error).toMatchObject({
          code: 'MISSION_LOCKED_AFTER_START',
          details: { status, fields: ['title'] },
        });
        // 거절된 요청은 메모도 반영하지 않음
        expect((await row(id)).memo).toBe('메모만');
      }
    });

    it('필수 여부를 바꾸면 단계 자동 완료 조건을 다시 평가', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const goal = await createGoal(user, ref);
      const step = await createStep(user, goal.id, day(-10));
      await insertMission(user.id, ref, {
        goalId: goal.id,
        stepId: step.id,
        status: 'completed',
        date: day(-12),
      });
      const optional = await insertMission(user.id, ref, {
        goalId: goal.id,
        stepId: step.id,
        required: false,
        date: day(1),
      });
      expect(await tx((t) => goalsService.reevaluateStep(t, step.id))).toBe(
        'completed',
      );

      await http
        .patch(`/api/v1/missions/${optional}`)
        .set(auth(user.token))
        .send({ isRequired: true })
        .expect(200);
      expect(
        (
          await db.query('SELECT status FROM goal_steps WHERE id = $1', [
            step.id,
          ])
        ).rows[0].status,
      ).toBe('active');
    });
  });

  describe('취소와 삭제', () => {
    it('시작 전 미션을 취소하면 이력으로 남고 다시 취소하거나 시작한 미션은 취소할 수 없음', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const mission = (await post(user, body(ref))).body.items[0];

      const res = await http
        .post(`/api/v1/missions/${mission.id}/cancel`)
        .set(auth(user.token))
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'cancelled',
        cancelReason: 'user_cancelled',
      });
      expect(res.body.cancelledAt).toEqual(expect.any(String));
      await http
        .post(`/api/v1/missions/${mission.id}/cancel`)
        .set(auth(user.token))
        .expect(409);

      const started = await insertMission(user.id, ref, {
        status: 'in_progress',
      });
      const blocked = await http
        .post(`/api/v1/missions/${started}/cancel`)
        .set(auth(user.token))
        .expect(409);
      expect(blocked.body.error.code).toBe('MISSION_LOCKED_AFTER_START');
      await http
        .post(`/api/v1/missions/${newId()}/cancel`)
        .set(auth(user.token))
        .expect(404);
    });

    it('취소하면 하루 상한에서 빠지고, 필수 미션 취소로 단계가 완료될 수 있음', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const goal = await createGoal(user, ref);
      const step = await createStep(user, goal.id, day(-10));
      await insertMission(user.id, ref, {
        goalId: goal.id,
        stepId: step.id,
        status: 'completed',
        date: day(-12),
      });
      const pending = (
        await post(
          user,
          body(ref, {
            goalId: goal.id,
            stepId: step.id,
            scheduledDates: [today()],
          }),
        )
      ).body.items[0];
      // 새 필수 미션이 생기면서 단계는 열린 상태
      expect(
        (
          await db.query('SELECT status FROM goal_steps WHERE id = $1', [
            step.id,
          ])
        ).rows[0].status,
      ).toBe('active');

      await http
        .post(`/api/v1/missions/${pending.id}/cancel`)
        .set(auth(user.token))
        .expect(200);
      expect(
        (
          await db.query('SELECT status FROM goal_steps WHERE id = $1', [
            step.id,
          ])
        ).rows[0].status,
      ).toBe('completed');
    });

    it('삭제: 시작 전은 취소와 함께, 끝난 미션은 상태 유지, 수행 중은 거절', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const del = (id) =>
        http.delete(`/api/v1/missions/${id}`).set(auth(user.token));

      const scheduled = (await post(user, body(ref))).body.items[0].id;
      await del(scheduled).expect(204);
      expect(await row(scheduled)).toMatchObject({
        status: 'cancelled',
        cancel_reason: 'user_deleted',
      });
      expect((await row(scheduled)).deleted_at).not.toBeNull();
      await del(scheduled).expect(404);

      for (const status of ['completed', 'failed', 'cancelled']) {
        const id = await insertMission(user.id, ref, { status });
        await del(id).expect(204);
        const saved = await row(id);
        expect(saved.status).toBe(status);
        expect(saved.deleted_at).not.toBeNull();
      }
      for (const status of ['in_progress', 'submitted']) {
        const id = await insertMission(user.id, ref, { status });
        const res = await del(id).expect(409);
        expect(res.body.error.code).toBe('MISSION_IN_PROGRESS');
        expect((await row(id)).deleted_at).toBeNull();
      }
    });

    it('삭제한 미션은 목록과 목표 진행률에서 빠짐', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const goal = await createGoal(user, ref);
      const a = (await post(user, body(ref, { goalId: goal.id }))).body
        .items[0];
      await post(
        user,
        body(ref, { goalId: goal.id, scheduledDates: [day(2)] }),
      );
      await http
        .delete(`/api/v1/missions/${a.id}`)
        .set(auth(user.token))
        .expect(204);

      const detail = await http
        .get(`/api/v1/goals/${goal.id}`)
        .set(auth(user.token))
        .expect(200);
      expect(detail.body.progress.missions.total).toBe(1);
      const list = await http
        .get('/api/v1/missions')
        .set(auth(user.token))
        .expect(200);
      expect(list.body.items).toHaveLength(1);
    });
  });

  describe('이용 제한', () => {
    it('제한 중에는 생성과 일반 수정을 막고 메모·취소·삭제·조회는 허용', async () => {
      const user = await createUser();
      const ref = await createReference({ rate: DEFAULT_RATE });
      const mission = (await post(user, body(ref))).body.items[0];
      const second = (await post(user, body(ref, { scheduledDates: [day(2)] })))
        .body.items[0];
      await db.query(
        `INSERT INTO account_actions
                (id, user_id, admin_id, action_type, reason, starts_at, ends_at)
         VALUES ($1,$2,$3,'restriction','사유', now() - interval '1 hour', now() + interval '1 hour')`,
        [newId(), user.id, adminId],
      );

      const create = await post(user, body(ref), 403);
      expect(create.body.error.code).toBe('AUTH_ACCOUNT_RESTRICTED');
      const edit = await http
        .patch(`/api/v1/missions/${mission.id}`)
        .set(auth(user.token))
        .send({ title: '수정', memo: '메모' })
        .expect(403);
      expect(edit.body.error.code).toBe('AUTH_ACCOUNT_RESTRICTED');

      await http.get('/api/v1/missions').set(auth(user.token)).expect(200);
      await http
        .patch(`/api/v1/missions/${mission.id}`)
        .set(auth(user.token))
        .send({ memo: '메모만' })
        .expect(200);
      await http
        .post(`/api/v1/missions/${mission.id}/cancel`)
        .set(auth(user.token))
        .expect(200);
      await http
        .delete(`/api/v1/missions/${second.id}`)
        .set(auth(user.token))
        .expect(204);
    });
  });
});
