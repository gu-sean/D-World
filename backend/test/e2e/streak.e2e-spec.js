import { createUser as createUserWith } from '../support/users.js';
import { createTestApp } from '../support/app.js';
import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { addDays, kstDate } from '../../src/common/time/kst.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { JobsService } from '../../src/jobs/jobs.service.js';
import { DecisionService } from '../../src/verification/decision.service.js';
import { StreakService } from '../../src/streak/streak.service.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);
const SECRET = 'test-ai-ingest-secret-0123456789-abcdef';

describe.skipIf(!databaseUrl)('스트릭 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let streak;
  let decisions;
  let adminId;
  let categoryId;
  let difficultyId;
  let rateId;

  const tx = (fn) => db.withTransaction(fn);
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const today = () => kstDate();
  const bypass = (sql, params) =>
    tx(async (t) => {
      await t.query('SET LOCAL session_replication_role = replica');
      await t.query(sql, params);
    });

  const createUser = () => createUserWith(app, db);

  /** 오늘 예정 미션을 만든다(보상 100P). 날짜 이동은 backdate로 */
  async function createMission(user) {
    const id = newId();
    await db.query(
      `INSERT INTO missions
              (id, user_id, source_type, title, category_id, difficulty_id, verification_method,
               scheduled_date, reward_points, reward_rate_version_id, reward_user_xp, reward_pet_xp)
       VALUES ($1,$2,'user','스트릭 미션',$3,$4,'sensor',$5,100,$6,0,0)`,
      [id, user.id, categoryId, difficultyId, today(), rateId],
    );
    return id;
  }

  /** 미션과 그 회차·판정의 시각을 모두 N일 앞으로 당겨 "과거에 일어난 일"로 만든다 */
  async function backdate(missionId, days) {
    if (days === 0) return;
    await bypass(
      `UPDATE missions SET scheduled_date = scheduled_date - $2::int,
              due_at = due_at - make_interval(days => $2),
              created_at = created_at - make_interval(days => $2),
              updated_at = updated_at - make_interval(days => $2)
        WHERE id = $1`,
      [missionId, days],
    );
    await bypass(
      `UPDATE mission_records SET started_at = started_at - make_interval(days => $2),
              submitted_at = submitted_at - make_interval(days => $2),
              completed_at = completed_at - make_interval(days => $2)
        WHERE mission_id = $1`,
      [missionId, days],
    );
    await bypass(
      `UPDATE verification_results SET decided_at = decided_at - make_interval(days => $2),
              notified_at = notified_at - make_interval(days => $2)
        WHERE record_id IN (SELECT id FROM mission_records WHERE mission_id = $1)`,
      [missionId, days],
    );
  }

  const ingest = (recordId, decision) =>
    http
      .post('/internal/v1/ai-callbacks/verification-results')
      .set('x-internal-token', SECRET)
      .send({
        ingestKey: newId(),
        recordId,
        decision,
        engineVersion: 'model-v1',
        confidence: 0.9,
        metrics: { score: 0.5 },
        reason: decision === 'rejected' ? '기준 미달' : '충족',
        rawResult: { raw: true },
      })
      .expect(200);

  /** offset일 전에 수행·제출하고 AI 결과를 받은 미션 */
  async function resolvedDay(user, offset, decision) {
    const missionId = await createMission(user);
    const record = (
      await http
        .post(`/api/v1/missions/${missionId}/records`)
        .set(auth(user.token))
        .expect(201)
    ).body;
    await http
      .post(`/api/v1/records/${record.id}/submit`)
      .set(auth(user.token))
      .send({ metrics: { steps: 8000 } })
      .expect(200);
    await ingest(record.id, decision);
    await backdate(missionId, offset);
    return { missionId, recordId: record.id };
  }

  /** 제출 없이 지나간 예정 미션(또는 취소된 미션) */
  async function bareMission(user, offset, { cancelled = false } = {}) {
    const id = newId();
    await bypass(
      `INSERT INTO missions
              (id, user_id, source_type, title, category_id, difficulty_id, verification_method,
               scheduled_date, status, cancelled_at, cancel_reason)
       VALUES ($1,$2,'user','지난 미션',$3,$4,'sensor',$5,$6,$7,$8)`,
      [
        id,
        user.id,
        categoryId,
        difficultyId,
        addDays(today(), -offset),
        cancelled ? 'cancelled' : 'scheduled',
        cancelled ? new Date() : null,
        cancelled ? 'user_deleted' : null,
      ],
    );
    return id;
  }

  const recalc = (user) => tx((t) => streak.recalculate(t, user.id));
  const days = async (userId) =>
    Object.fromEntries(
      (
        await db.query(
          'SELECT streak_date::text AS d, status FROM streak_days WHERE user_id = $1',
          [userId],
        )
      ).rows.map((r) => [r.d, r.status]),
    );
  const dayKey = (offset) => addDays(today(), -offset);
  const awardOf = async (userId, target = 7) =>
    (
      await db.query(
        `SELECT id, status, awarded_points, paid_points, first_achieved_date::text AS d
           FROM streak_milestone_awards WHERE user_id = $1 AND target_success_days = $2`,
        [userId, target],
      )
    ).rows[0];
  const streakPoints = async (userId) =>
    Number(
      (
        await db.query(
          `SELECT COALESCE(sum(available_delta), 0) AS n FROM point_transactions
            WHERE user_id = $1 AND source_type = 'streak'`,
          [userId],
        )
      ).rows[0].n,
    );
  const redecide = (recordId, decision) =>
    tx((t) =>
      decisions.applyDecision(t, {
        recordId,
        source: 'admin',
        decision,
        reason: '재판정',
        adminId,
      }),
    );

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    streak = app.get(StreakService);
    decisions = app.get(DecisionService);

    adminId = newId();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `st_${RUN}`, `${adminId.toLowerCase()}@example.com`],
    );
    categoryId = newId();
    difficultyId = newId();
    rateId = newId();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [categoryId, `stc${RUN}`, `스트릭카테고리${RUN}`],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [difficultyId, `std${RUN}`, `스트릭난이도${RUN}`],
    );
    await db.query(
      `INSERT INTO mission_reward_rate_versions
              (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,$3,1,100,0,0, now() - interval '1 day', $4)`,
      [rateId, categoryId, difficultyId, adminId],
    );
    await db.query(
      `INSERT INTO verification_criteria_versions
              (id, category_id, verification_method, version_no, rules_json, effective_at,
               created_by_admin_id)
       VALUES ($1,$2,'sensor',1,'{}'::jsonb, now() - interval '30 days', $3)`,
      [newId(), categoryId, adminId],
    );
    // 사용자 레벨 정책이 없으면 최소 정책을 만듦(미션 승인이 XP를 지급함, 전역 단일 정책 테이블이라 먼 과거 시각)
    const { rowCount } = await db.query(
      'SELECT 1 FROM user_level_policy_versions LIMIT 1',
    );
    if (rowCount === 0) {
      const policyId = newId();
      await db.query(
        `INSERT INTO user_level_policy_versions (id, version_no, effective_at, created_by_admin_id)
         VALUES ($1, $3, '2000-01-01', $2)`,
        [policyId, adminId, randomInt(1, 1_000_000_000)],
      );
      await db.query(
        `INSERT INTO user_level_thresholds (policy_version_id, level_no, min_total_xp)
         VALUES ($1, 1, 0)`,
        [policyId],
      );
    }
    // 7일 마일스톤 금액 70P (정책 버전은 수정 불가라 고유 번호로 추가)
    await db.query(
      `INSERT INTO streak_milestone_policy_versions
              (id, target_success_days, version_no, points, effective_at, created_by_admin_id)
       VALUES ($1, 7, $2, 70, now() - interval '1 minute', $3)`,
      [newId(), randomInt(1_000_000, 1_000_000_000), adminId],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('연속 일수와 마일스톤', () => {
    let user;
    const records = {};

    it('7일 연속 성공하면 7일 마일스톤을 한 번 지급하고 요약·일별 조회에 반영', async () => {
      user = await createUser();
      for (const offset of [6, 5, 4, 3, 2, 1, 0]) {
        records[offset] = await resolvedDay(user, offset, 'approved');
      }
      expect(Object.values(await days(user.id))).toEqual(
        Array(7).fill('success'),
      );

      const award = await awardOf(user.id);
      expect(award).toMatchObject({
        status: 'active',
        awarded_points: 70,
        paid_points: 70,
        d: dayKey(0),
      });
      expect(await streakPoints(user.id)).toBe(70);

      const summary = await http
        .get('/api/v1/me/streak')
        .set(auth(user.token))
        .expect(200);
      expect(summary.body).toMatchObject({
        currentSuccessDays: 7,
        longestSuccessDays: 7,
        lastSuccessDate: dayKey(0),
        hasPendingDays: false,
      });
      expect(summary.body.milestones[0]).toEqual({
        targetDays: 7,
        status: 'active',
        rewardPoints: 70,
        paidPoints: 70,
        firstAchievedDate: dayKey(0),
      });
      expect(summary.body.milestones[1]).toMatchObject({
        targetDays: 30,
        status: 'locked',
      });

      const list = await http
        .get('/api/v1/me/streak/days')
        .query({ from: dayKey(6), to: dayKey(0) })
        .set(auth(user.token))
        .expect(200);
      expect(list.body.items.map((i) => i.status)).toEqual(
        Array(7).fill('success'),
      );
      expect(list.body.items[0].date).toBe(dayKey(6));
    });

    it('같은 계산을 다시 해도 중복 지급이 없음', async () => {
      await recalc(user);
      await recalc(user);
      expect(await streakPoints(user.id)).toBe(70);
      const { rows } = await db.query(
        'SELECT 1 FROM streak_milestone_awards WHERE user_id = $1',
        [user.id],
      );
      expect(rows).toHaveLength(1);
    });

    it('중간 날의 승인이 번복되면 연속이 끊기고 마일스톤을 회수, 다시 승인하면 복구(중복 지급 없음)', async () => {
      await redecide(records[3].recordId, 'rejected');
      expect((await days(user.id))[dayKey(3)]).toBe('failed');
      expect((await awardOf(user.id)).status).toBe('revoked');
      expect(await streakPoints(user.id)).toBe(0);
      const broken = await http
        .get('/api/v1/me/streak')
        .set(auth(user.token))
        .expect(200);
      expect(broken.body).toMatchObject({
        currentSuccessDays: 3,
        longestSuccessDays: 3,
      });
      expect(broken.body.milestones[0]).toMatchObject({ status: 'revoked' });

      await redecide(records[3].recordId, 'approved');
      expect((await days(user.id))[dayKey(3)]).toBe('success');
      expect((await awardOf(user.id)).status).toBe('active');
      expect(await streakPoints(user.id)).toBe(70);

      // 한 번 더 번복·복구해도 안전
      await redecide(records[3].recordId, 'rejected');
      await redecide(records[3].recordId, 'approved');
      expect(await streakPoints(user.id)).toBe(70);
      const { rows } = await db.query(
        'SELECT 1 FROM streak_milestone_awards WHERE user_id = $1',
        [user.id],
      );
      expect(rows).toHaveLength(1);
    });
  });

  describe('하루 판정', () => {
    it('예정 미션이 없는 날(rest)은 연속을 끊지도 더하지도 않고 취소된 미션만 있는 날도 rest', async () => {
      const user = await createUser();
      await resolvedDay(user, 3, 'approved');
      await bareMission(user, 2, { cancelled: true }); // 취소 → rest
      // 1일 전은 예정 미션 없음
      await resolvedDay(user, 0, 'approved');
      const rows = await days(user.id);
      expect(rows).toEqual({ [dayKey(3)]: 'success', [dayKey(0)]: 'success' });
      const summary = await http
        .get('/api/v1/me/streak')
        .set(auth(user.token))
        .expect(200);
      expect(summary.body.currentSuccessDays).toBe(2);
    });

    it('끝난 날에 승인된 미션이 없으면 failed로 확정되어 연속을 끊고, 하루에 여러 개를 완료해도 1일', async () => {
      const user = await createUser();
      await resolvedDay(user, 2, 'approved');
      await resolvedDay(user, 2, 'approved'); // 같은 날 두 번째
      await bareMission(user, 1); // 어제 예정, 제출 없음
      await resolvedDay(user, 0, 'approved');
      expect(await days(user.id)).toEqual({
        [dayKey(2)]: 'success',
        [dayKey(1)]: 'failed',
        [dayKey(0)]: 'success',
      });
      const summary = await http
        .get('/api/v1/me/streak')
        .set(auth(user.token))
        .expect(200);
      expect(summary.body).toMatchObject({
        currentSuccessDays: 1,
        longestSuccessDays: 1,
      });
    });

    it('AI가 거절한 날도 failed, 오늘 거절된 날은 아직 확정하지 않음', async () => {
      const user = await createUser();
      await resolvedDay(user, 1, 'rejected');
      await resolvedDay(user, 0, 'rejected');
      await recalc(user);
      expect(await days(user.id)).toEqual({ [dayKey(1)]: 'failed' });
    });

    it('자정 전에 제출한 인증이 판정 대기 중이면 pending, 승인되면 소급해 success', async () => {
      const user = await createUser();
      const held = await resolvedDay(user, 1, 'review_required');
      await recalc(user);
      expect(await days(user.id)).toEqual({ [dayKey(1)]: 'pending' });
      const pending = await http
        .get('/api/v1/me/streak')
        .set(auth(user.token))
        .expect(200);
      expect(pending.body.hasPendingDays).toBe(true);

      await redecide(held.recordId, 'approved');
      expect(await days(user.id)).toEqual({ [dayKey(1)]: 'success' });
      const settled = await http
        .get('/api/v1/me/streak')
        .set(auth(user.token))
        .expect(200);
      expect(settled.body).toMatchObject({
        hasPendingDays: false,
        currentSuccessDays: 1,
        lastSuccessDate: dayKey(1),
      });
    });

    it('대기 중이던 날이 거절되면 failed', async () => {
      const user = await createUser();
      const held = await resolvedDay(user, 1, 'review_required');
      await recalc(user);
      await redecide(held.recordId, 'rejected');
      expect(await days(user.id)).toEqual({ [dayKey(1)]: 'failed' });
    });

    it('다음 날 승인되어도 귀속일은 예정일, 오늘 제출분이 예정일 다음 날 제출이면 인정하지 않음', async () => {
      const user = await createUser();
      const missionId = await createMission(user);
      const record = (
        await http
          .post(`/api/v1/missions/${missionId}/records`)
          .set(auth(user.token))
          .expect(201)
      ).body;
      await http
        .post(`/api/v1/records/${record.id}/submit`)
        .set(auth(user.token))
        .send({ metrics: { steps: 1 } })
        .expect(200);
      await ingest(record.id, 'approved');
      // 예정일을 이틀 전으로, 제출·판정은 오늘 그대로 → 제출일이 예정일이 아니므로 성공 근거가 아님
      await bypass(
        `UPDATE missions SET scheduled_date = scheduled_date - 2,
                created_at = created_at - interval '2 days' WHERE id = $1`,
        [missionId],
      );
      await recalc(user);
      expect((await days(user.id))[dayKey(2)]).toBe('failed');
    });
  });

  describe('작업과 조회', () => {
    it('끝났는데 확정되지 않은 날을 작업이 확정하고 요약 행을 만듦', async () => {
      const user = await createUser();
      await bareMission(user, 1);
      expect(await days(user.id)).toEqual({});

      const result = await streak.settleDays({ limit: 100_000 });
      expect(result.settled).toBeGreaterThanOrEqual(1);
      expect(await days(user.id)).toEqual({ [dayKey(1)]: 'failed' });
      const { rows } = await db.query(
        'SELECT current_success_days FROM streak_states WHERE user_id = $1',
        [user.id],
      );
      expect(rows[0].current_success_days).toBe(0);

      const again = await app.get(JobsService).runJob('streak-settle');
      expect(again).toHaveProperty('settled');
    });

    it('한 사용자 확정이 실패해도 나머지 사용자는 확정함', async () => {
      const broken = await createUser();
      const healthy = await createUser();
      await bareMission(broken, 1);
      await bareMission(healthy, 1);

      const original = streak.recalculate.bind(streak);
      streak.recalculate = async (tx, userId) => {
        if (userId === broken.id) throw new Error('확정 중 오류');
        return original(tx, userId);
      };
      let result;
      try {
        result = await streak.settleDays({ limit: 100_000 });
      } finally {
        streak.recalculate = original;
      }
      expect(result.failed).toBeGreaterThanOrEqual(1);
      expect(await days(healthy.id)).toEqual({ [dayKey(1)]: 'failed' });
      expect(await days(broken.id)).toEqual({});
    });

    it('기록이 없는 사용자는 0, 조회 범위와 인증 검사', async () => {
      const user = await createUser();
      const summary = await http
        .get('/api/v1/me/streak')
        .set(auth(user.token))
        .expect(200);
      expect(summary.body).toMatchObject({
        currentSuccessDays: 0,
        longestSuccessDays: 0,
        lastSuccessDate: null,
        hasPendingDays: false,
      });
      expect(summary.body.milestones.map((m) => m.status)).toEqual([
        'locked',
        'locked',
        'locked',
      ]);

      const empty = await http
        .get('/api/v1/me/streak/days')
        .set(auth(user.token))
        .expect(200);
      expect(empty.body.items).toEqual([]);
      await http
        .get('/api/v1/me/streak/days')
        .query({ from: '2026-02-02', to: '2026-02-01' })
        .set(auth(user.token))
        .expect(400);
      await http
        .get('/api/v1/me/streak/days')
        .query({ from: '2025-01-01', to: '2026-01-01' })
        .set(auth(user.token))
        .expect(400);
      await http
        .get('/api/v1/me/streak/days')
        .query({ from: 'x' })
        .set(auth(user.token))
        .expect(400);
      await http.get('/api/v1/me/streak').expect(401);
    });
  });

  describe('마일스톤 XP', () => {
    const userXpOf = async (userId) =>
      (
        await db.query(
          'SELECT total_xp::int AS total FROM user_experience WHERE user_id = $1',
          [userId],
        )
      ).rows[0]?.total ?? 0;

    beforeAll(async () => {
      // 사용자 XP 40을 함께 주는 정책 버전(방금 시행, 앞선 70P 정책보다 나중)
      await db.query(
        `INSERT INTO streak_milestone_policy_versions
                (id, target_success_days, version_no, points, user_xp, pet_xp, effective_at, created_by_admin_id)
         VALUES ($1, 7, $2, 70, 40, 0, now() - interval '10 seconds', $3)`,
        [newId(), randomInt(1_000_000, 1_000_000_000), adminId],
      );
    });

    it('달성하면 포인트와 함께 사용자 XP를 지급하고, 번복하면 회수, 복구하면 다시 지급', async () => {
      const user = await createUser();
      const records = {};
      for (const offset of [6, 5, 4, 3, 2, 1, 0]) {
        records[offset] = await resolvedDay(user, offset, 'approved');
      }
      expect((await awardOf(user.id)).status).toBe('active');
      expect(await streakPoints(user.id)).toBe(70);
      expect(await userXpOf(user.id)).toBe(40);

      await redecide(records[3].recordId, 'rejected');
      expect((await awardOf(user.id)).status).toBe('revoked');
      expect(await userXpOf(user.id)).toBe(0);

      await redecide(records[3].recordId, 'approved');
      expect((await awardOf(user.id)).status).toBe('active');
      expect(await userXpOf(user.id)).toBe(40);

      // 반복해도 중복 지급 없음
      await recalc(user);
      expect(await userXpOf(user.id)).toBe(40);
    });
  });
});
