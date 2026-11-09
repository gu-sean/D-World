import { createTestApp } from '../support/app.js';
import { testNickname } from '../support/users.js';
import { adminApi } from '../support/admin-api.js';
import { randomInt, randomUUID } from 'node:crypto';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { addDays, kstDate } from '../../src/common/time/kst.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { StreakService } from '../../src/streak/streak.service.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)('챌린지 참가·일별 미션 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let adminId;
  let adminToken;
  let categoryId;
  let difficultyId;

  const tx = (fn) => db.withTransaction(fn);
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const today = () => kstDate();
  const adminPost = (path, body) => adminApi(http, adminToken).post(path, body);
  const bypass = (sql, params) =>
    tx(async (t) => {
      await t.query('SET LOCAL session_replication_role = replica');
      await t.query(sql, params);
    });

  async function createUser() {
    const id = randomUUID();
    await db.query('INSERT INTO users (id) VALUES ($1)', [id]);
    await db.query('INSERT INTO profiles (user_id, nickname) VALUES ($1, $2)', [
      id,
      testNickname(),
    ]);
    const session = await tx((t) =>
      app.get(SessionsService).create(t, 'user', id),
    );
    return {
      id,
      token: await app
        .get(AccessTokenService)
        .issue('user', id, session.sessionId),
    };
  }

  /** 공개된 7일 챌린지 (시작일은 기본 모레) */
  async function publicChallenge(overrides = {}) {
    const startDate = overrides.startDate ?? addDays(today(), 2);
    const created = await adminPost('/admin/v1/challenges', {
      title: `참가 테스트 ${RUN}`,
      description: '설명',
      categoryId,
      difficultyId,
      verificationMethod: 'camera',
      exerciseCode: 'squat',
      startDate,
      endDate: addDays(startDate, 6),
      reward: { points: 300, userXp: 30, petXp: 60 },
      ...overrides,
    }).expect(201);
    await adminPost(
      `/admin/v1/challenges/${created.body.id}/publish`,
      {},
    ).expect(200);
    return created.body;
  }

  /** 시작일·종료일·일별 미션을 N일 앞당긴다(이미 시작한 챌린지 상황을 만들기 위해) */
  async function shiftDays(challengeId, days) {
    await bypass(
      `UPDATE challenges SET start_date = start_date - $2::int, end_date = end_date - $2::int WHERE id = $1`,
      [challengeId, days],
    );
    await bypass(
      `UPDATE missions SET scheduled_date = scheduled_date - $2::int
        WHERE id IN (SELECT mission_id FROM challenge_daily_missions WHERE challenge_id = $1)`,
      [challengeId, days],
    );
    await bypass(
      `UPDATE challenge_daily_missions SET challenge_date = challenge_date - $2::int WHERE challenge_id = $1`,
      [challengeId, days],
    );
  }

  const join = (user, id) =>
    http.post(`/api/v1/challenges/${id}/join`).set(auth(user.token));
  const leave = (user, id) =>
    http.post(`/api/v1/challenges/${id}/leave`).set(auth(user.token));
  const dailyRows = async (userId, challengeId) =>
    (
      await db.query(
        `SELECT d.challenge_date::text AS date, d.status, m.status AS mission_status,
                m.source_type, m.reward_points, m.reward_user_xp, m.reward_pet_xp, m.title,
                m.scheduled_date::text AS scheduled, m.verification_method, m.exercise_code
           FROM challenge_daily_missions d JOIN missions m ON m.id = d.mission_id
          WHERE d.user_id = $1 AND d.challenge_id = $2 ORDER BY d.challenge_date`,
        [userId, challengeId],
      )
    ).rows;

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());

    adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `cp_${RUN}`, `${adminId}@example.com`],
    );
    const session = await tx((t) =>
      app.get(SessionsService).create(t, 'admin', adminId),
    );
    adminToken = await app
      .get(AccessTokenService)
      .issue('admin', adminId, session.sessionId);
    categoryId = randomUUID();
    difficultyId = randomUUID();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [categoryId, `cpc${RUN}`, `참가카테고리${RUN}`],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [difficultyId, `cpd${RUN}`, `참가난이도${RUN}`],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('참가하면 기간의 날짜마다 보상 0인 챌린지 전용 미션이 만들어지고, 같은 요청을 반복해도 그대로', async () => {
    const user = await createUser();
    const challenge = await publicChallenge();
    const joined = await join(user, challenge.id).expect(200);
    expect(joined.body).toMatchObject({
      challengeId: challenge.id,
      status: 'enrolled',
    });

    const days = await dailyRows(user.id, challenge.id);
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.date)).toEqual(
      Array.from({ length: 7 }, (_, i) => addDays(challenge.startDate, i)),
    );
    for (const day of days) {
      expect(day).toMatchObject({
        status: 'pending',
        mission_status: 'scheduled',
        source_type: 'challenge',
        reward_points: 0,
        reward_user_xp: 0,
        reward_pet_xp: 0,
        verification_method: 'camera',
        exercise_code: 'squat',
      });
      expect(day.scheduled).toBe(day.date);
    }
    expect(days[0].title).toBe(`참가 테스트 ${RUN} 1일차`);

    const again = await join(user, challenge.id).expect(200);
    expect(again.body.id).toBe(joined.body.id);
    expect(await dailyRows(user.id, challenge.id)).toHaveLength(7);

    const detail = await http
      .get(`/api/v1/challenges/${challenge.id}`)
      .set(auth(user.token))
      .expect(200);
    expect(detail.body).toMatchObject({
      participantCount: 1,
      myParticipation: { id: joined.body.id, status: 'enrolled' },
    });
    const mine = await http
      .get(`/api/v1/challenges/${challenge.id}/me`)
      .set(auth(user.token))
      .expect(200);
    expect(mine.body.days).toHaveLength(7);
    expect(mine.body.days[0]).toMatchObject({
      date: challenge.startDate,
      status: 'pending',
    });
    const list = await http
      .get('/api/v1/me/challenges')
      .set(auth(user.token))
      .expect(200);
    expect(list.body[0]).toMatchObject({
      challengeId: challenge.id,
      status: 'enrolled',
      successfulDays: 0,
      challenge: { title: challenge.title, requiredSuccessDays: 7 },
    });
    await http
      .get(`/api/v1/challenges/${challenge.id}/me`)
      .set(auth(await createUser()))
      .expect(401);
  });

  it('챌린지 미션은 직접 수정·취소·삭제할 수 없음', async () => {
    const user = await createUser();
    const challenge = await publicChallenge();
    await join(user, challenge.id).expect(200);
    const { mission_id: missionId } = (
      await db.query(
        'SELECT mission_id FROM challenge_daily_missions WHERE user_id = $1 LIMIT 1',
        [user.id],
      )
    ).rows[0];
    for (const makeRequest of [
      () =>
        http
          .patch(`/api/v1/missions/${missionId}`)
          .set(auth(user.token))
          .send({ title: '바꿈' }),
      () => http.delete(`/api/v1/missions/${missionId}`).set(auth(user.token)),
      () =>
        http.post(`/api/v1/missions/${missionId}/cancel`).set(auth(user.token)),
    ]) {
      const res = await makeRequest();
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('MISSION_CHALLENGE_LOCKED');
    }
  });

  it('참가할 수 없는 경우: 공개 전·숨김·시작 후·인원 초과·이용 제한·끝난 참가', async () => {
    const user = await createUser();
    const draft = (
      await adminPost('/admin/v1/challenges', {
        title: `초안 ${RUN}`,
        description: '설명',
        categoryId,
        difficultyId,
        verificationMethod: 'camera',
        startDate: addDays(today(), 3),
        endDate: addDays(today(), 9),
        reward: { points: 0, userXp: 0, petXp: 0 },
      }).expect(201)
    ).body;
    await join(user, draft.id).expect(404);
    await join(user, randomUUID()).expect(404);

    const started = await publicChallenge();
    await shiftDays(started.id, 2); // 시작일이 오늘이 됨
    const closed = await join(user, started.id).expect(409);
    expect(closed.body.error.code).toBe('CHALLENGE_NOT_OPEN');

    const small = await publicChallenge({ maxParticipants: 1 });
    await join(await createUser(), small.id).expect(200);
    expect((await join(user, small.id).expect(409)).body.error.code).toBe(
      'CHALLENGE_FULL',
    );

    const open = await publicChallenge();
    const restricted = await createUser();
    await db.query(
      `INSERT INTO account_actions (id, user_id, admin_id, action_type, reason, starts_at, ends_at)
       VALUES ($1,$2,$3,'restriction','테스트', now() - interval '1 minute', now() + interval '1 day')`,
      [randomUUID(), restricted.id, adminId],
    );
    expect((await join(restricted, open.id).expect(403)).body.error.code).toBe(
      'AUTH_ACCOUNT_RESTRICTED',
    );
    await join(user, open.id).expect(200);
    await join(user, open.id).expect(200); // 이미 참가
    await http.post(`/api/v1/challenges/${open.id}/join`).expect(401);
  });

  it('시작 전 포기하면 모든 날을 취소하고, 다시 신청하면 새 미션으로 되살린다(참가 행·일별 행은 그대로)', async () => {
    const user = await createUser();
    const challenge = await publicChallenge();
    const first = (await join(user, challenge.id).expect(200)).body;

    const left = await leave(user, challenge.id).expect(200);
    expect(left.body).toMatchObject({ id: first.id, status: 'withdrawn' });
    expect(left.body.withdrawnAt).toBeTruthy();
    const cancelled = await dailyRows(user.id, challenge.id);
    expect(cancelled).toHaveLength(7);
    expect(
      cancelled.every(
        (d) => d.status === 'cancelled' && d.mission_status === 'cancelled',
      ),
    ).toBe(true);
    await leave(user, challenge.id).expect(200); // 반복해도 같은 결과

    const again = await join(user, challenge.id).expect(200);
    expect(again.body).toMatchObject({
      id: first.id,
      status: 'enrolled',
      withdrawnAt: null,
    });
    const revived = await dailyRows(user.id, challenge.id);
    expect(revived).toHaveLength(7);
    expect(
      revived.every(
        (d) => d.status === 'pending' && d.mission_status === 'scheduled',
      ),
    ).toBe(true);
    const { rows } = await db.query(
      'SELECT 1 FROM challenge_participations WHERE challenge_id = $1 AND user_id = $2',
      [challenge.id, user.id],
    );
    expect(rows).toHaveLength(1);
    await leave(await createUser(), challenge.id).expect(404);
  });

  it('시작 후 포기하면 앞으로의 미션만 취소하고 다시 참가할 수 없음', async () => {
    const user = await createUser();
    const challenge = await publicChallenge();
    await join(user, challenge.id).expect(200);
    await shiftDays(challenge.id, 2); // 오늘이 1일차 → 3일차
    const mid = await leave(user, challenge.id).expect(200);
    expect(mid.body.status).toBe('withdrawn');

    const days = await dailyRows(user.id, challenge.id);
    expect(days).toHaveLength(7);
    const todayIndex = days.findIndex((d) => d.date === today());
    // 지난 날(1~2일차)은 기록 그대로, 오늘부터는 취소
    expect(
      days
        .slice(0, todayIndex)
        .every(
          (d) => d.status === 'pending' && d.mission_status === 'scheduled',
        ),
    ).toBe(true);
    expect(
      days
        .slice(todayIndex)
        .every(
          (d) => d.status === 'cancelled' && d.mission_status === 'cancelled',
        ),
    ).toBe(true);
    expect((await join(user, challenge.id).expect(409)).body.error.code).toBe(
      'CHALLENGE_NOT_OPEN',
    );
  });

  it('관리자가 취소하면 모든 참가자가 포기 처리되고 공개 목록에서 사라짐', async () => {
    const challenge = await publicChallenge();
    const a = await createUser();
    const b = await createUser();
    await join(a, challenge.id).expect(200);
    await join(b, challenge.id).expect(200);

    await adminPost(`/admin/v1/challenges/${challenge.id}/cancel`, {}).expect(
      400,
    );
    const res = await adminPost(`/admin/v1/challenges/${challenge.id}/cancel`, {
      reason: '운영 사정',
    }).expect(200);
    expect(res.body).toEqual({
      id: challenge.id,
      publicationStatus: 'cancelled',
      withdrawnParticipants: 2,
    });
    for (const user of [a, b]) {
      const rows = await dailyRows(user.id, challenge.id);
      expect(rows).toHaveLength(7);
      expect(rows.every((d) => d.status === 'cancelled')).toBe(true);
      const mine = await http
        .get('/api/v1/me/challenges')
        .set(auth(user.token))
        .expect(200);
      expect(mine.body[0].status).toBe('withdrawn');
    }
    await http
      .get(`/api/v1/challenges/${challenge.id}`)
      .set(auth(a.token))
      .expect(404);
    expect(
      (
        await adminPost(`/admin/v1/challenges/${challenge.id}/cancel`, {
          reason: '다시',
        }).expect(409)
      ).body.error.code,
    ).toBe('CHALLENGE_NOT_CANCELLABLE');
    const events = await db.query(
      'SELECT event_type FROM challenge_rule_events WHERE challenge_id = $1',
      [challenge.id],
    );
    expect(events.rows.map((r) => r.event_type).sort()).toEqual([
      'cancelled',
      'published',
    ]);
  });

  it('챌린지 미션의 성공·실패는 일반 스트릭에 영향을 주지 않음', async () => {
    const user = await createUser();
    const challenge = await publicChallenge();
    await join(user, challenge.id).expect(200);
    await shiftDays(challenge.id, 10); // 이미 끝난 챌린지, 모든 날이 어제 이전
    await tx((t) => app.get(StreakService).recalculate(t, user.id));
    const { rows } = await db.query(
      'SELECT 1 FROM streak_days WHERE user_id = $1',
      [user.id],
    );
    expect(rows).toHaveLength(0);
    const state = await db.query(
      'SELECT current_success_days FROM streak_states WHERE user_id = $1',
      [user.id],
    );
    expect(state.rows[0].current_success_days).toBe(0);
  });
});
