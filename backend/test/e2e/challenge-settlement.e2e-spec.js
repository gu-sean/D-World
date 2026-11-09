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
import { ScoringService } from '../../src/challenges/scoring.service.js';
import { RewardPayoutService } from '../../src/challenges/reward-payout.service.js';
import { PointsService } from '../../src/points/points.service.js';
import { DecisionService } from '../../src/verification/decision.service.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);
const SECRET = 'test-ai-ingest-secret-0123456789-abcdef';

describe.skipIf(!databaseUrl)('챌린지 정산·보상 지급 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let scoring;
  let decisions;
  let adminId;
  let adminToken;
  let categoryId;
  let difficultyId;

  const tx = (fn) => db.withTransaction(fn);
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const today = () => kstDate();
  const adminPost = (path, body = {}) =>
    adminApi(http, adminToken).post(path, body);
  const adminGet = (path) => adminApi(http, adminToken).get(path);
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

  /** 센서 인증 7일 챌린지, 2일 성공이면 완주, 보상 300P·XP 30/60 */
  async function publicChallenge() {
    const startDate = addDays(today(), 2);
    const created = await adminPost('/admin/v1/challenges', {
      title: `정산 테스트 ${RUN}`,
      description: '설명',
      categoryId,
      difficultyId,
      verificationMethod: 'sensor',
      exerciseCode: 'running',
      startDate,
      endDate: addDays(startDate, 6),
      requiredSuccessDays: 2,
      reward: { points: 300, userXp: 30, petXp: 60 },
    }).expect(201);
    await adminPost(`/admin/v1/challenges/${created.body.id}/publish`).expect(
      200,
    );
    return created.body;
  }

  async function shiftBy(challengeId, days) {
    if (days === 0) return;
    const ids = `SELECT mission_id FROM challenge_daily_missions WHERE challenge_id = $1`;
    await bypass(
      `UPDATE challenges SET start_date = start_date - $2::int, end_date = end_date - $2::int WHERE id = $1`,
      [challengeId, days],
    );
    await bypass(
      `UPDATE missions SET scheduled_date = scheduled_date - $2::int WHERE id IN (${ids})`,
      [challengeId, days],
    );
    await bypass(
      `UPDATE challenge_daily_missions SET challenge_date = challenge_date + 1000 WHERE challenge_id = $1`,
      [challengeId],
    );
    await bypass(
      `UPDATE challenge_daily_missions SET challenge_date = challenge_date - 1000 - $2::int WHERE challenge_id = $1`,
      [challengeId, days],
    );
    await bypass(
      `UPDATE mission_records SET started_at = started_at - make_interval(days => $2),
              submitted_at = submitted_at - make_interval(days => $2),
              completed_at = completed_at - make_interval(days => $2)
        WHERE mission_id IN (${ids})`,
      [challengeId, days],
    );
    await bypass(
      `UPDATE verification_results SET decided_at = decided_at - make_interval(days => $2),
              notified_at = notified_at - make_interval(days => $2)
        WHERE record_id IN (SELECT id FROM mission_records WHERE mission_id IN (${ids}))`,
      [challengeId, days],
    );
  }

  async function goToDay(challenge, dayIndex) {
    const { d } = (
      await db.query(
        'SELECT start_date::text AS d FROM challenges WHERE id = $1',
        [challenge.id],
      )
    ).rows[0];
    const diff = Math.round(
      (Date.parse(`${addDays(d, dayIndex)}T00:00:00Z`) -
        Date.parse(`${today()}T00:00:00Z`)) /
        86_400_000,
    );
    await shiftBy(challenge.id, diff);
  }

  const missionOf = async (userId, challengeId, dayIndex) =>
    (
      await db.query(
        `SELECT mission_id FROM challenge_daily_missions WHERE user_id = $1 AND challenge_id = $2
          ORDER BY challenge_date OFFSET $3 LIMIT 1`,
        [userId, challengeId, dayIndex],
      )
    ).rows[0].mission_id;

  const ingest = (recordId, decision) =>
    http
      .post('/internal/v1/ai-callbacks/verification-results')
      .set('x-internal-token', SECRET)
      .send({
        ingestKey: randomUUID(),
        recordId,
        decision,
        engineVersion: 'model-v1',
        confidence: 0.9,
        metrics: { score: 0.5 },
        reason: '결과',
        rawResult: { raw: true },
      })
      .expect(200);

  async function perform(user, challenge, dayIndex, decision = 'approved') {
    await goToDay(challenge, dayIndex);
    const missionId = await missionOf(user.id, challenge.id, dayIndex);
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
    await ingest(record.id, decision);
    return record.id;
  }

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
  const join = (user, challenge) =>
    http
      .post(`/api/v1/challenges/${challenge.id}/join`)
      .set(auth(user.token))
      .expect(200);
  const wallet = async (userId) =>
    Number(
      (
        await db.query(
          'SELECT available_points FROM point_wallets WHERE user_id = $1',
          [userId],
        )
      ).rows[0]?.available_points ?? 0,
    );
  const userXp = async (userId) =>
    Number(
      (
        await db.query(
          'SELECT total_xp FROM user_experience WHERE user_id = $1',
          [userId],
        )
      ).rows[0]?.total_xp ?? 0,
    );
  const participationOf = async (userId, challengeId) =>
    (
      await db.query(
        'SELECT id, status FROM challenge_participations WHERE user_id = $1 AND challenge_id = $2',
        [userId, challengeId],
      )
    ).rows[0];
  const entryOf = (run, participationId) =>
    run.entries.find((e) => e.participationId === participationId);

  /**
   * 참가자 5명: A 3일 성공, B 2일 성공(완주), C 1일 성공(미달), D 2일차에 포기, E 실격
   * 종료 다음 날로 옮기고 일별 결과를 확정한 상태를 만든다
   */
  async function endedChallenge() {
    const challenge = await publicChallenge();
    const [a, b, c, d, e] = [
      await createUser(),
      await createUser(),
      await createUser(),
      await createUser(),
      await createUser(),
    ];
    for (const user of [a, b, c, d, e]) await join(user, challenge);
    const records = { a: [], b: [] };
    records.a.push(await perform(a, challenge, 0));
    await perform(b, challenge, 0);
    await perform(c, challenge, 0);
    await perform(e, challenge, 0);
    await goToDay(challenge, 1);
    records.a.push(await perform(a, challenge, 1));
    records.b.push(await perform(b, challenge, 1));
    await http
      .post(`/api/v1/challenges/${challenge.id}/leave`)
      .set(auth(d.token))
      .expect(200);
    const eParticipation = await participationOf(e.id, challenge.id);
    await adminPost(
      `/admin/v1/challenges/${challenge.id}/participants/${eParticipation.id}/disqualify`,
      {
        reason: '부정 행위',
      },
    ).expect(200);
    records.a.push(await perform(a, challenge, 2));
    await goToDay(challenge, 7); // 종료 다음 날
    await scoring.settleDays();
    return { challenge, users: { a, b, c, d, e }, records };
  }

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    scoring = app.get(ScoringService);
    decisions = app.get(DecisionService);

    adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `st_${RUN}`, `${adminId}@example.com`],
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
      [categoryId, `stc${RUN}`, `정산카테고리${RUN}`],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [difficultyId, `std${RUN}`, `정산난이도${RUN}`],
    );
    await db.query(
      `INSERT INTO verification_criteria_versions
              (id, category_id, verification_method, version_no, rules_json, effective_at, created_by_admin_id)
       VALUES ($1,$2,'sensor',1,'{}'::jsonb, now() - interval '30 days', $3)`,
      [randomUUID(), categoryId, adminId],
    );
    for (const [table, thresholds] of [
      [
        'user_level_policy_versions',
        [
          [1, 0],
          [2, 100],
        ],
      ],
      [
        'pet_level_policy_versions',
        [
          [1, 0],
          [2, 40],
          [3, 120],
          [4, 400],
        ],
      ],
    ]) {
      const policyId = randomUUID();
      await db.query(
        `INSERT INTO ${table} (id, version_no, effective_at, created_by_admin_id)
         VALUES ($1,$2, now() - interval '30 days', $3)`,
        [policyId, randomInt(1_000_000, 1_000_000_000), adminId],
      );
      const thresholdTable = table
        .replace('_versions', '')
        .replace('_policy', '_thresholds');
      for (const [level, xp] of thresholds) {
        await db.query(
          `INSERT INTO ${thresholdTable} (policy_version_id, level_no, min_total_xp) VALUES ($1,$2,$3)`,
          [policyId, level, xp],
        );
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('종료 전에는 초안을 만들 수 없고, 종료 후 초안에는 완주·순위·제외 사유가 계산됨', async () => {
    const early = await publicChallenge();
    const res = await adminPost(
      `/admin/v1/challenges/${early.id}/settlements`,
    ).expect(409);
    expect(res.body.error.code).toBe('CHALLENGE_NOT_ENDED');

    const { challenge, users } = await endedChallenge();
    const draft = await adminPost(
      `/admin/v1/challenges/${challenge.id}/settlements`,
    ).expect(201);
    expect(draft.body).toMatchObject({
      runNo: 1,
      status: 'draft',
      blockers: { ready: true },
    });
    const pid = async (user) =>
      (await participationOf(user.id, challenge.id)).id;
    const entry = (user) => async () => entryOf(draft.body, await pid(user));

    expect(await entry(users.a)()).toMatchObject({
      rank: 1,
      outcome: 'completed',
      successfulDays: 3,
      score: 300,
      promisedPoints: 300,
      userXp: 30,
      petXp: 60,
      paymentStatus: 'pending',
    });
    expect(await entry(users.b)()).toMatchObject({
      rank: 2,
      outcome: 'completed',
      successfulDays: 2,
    });
    expect(await entry(users.c)()).toMatchObject({
      rank: 3,
      outcome: 'failed',
      promisedPoints: 0,
      paymentStatus: 'none',
    });
    expect(await entry(users.d)()).toMatchObject({
      rank: null,
      outcome: 'withdrawn',
      exclusionReason: '자진 포기',
    });
    expect(await entry(users.e)()).toMatchObject({
      rank: null,
      outcome: 'disqualified',
      exclusionReason: '부정 행위',
    });

    // 초안을 다시 만들면 이전 초안을 대체(확정본이 없으면 번호도 다시 1)
    const again = await adminPost(
      `/admin/v1/challenges/${challenge.id}/settlements`,
    ).expect(201);
    expect(again.body.runNo).toBe(1);
    expect(again.body.id).not.toBe(draft.body.id);
    const drafts = await db.query(
      `SELECT id FROM challenge_settlement_runs WHERE challenge_id = $1 AND status = 'draft'`,
      [challenge.id],
    );
    expect(drafts.rows).toEqual([{ id: again.body.id }]);
    const detail = await adminGet(
      `/admin/v1/challenges/${challenge.id}/settlements/${again.body.id}`,
    ).expect(200);
    expect(detail.body.blockers.ready).toBe(true);
    await http
      .get(`/admin/v1/settlement-runs/${again.body.id}`)
      .set(auth(users.a.token))
      .expect(401);
  });

  it('확정 조건: 일별 결과가 남아 있거나 초안이 오래되면 거절', async () => {
    const { challenge, users, records } = await endedChallenge();
    const draft = (
      await adminPost(
        `/admin/v1/challenges/${challenge.id}/settlements`,
      ).expect(201)
    ).body;
    const confirmPath = `/admin/v1/challenges/${challenge.id}/settlements/${draft.id}/confirm`;
    await adminPost(confirmPath, {}).expect(400); // 사유 필수

    // 초안을 만든 뒤 판정이 바뀌면 오래된 초안
    await redecide(records.b[0], 'rejected');
    const stale = await adminPost(confirmPath, { reason: '확정' }).expect(409);
    expect(stale.body.error.code).toBe('PLAN_PROPOSAL_OUTDATED');
    await redecide(records.b[0], 'approved');

    // 확정 전 상태가 되돌려졌으니 확정 가능
    const fresh = (
      await adminPost(
        `/admin/v1/challenges/${challenge.id}/settlements`,
      ).expect(201)
    ).body;
    const ok = await adminPost(
      `/admin/v1/challenges/${challenge.id}/settlements/${fresh.id}/confirm`,
      { reason: '확정' },
    ).expect(200);
    expect(ok.body.status).toBe('confirmed');
    expect(users.a).toBeTruthy();
    await adminPost(
      `/admin/v1/challenges/${challenge.id}/settlements/${fresh.id}/confirm`,
      { reason: '또' },
    ).expect(409);
  });

  it('확정하면 순위 스냅샷·참가 상태가 정해지고 완주자에게 포인트·XP가 한 번씩 지급됨', async () => {
    const { challenge, users } = await endedChallenge();
    const draft = (
      await adminPost(
        `/admin/v1/challenges/${challenge.id}/settlements`,
      ).expect(201)
    ).body;
    const key = randomUUID();
    const path = `/admin/v1/settlement-runs/${draft.id}/confirm`;
    const confirmed = await http
      .post(path)
      .set(auth(adminToken))
      .set('Idempotency-Key', key)
      .send({ reason: '검토 완료' })
      .expect(200);
    expect(confirmed.body).toMatchObject({
      status: 'confirmed',
      entries: 5,
      finalRankings: 3,
      completed: 2,
      payments: { paid: 2, failed: 0 },
    });

    for (const user of [users.a, users.b]) {
      expect(await wallet(user.id)).toBe(300);
      expect(await userXp(user.id)).toBe(30);
      expect((await participationOf(user.id, challenge.id)).status).toBe(
        'completed',
      );
    }
    for (const user of [users.c, users.d, users.e])
      expect(await wallet(user.id)).toBe(0);
    expect((await participationOf(users.c.id, challenge.id)).status).toBe(
      'failed',
    );
    expect((await participationOf(users.d.id, challenge.id)).status).toBe(
      'withdrawn',
    );
    expect((await participationOf(users.e.id, challenge.id)).status).toBe(
      'disqualified',
    );

    const grants = await db.query(
      'SELECT status, paid_points FROM challenge_reward_grants WHERE challenge_id = $1',
      [challenge.id],
    );
    expect(grants.rows).toHaveLength(2);
    expect(
      grants.rows.every((g) => g.status === 'active' && g.paid_points === 300),
    ).toBe(true);
    const run = (
      await adminGet(
        `/admin/v1/challenges/${challenge.id}/settlements/${draft.id}`,
      ).expect(200)
    ).body;
    expect(run.entries.filter((e) => e.paymentStatus === 'paid')).toHaveLength(
      2,
    );
    expect(
      (
        await db.query(
          'SELECT settlement_status FROM challenges WHERE id = $1',
          [challenge.id],
        )
      ).rows[0].settlement_status,
    ).toBe('confirmed');

    // 같은 키 재생, 같은 정산 재지급 없음
    const replay = await http
      .post(path)
      .set(auth(adminToken))
      .set('Idempotency-Key', key)
      .send({ reason: '검토 완료' })
      .expect(200);
    expect(replay.body.runId).toBe(confirmed.body.runId);
    await adminPost(
      `/admin/v1/challenges/${challenge.id}/settlements/${draft.id}/retry-payments`,
    ).expect(202);
    expect(await wallet(users.a.id)).toBe(300);

    // 공개 순위는 확정본(잠정 아님)
    const ranking = (
      await http
        .get(`/api/v1/challenges/${challenge.id}/ranking`)
        .set(auth(users.b.token))
        .expect(200)
    ).body;
    expect(ranking).toMatchObject({ provisional: false, total: 3 });
    expect(ranking.items.map((i) => i.rank)).toEqual([1, 2, 3]);
    expect(ranking.me).toMatchObject({ rank: 2, isMe: true, score: 200 });
    const mine = (
      await http
        .get(`/api/v1/challenges/${challenge.id}/me`)
        .set(auth(users.a.token))
        .expect(200)
    ).body;
    expect(mine.settlement).toMatchObject({
      outcome: 'completed',
      rank: 1,
      paidPoints: 300,
      paymentStatus: 'paid',
    });

    // 확정 뒤에는 운영 조치로 점수를 바꿀 수 없음
    const aPart = await participationOf(users.a.id, challenge.id);
    const days = (
      await adminGet(
        `/admin/v1/challenges/${challenge.id}/participants/${aPart.id}/days`,
      ).expect(200)
    ).body.items;
    const res = await adminPost(
      `/admin/v1/challenges/${challenge.id}/participants/${aPart.id}/days/${days[0].id}/exclude`,
      { reason: '확정 후' },
    ).expect(409);
    expect(res.body.error.code).toBe('ADMIN_STATE_CONFLICT');
  });

  it('지급이 실패하면 그 참가자만 롤백·기록되고 재시도하면 한 번만 지급', async () => {
    const { challenge, users } = await endedChallenge();
    const draft = (
      await adminPost(
        `/admin/v1/challenges/${challenge.id}/settlements`,
      ).expect(201)
    ).body;
    const points = app.get(PointsService);
    const original = points.awardAutoPoints.bind(points);
    let calls = 0;
    points.awardAutoPoints = async (...args) => {
      calls += 1;
      if (calls === 1) throw new Error('포인트 서비스 장애');
      return original(...args);
    };
    let confirmed;
    try {
      confirmed = await adminPost(
        `/admin/v1/challenges/${challenge.id}/settlements/${draft.id}/confirm`,
        {
          reason: '확정',
        },
      ).expect(200);
    } finally {
      points.awardAutoPoints = original;
    }
    expect(confirmed.body.payments).toEqual({ paid: 1, failed: 1, skipped: 0 });
    const failedEntry = (
      await db.query(
        `SELECT e.participation_id, e.payment_status, a.attempt_count, a.last_error
           FROM challenge_settlement_entries e
           JOIN challenge_reward_payment_attempts a USING (run_id, participation_id)
          WHERE e.run_id = $1`,
        [draft.id],
      )
    ).rows;
    expect(failedEntry).toHaveLength(1);
    expect(failedEntry[0]).toMatchObject({
      payment_status: 'failed',
      attempt_count: 1,
    });
    expect(failedEntry[0].last_error).toContain('포인트 서비스 장애');
    // 실패한 참가자는 지급 행·원장이 하나도 남지 않음
    const stuck = failedEntry[0].participation_id;
    expect(
      (
        await db.query(
          'SELECT 1 FROM challenge_reward_grants WHERE participation_id = $1',
          [stuck],
        )
      ).rows,
    ).toHaveLength(0);

    const retry = await adminPost(
      `/admin/v1/challenges/${challenge.id}/settlements/${draft.id}/retry-payments`,
    ).expect(202);
    expect(retry.body).toEqual({ retriedCount: 1 });
    expect(
      (
        await db.query(
          'SELECT 1 FROM challenge_reward_payment_attempts WHERE run_id = $1',
          [draft.id],
        )
      ).rows,
    ).toHaveLength(0);
    expect(await wallet(users.a.id)).toBe(300);
    expect(await wallet(users.b.id)).toBe(300);
    const grants = await db.query(
      'SELECT 1 FROM challenge_reward_grants WHERE challenge_id = $1',
      [challenge.id],
    );
    expect(grants.rows).toHaveLength(2);
  });

  it('지급 작업은 재시도 대기 중인 정산이 쌓여도 지급할 건이 있는 정산을 고름', async () => {
    const confirm = async (failFirst) => {
      const { challenge } = await endedChallenge();
      const draft = (
        await adminPost(
          `/admin/v1/challenges/${challenge.id}/settlements`,
        ).expect(201)
      ).body;
      const points = app.get(PointsService);
      const original = points.awardAutoPoints.bind(points);
      points.awardAutoPoints = async (...args) => {
        if (failFirst) throw new Error('포인트 서비스 장애');
        return original(...args);
      };
      try {
        await adminPost(
          `/admin/v1/challenges/${challenge.id}/settlements/${draft.id}/confirm`,
          { reason: '확정' },
        ).expect(200);
      } finally {
        points.awardAutoPoints = original;
      }
      return draft.id;
    };
    // A: 지급이 실패해 재시도 시각을 기다리는 정산
    const waiting = await confirm(true);
    await db.query(
      `UPDATE challenge_reward_payment_attempts
          SET next_retry_at = now() + interval '1 hour' WHERE run_id = $1`,
      [waiting],
    );
    // B: 확정 직후 서버가 멈춰 미지급으로 남은 정산
    const unpaid = await confirm(false);
    await db.query(
      `UPDATE challenge_settlement_entries SET payment_status = 'pending'
        WHERE run_id = $1 AND outcome = 'completed'`,
      [unpaid],
    );

    const payout = app.get(RewardPayoutService);
    const due = await payout.dueRunIds(1000);
    expect(due).toContain(unpaid);
    expect(due).not.toContain(waiting);

    await payout.payDue({ limit: 1000 });
    const { rows } = await db.query(
      `SELECT DISTINCT payment_status FROM challenge_settlement_entries
        WHERE run_id = $1 AND outcome = 'completed'`,
      [unpaid],
    );
    expect(rows).toEqual([{ payment_status: 'paid' }]);
    // 이미 지급된 참가자는 다시 지급하지 않음(지급 행은 참가자당 하나)
    const grants = await db.query(
      `SELECT participation_id, count(*)::int AS n FROM challenge_reward_grants
        WHERE first_settlement_run_id = $1 GROUP BY participation_id`,
      [unpaid],
    );
    expect(grants.rows.every((g) => g.n === 1)).toBe(true);
  });

  it('실패가 오래 쌓여도 재시도 간격 계산이 넘치지 않고 상한(6시간)을 유지', async () => {
    const { challenge } = await endedChallenge();
    const draft = (
      await adminPost(
        `/admin/v1/challenges/${challenge.id}/settlements`,
      ).expect(201)
    ).body;
    const points = app.get(PointsService);
    const original = points.awardAutoPoints.bind(points);
    points.awardAutoPoints = async () => {
      throw new Error('포인트 서비스 장애');
    };
    try {
      await adminPost(
        `/admin/v1/challenges/${challenge.id}/settlements/${draft.id}/confirm`,
        { reason: '확정' },
      ).expect(200);
      // 26회째부터 정수 2^n 계산이 넘쳤던 구간: 실패 40회 누적 상태로 만듦
      await db.query(
        `UPDATE challenge_reward_payment_attempts
            SET attempt_count = 40, next_retry_at = now() - interval '1 minute'
          WHERE run_id = $1`,
        [draft.id],
      );
      const result = await app.get(RewardPayoutService).payRun(draft.id);
      expect(result.failed).toBeGreaterThanOrEqual(1);
    } finally {
      points.awardAutoPoints = original;
    }
    const { rows } = await db.query(
      `SELECT attempt_count,
              EXTRACT(EPOCH FROM (next_retry_at - last_attempt_at))::int AS wait
         FROM challenge_reward_payment_attempts WHERE run_id = $1`,
      [draft.id],
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(row.attempt_count).toBe(41);
      expect(row.wait).toBe(6 * 60 * 60);
    }
  });

  it('정정 정산: 자격을 잃으면 포인트·XP를 회수하고 정산이 새 버전으로 대체, 다시 충족하면 복구', async () => {
    const { challenge, users, records } = await endedChallenge();
    const first = (
      await adminPost(
        `/admin/v1/challenges/${challenge.id}/settlements`,
      ).expect(201)
    ).body;
    await adminPost(
      `/admin/v1/challenges/${challenge.id}/settlements/${first.id}/confirm`,
      { reason: '1차' },
    ).expect(200);
    expect(await wallet(users.b.id)).toBe(300);

    // B의 한 날이 번복되어 성공 1일(미달)
    await redecide(records.b[0], 'rejected');
    const second = (
      await adminPost(
        `/admin/v1/challenges/${challenge.id}/settlements`,
      ).expect(201)
    ).body;
    expect(second.runNo).toBe(2);
    const secondEntry = entryOf(
      second,
      (await participationOf(users.b.id, challenge.id)).id,
    );
    expect(secondEntry).toMatchObject({ outcome: 'failed', successfulDays: 1 });
    const corrected = await adminPost(
      `/admin/v1/challenges/${challenge.id}/settlements/${second.id}/confirm`,
      {
        reason: '판정 번복 정정',
      },
    ).expect(200);
    expect(corrected.body.revokedGrants).toBe(1);
    expect(await wallet(users.b.id)).toBe(0);
    expect(await userXp(users.b.id)).toBe(0);
    expect(await wallet(users.a.id)).toBe(300);
    expect((await participationOf(users.b.id, challenge.id)).status).toBe(
      'failed',
    );
    const runs = (
      await db.query(
        `SELECT run_no, status FROM challenge_settlement_runs
          WHERE challenge_id = $1 ORDER BY run_no DESC`,
        [challenge.id],
      )
    ).rows;
    expect(runs.map((r) => [r.run_no, r.status])).toEqual([
      [2, 'confirmed'],
      [1, 'superseded'],
    ]);
    const grant = (
      await db.query(
        `SELECT g.status FROM challenge_reward_grants g JOIN challenge_participations p ON p.id = g.participation_id
          WHERE p.user_id = $1`,
        [users.b.id],
      )
    ).rows[0];
    expect(grant.status).toBe('revoked');
    // 최신 확정본 기준 공개 순위
    const ranking = (
      await http
        .get(`/api/v1/challenges/${challenge.id}/ranking`)
        .set(auth(users.a.token))
        .expect(200)
    ).body;
    expect(ranking.items.map((i) => i.score)).toEqual([300, 100, 100]);

    // 다시 승인되면 복구(중복 지급 없음)
    await redecide(records.b[0], 'approved');
    const third = (
      await adminPost(
        `/admin/v1/challenges/${challenge.id}/settlements`,
      ).expect(201)
    ).body;
    const restored = await adminPost(
      `/admin/v1/challenges/${challenge.id}/settlements/${third.id}/confirm`,
      {
        reason: '재승인 복구',
      },
    ).expect(200);
    expect(restored.body.payments).toEqual({ paid: 1, failed: 0, skipped: 0 });
    expect(await wallet(users.b.id)).toBe(300);
    expect(await userXp(users.b.id)).toBe(30);
    expect((await participationOf(users.b.id, challenge.id)).status).toBe(
      'completed',
    );
    const grants = await db.query(
      'SELECT status FROM challenge_reward_grants WHERE challenge_id = $1',
      [challenge.id],
    );
    expect(grants.rows.map((g) => g.status)).toEqual(['active', 'active']);
  });

  it('탈퇴하면 확정 순위는 익명으로 남고 점수·순위만 유지', async () => {
    const { challenge, users } = await endedChallenge();
    const draft = (
      await adminPost(
        `/admin/v1/challenges/${challenge.id}/settlements`,
      ).expect(201)
    ).body;
    await adminPost(
      `/admin/v1/challenges/${challenge.id}/settlements/${draft.id}/confirm`,
      { reason: '확정' },
    ).expect(200);

    await db.query('DELETE FROM users WHERE id = $1', [users.b.id]);
    const { rows } = await db.query(
      `SELECT rank_no, score, display_name, participation_id, anonymized_at
         FROM challenge_final_rankings WHERE run_id = $1 ORDER BY rank_no`,
      [draft.id],
    );
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatchObject({
      rank_no: 2,
      score: 200,
      display_name: '탈퇴 회원',
      participation_id: null,
    });
    expect(rows[1].anonymized_at).toBeTruthy();

    const ranking = (
      await http
        .get(`/api/v1/challenges/${challenge.id}/ranking`)
        .set(auth(users.a.token))
        .expect(200)
    ).body;
    expect(ranking.items.map((i) => i.displayName)[1]).toBe('탈퇴 회원');
    expect(ranking.items.map((i) => i.rank)).toEqual([1, 2, 3]);
    expect(ranking.me).toMatchObject({ rank: 1, isMe: true });
  });

  it('보상이 0인 사용자 개설 챌린지도 정산·확정되고 완주 기록만 남음(지급 행 0P, 원장 없음)', async () => {
    const owner = await createUser();
    const other = await createUser();
    const startDate = addDays(today(), 2);
    const created = (
      await http
        .post('/api/v1/challenges')
        .set(auth(owner.token))
        .send({
          title: `사용자 정산 ${RUN}`,
          description: '설명',
          categoryId,
          difficultyId,
          verificationMethod: 'sensor',
          exerciseCode: 'running',
          startDate,
          endDate: addDays(startDate, 6),
          requiredSuccessDays: 1,
        })
        .expect(201)
    ).body;
    await http
      .post(`/api/v1/challenges/${created.id}/submit`)
      .set(auth(owner.token))
      .expect(200);
    await adminPost(`/admin/v1/challenges/${created.id}/review`, {
      decision: 'approve',
    }).expect(200);
    await join(owner, created);
    await join(other, created);
    await perform(owner, created, 0);
    await goToDay(created, 7);
    await scoring.settleDays();

    const draft = (
      await adminPost(`/admin/v1/challenges/${created.id}/settlements`).expect(
        201,
      )
    ).body;
    const confirmed = await adminPost(
      `/admin/v1/challenges/${created.id}/settlements/${draft.id}/confirm`,
      {
        reason: '확정',
      },
    ).expect(200);
    expect(confirmed.body).toMatchObject({
      completed: 1,
      finalRankings: 2,
      payments: { paid: 1, failed: 0 },
    });

    const grant = (
      await db.query(
        'SELECT promised_points, paid_points, user_xp, pet_xp, status FROM challenge_reward_grants WHERE user_id = $1',
        [owner.id],
      )
    ).rows;
    expect(grant).toEqual([
      {
        promised_points: 0,
        paid_points: 0,
        user_xp: 0,
        pet_xp: 0,
        status: 'active',
      },
    ]);
    expect(await wallet(owner.id)).toBe(0);
    expect(
      (
        await db.query('SELECT 1 FROM point_transactions WHERE user_id = $1', [
          owner.id,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query('SELECT 1 FROM experience_awards WHERE user_id = $1', [
          owner.id,
        ])
      ).rows,
    ).toHaveLength(0);
    expect((await participationOf(owner.id, created.id)).status).toBe(
      'completed',
    );
    expect((await participationOf(other.id, created.id)).status).toBe('failed');
    const ranking = (
      await http
        .get(`/api/v1/challenges/${created.id}/ranking`)
        .set(auth(other.token))
        .expect(200)
    ).body;
    expect(ranking.items.map((i) => i.rank)).toEqual([1, 2]);
  });
});
