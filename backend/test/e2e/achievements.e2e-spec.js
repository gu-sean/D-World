import { configureApp } from '../../src/app.setup.js';
import { randomInt, randomBytes } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { AchievementsService } from '../../src/achievements/achievements.service.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { DatabaseService } from '../../src/database/database.service.js';

// DATABASE_URL이 있을 때만 실행, 마이그레이션 적용 필요(006·007·008·018 포함)
const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)('업적·배지 (PostgreSQL)', () => {
  let app;
  let db;
  let achievements;
  let adminId;
  let userTag = 0;
  // profiles.nickname은 테이블 전체에서 고유라 같은 DB를 쓰는 다른 e2e 파일과도 안 겹치게 파일별 접두사를 둠
  const userTagPrefix = randomInt(100, 999);

  const tx = (fn) => db.withTransaction(fn);

  async function insertBypassingTriggers(sql, params) {
    await tx(async (t) => {
      await t.query('SET LOCAL session_replication_role = replica');
      await t.query(sql, params);
    });
  }

  async function createUser() {
    const id = newId();
    userTag += 1;
    await db.query('INSERT INTO users (id) VALUES ($1)', [id]);
    await db.query('INSERT INTO profiles (user_id, nickname) VALUES ($1, $2)', [
      id,
      `유저${userTagPrefix}${userTag}`,
    ]);
    return id;
  }

  async function createCategory() {
    const tag = randomBytes(6).toString('hex'); // 공유 DB에 쌓여도 충돌하지 않게 넓은 범위
    const id = newId();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [id, `c${tag}`, `카테고리${tag}`],
    );
    return id;
  }

  async function createDifficulty() {
    const tag = randomBytes(6).toString('hex'); // 공유 DB에 쌓여도 충돌하지 않게 넓은 범위
    const id = newId();
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [id, `d${tag}`, `난이도${tag}`],
    );
    return id;
  }

  async function createCriteria(categoryId) {
    const id = newId();
    await db.query(
      `INSERT INTO verification_criteria_versions
              (id, category_id, verification_method, version_no, rules_json, effective_at, created_by_admin_id)
       VALUES ($1,$2,'sensor',1,'{}'::jsonb, now() - interval '1 day', $3)`,
      [id, categoryId, adminId],
    );
    return id;
  }

  /** 승인된 판정까지 끝낸 완료 미션 하나, 반환은 mission id */
  async function createApprovedMission(userId, categoryId, criteriaId) {
    const difficultyId = await createDifficulty();
    const ids = {
      mission: newId(),
      record: newId(),
      result: newId(),
    };
    await db.query(
      `INSERT INTO missions
              (id, user_id, source_type, title, category_id, difficulty_id,
               verification_method, scheduled_date)
       VALUES ($1,$2,'user','걷기',$3,$4,'sensor',CURRENT_DATE)`,
      [ids.mission, userId, categoryId, difficultyId],
    );
    await db.query(
      `INSERT INTO mission_records
              (id, mission_id, user_id, attempt_no, submission_no, status, evidence_kind, submitted_at)
       VALUES ($1,$2,$3,1,1,'submitted','sensor_summary', now())`,
      [ids.record, ids.mission, userId],
    );
    await db.query(
      `INSERT INTO verification_results
              (id, record_id, result_no, source, decision, criteria_version_id, engine_version)
       VALUES ($1,$2,1,'ai','approved',$3,'model-v1')`,
      [ids.result, ids.record, criteriaId],
    );
    await db.query(`UPDATE missions SET status = 'completed' WHERE id = $1`, [
      ids.mission,
    ]);
    return ids.mission;
  }

  async function createGoal(userId, { completed = true } = {}) {
    const categoryId = await createCategory();
    const difficultyId = await createDifficulty();
    const id = newId();
    await db.query(
      `INSERT INTO goals
              (id, user_id, category_id, difficulty_id, title, start_date, end_date,
               status, completed_at)
       VALUES ($1,$2,$3,$4,'목표','2026-01-01','2026-01-31',$5,
               CASE WHEN $6::boolean THEN now() END)`,
      [
        id,
        userId,
        categoryId,
        difficultyId,
        completed ? 'completed' : 'active',
        completed,
      ],
    );
    return id;
  }

  async function createAchievement({
    conditionType,
    targetCount,
    categoryId = null,
    rewardPoints = 0,
    rewardUserXp = 0,
    rewardPetXp = 0,
  }) {
    const tag = randomBytes(6).toString('hex'); // 공유 DB에 쌓여도 충돌하지 않게 넓은 범위
    const ids = {
      def: newId(),
      image: newId(),
      version: newId(),
    };
    await db.query(
      `INSERT INTO achievement_definitions (id, code, status, created_by_admin_id)
       VALUES ($1, $2, 'public', $3)`,
      [ids.def, `ach_${tag}`, adminId],
    );
    await db.query(
      `INSERT INTO achievement_badge_images
              (id, achievement_id, version_no, r2_object_key, mime_type, size_bytes,
               uploaded_at, created_by_admin_id)
       VALUES ($1,$2,1,$3,'image/png',10,now(),$4)`,
      [ids.image, ids.def, `badge/${tag}`, adminId],
    );
    await db.query(
      `INSERT INTO achievement_versions
              (id, achievement_id, version_no, title, description, rarity,
               condition_type, target_count, category_id, reward_points,
               reward_user_xp, reward_pet_xp, badge_image_id, effective_at, created_by_admin_id)
       VALUES ($1,$2,1,'업적','설명','common',$3,$4,$5,$6,$7,$8,$9, now() - interval '1 day', $10)`,
      [
        ids.version,
        ids.def,
        conditionType,
        targetCount,
        categoryId,
        rewardPoints,
        rewardUserXp,
        rewardPetXp,
        ids.image,
        adminId,
      ],
    );
    return ids.def;
  }

  async function createStreakMilestone(userId, days) {
    const policyId = newId();
    const awardId = newId();
    await db.query(
      `INSERT INTO streak_milestone_policy_versions
              (id, target_success_days, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,$4,0,0,0, now() - interval '1 day', $3)`,
      [policyId, days, adminId, randomInt(1, 1_000_000_000)],
    );
    await insertBypassingTriggers(
      `INSERT INTO streak_milestone_awards
              (id, user_id, target_success_days, policy_version_id,
               awarded_points, paid_points, first_achieved_date, status)
       VALUES ($1,$2,$3,$4,0,0,CURRENT_DATE,'active')`,
      [awardId, userId, days, policyId],
    );
    return awardId;
  }

  const evaluate = (userId, trigger) =>
    tx((t) => achievements.evaluate(t, { userId, trigger }));

  const getWallet = async (userId) => {
    const { rows } = await db.query(
      `SELECT available_points::int AS available FROM point_wallets WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ?? { available: 0 };
  };
  const getUserXp = async (userId) => {
    const { rows } = await db.query(
      `SELECT total_xp::int AS total FROM user_experience WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ?? { total: 0 };
  };

  async function login(userId) {
    const sessions = app.get(SessionsService);
    const tokens = app.get(AccessTokenService);
    const session = await tx((t) => sessions.create(t, 'user', userId));
    return tokens.issue('user', userId, session.sessionId);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({
          totalHits: 1,
          timeToExpire: 0,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DatabaseService);
    achievements = app.get(AchievementsService);

    adminId = newId();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash)
       VALUES ($1, $2, $3, 'x')`,
      [
        adminId,
        `pa_${randomInt(100_000, 999_999)}`,
        `${adminId.toLowerCase()}@example.com`,
      ],
    );

    // 사용자 레벨 정책: XP 지급 테스트를 위한 최소 정책(1=0, level_no는 검증하지 않음)
    // version_no는 전역 고유라 무작위로 두고, effective_at은 먼 과거로 둬서 experience.e2e-spec.js가
    // 만드는 정책(최근 시각)이 "현재 정책" 선정에서 항상 이기게 함(둘 다 전역 단일 정책 테이블을 공유)
    const userPolicyId = newId();
    await db.query(
      `INSERT INTO user_level_policy_versions (id, version_no, effective_at, created_by_admin_id)
       VALUES ($1, $3, '2000-01-01', $2)`,
      [userPolicyId, adminId, randomInt(1, 1_000_000_000)],
    );
    await db.query(
      `INSERT INTO user_level_thresholds (policy_version_id, level_no, min_total_xp)
       VALUES ($1, 1, 0)`,
      [userPolicyId],
    );
  });

  afterAll(async () => {
    // 이 스위트가 만든 공개 업적이 남으면 이후 스위트의 보상·평가에 섞이므로 숨김 처리
    await db.query(
      `UPDATE achievement_definitions SET status = 'hidden' WHERE created_by_admin_id = $1`,
      [adminId],
    );
    await app.close();
  });

  describe('첫 목표 완료', () => {
    it('지급 → 번복 회수 → 재충족 복구', async () => {
      const user = await createUser();
      const achievementId = await createAchievement({
        conditionType: 'first_goal_completed',
        targetCount: 1,
        rewardPoints: 50,
        rewardUserXp: 10,
      });
      const goalId = await createGoal(user);

      const first = await evaluate(user, 'goal_completed');
      expect(first).toEqual([
        {
          achievementId,
          outcome: 'earned',
          userAchievementId: expect.any(String),
        },
      ]);
      expect((await getWallet(user)).available).toBe(50);
      expect((await getUserXp(user)).total).toBe(10);

      // 다시 평가해도 중복 지급 없음
      expect(await evaluate(user, 'goal_completed')).toEqual([]);

      // 목표가 되돌려지면 회수
      await db.query(
        `UPDATE goals SET status = 'active', completed_at = NULL WHERE id = $1`,
        [goalId],
      );
      expect(await evaluate(user, 'revoked')).toEqual([
        { achievementId, outcome: 'revoked' },
      ]);
      expect((await getWallet(user)).available).toBe(0);
      expect((await getUserXp(user)).total).toBe(0);

      // 다시 완료하면 원 금액 그대로 복구
      await db.query(
        `UPDATE goals SET status = 'completed', completed_at = now() WHERE id = $1`,
        [goalId],
      );
      expect(await evaluate(user, 'goal_completed')).toEqual([
        { achievementId, outcome: 'reinstated' },
      ]);
      expect((await getWallet(user)).available).toBe(50);
      expect((await getUserXp(user)).total).toBe(10);
    });
  });

  describe('승인 미션 누적', () => {
    it('목표 도달 전엔 미평가, 도달하면 지급', async () => {
      const user = await createUser();
      const achievementId = await createAchievement({
        conditionType: 'approved_mission_count',
        targetCount: 2,
        rewardPoints: 30,
      });
      const categoryId = await createCategory();
      const criteriaId = await createCriteria(categoryId);

      await createApprovedMission(user, categoryId, criteriaId);
      expect(
        (await evaluate(user, 'mission_approved')).some(
          (r) => r.achievementId === achievementId,
        ),
      ).toBe(false);

      await createApprovedMission(user, categoryId, criteriaId);
      expect(await evaluate(user, 'mission_approved')).toContainEqual({
        achievementId,
        outcome: 'earned',
        userAchievementId: expect.any(String),
      });
      expect((await getWallet(user)).available).toBe(30);
    });

    it('카테고리별 업적은 다른 카테고리 미션을 세지 않음', async () => {
      const user = await createUser();
      const categoryA = await createCategory();
      const categoryB = await createCategory();
      const criteriaA = await createCriteria(categoryA);
      const criteriaB = await createCriteria(categoryB);
      const achievementId = await createAchievement({
        conditionType: 'category_approved_mission_count',
        targetCount: 1,
        categoryId: categoryA,
        rewardPoints: 20,
      });

      await createApprovedMission(user, categoryB, criteriaB);
      // 다른(전역) 승인 누적 업적은 이 파일의 다른 테스트가 공개해 둘 수 있어 포함 여부만 확인
      expect(
        (await evaluate(user, 'mission_approved')).some(
          (r) => r.achievementId === achievementId,
        ),
      ).toBe(false);

      await createApprovedMission(user, categoryA, criteriaA);
      expect(await evaluate(user, 'mission_approved')).toContainEqual({
        achievementId,
        outcome: 'earned',
        userAchievementId: expect.any(String),
      });
    });

    it('승인 미션 수가 목표 아래로 떨어지면 회수', async () => {
      const user = await createUser();
      const achievementId = await createAchievement({
        conditionType: 'approved_mission_count',
        targetCount: 1,
        rewardPoints: 10,
      });
      const categoryId = await createCategory();
      const criteriaId = await createCriteria(categoryId);
      const missionId = await createApprovedMission(
        user,
        categoryId,
        criteriaId,
      );
      await evaluate(user, 'mission_approved');
      expect((await getWallet(user)).available).toBe(10);

      await db.query(`UPDATE missions SET status = 'failed' WHERE id = $1`, [
        missionId,
      ]);
      // 다른 e2e 파일이 공개해 둔 전역 승인 누적 업적(0P)도 같은 사용자에서 함께 회수될 수 있어 포함 여부만 확인
      expect(await evaluate(user, 'revoked')).toContainEqual({
        achievementId,
        outcome: 'revoked',
      });
      expect((await getWallet(user)).available).toBe(0);
    });
  });

  describe('스트릭 마일스톤(공유형)', () => {
    it('포인트·XP는 지급하지 않고 배지만 기록, 번복 시 회수', async () => {
      const user = await createUser();
      const achievementId = await createAchievement({
        conditionType: 'streak_milestone',
        targetCount: 7,
      });
      const streakAwardId = await createStreakMilestone(user, 7);

      const res = await evaluate(user, 'streak_milestone');
      expect(res).toEqual([
        {
          achievementId,
          outcome: 'earned',
          userAchievementId: expect.any(String),
        },
      ]);
      expect((await getWallet(user)).available).toBe(0);
      const { rows } = await db.query(
        `SELECT awarded_points::int AS a, paid_points::int AS p
           FROM user_achievements WHERE achievement_id = $1`,
        [achievementId],
      );
      expect(rows[0]).toEqual({ a: 0, p: 0 });

      await db.query(
        `UPDATE streak_milestone_awards SET status = 'revoked' WHERE id = $1`,
        [streakAwardId],
      );
      expect(await evaluate(user, 'revoked')).toEqual([
        { achievementId, outcome: 'revoked' },
      ]);
    });
  });

  describe('대표 배지', () => {
    it('설정·해제, 소유하지 않은 업적은 거절', async () => {
      const user = await createUser();
      await createAchievement({
        conditionType: 'first_goal_completed',
        targetCount: 1,
        rewardPoints: 5,
      });
      await createGoal(user);
      const [{ userAchievementId }] = await evaluate(user, 'goal_completed');

      const token = await login(user);
      await request(app.getHttpServer())
        .patch('/api/v1/me/profile/representative-achievement')
        .set('Authorization', `Bearer ${token}`)
        .send({ achievementId: userAchievementId })
        .expect(200);
      const { rows } = await db.query(
        'SELECT representative_achievement_id FROM profiles WHERE user_id = $1',
        [user],
      );
      expect(rows[0].representative_achievement_id).toBe(userAchievementId);

      const other = await createUser();
      await request(app.getHttpServer())
        .patch('/api/v1/me/profile/representative-achievement')
        .set('Authorization', `Bearer ${await login(other)}`)
        .send({ achievementId: userAchievementId })
        .expect(422);

      await request(app.getHttpServer())
        .patch('/api/v1/me/profile/representative-achievement')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);
      const after = await db.query(
        'SELECT representative_achievement_id FROM profiles WHERE user_id = $1',
        [user],
      );
      expect(after.rows[0].representative_achievement_id).toBeNull();
    });
  });

  describe('조회 API', () => {
    it('GET /me/achievements, GET /me/achievements/:id', async () => {
      const user = await createUser();
      const achievementId = await createAchievement({
        conditionType: 'approved_mission_count',
        targetCount: 3,
        rewardPoints: 15,
      });
      const categoryId = await createCategory();
      const criteriaId = await createCriteria(categoryId);
      await createApprovedMission(user, categoryId, criteriaId);
      const token = await login(user);

      let res = await request(app.getHttpServer())
        .get(`/api/v1/me/achievements/${achievementId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toEqual({
        achievementId,
        status: 'none',
        current: 1,
        target: 3,
      });

      await createApprovedMission(user, categoryId, criteriaId);
      await createApprovedMission(user, categoryId, criteriaId);
      await evaluate(user, 'mission_approved');

      res = await request(app.getHttpServer())
        .get('/api/v1/me/achievements')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      // 이 사용자는 다른 테스트가 공개해 둔 전역 승인 누적 업적도 함께 달성했을 수 있어 포함 여부만 확인
      expect(res.body).toContainEqual(
        expect.objectContaining({
          achievementId,
          status: 'active',
          awardedPoints: 15,
          paidPoints: 15,
        }),
      );

      res = await request(app.getHttpServer())
        .get(`/api/v1/me/achievements/${achievementId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toEqual({
        achievementId,
        status: 'active',
        current: 3,
        target: 3,
      });

      await request(app.getHttpServer())
        .get('/api/v1/me/achievements')
        .expect(401);
    });
  });

  describe('백필', () => {
    it('공개 이전 활동도 조건에 포함해 일괄 지급, 중복 실행 안전', async () => {
      const userA = await createUser();
      const userB = await createUser();
      const achievementId = await createAchievement({
        conditionType: 'first_goal_completed',
        targetCount: 1,
        rewardPoints: 1,
      });
      await createGoal(userA);
      await createGoal(userB);

      const first = await tx((t) =>
        achievements.backfill(t, { achievementId, limit: 1000 }),
      );
      expect(first.earned).toBeGreaterThanOrEqual(2);

      const again = await tx((t) =>
        achievements.backfill(t, { achievementId, limit: 1000 }),
      );
      expect(again.earned).toBe(0);
    });
  });
});
