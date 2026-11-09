import { adminApi } from '../support/admin-api.js';
import { testNickname } from '../support/users.js';
import { configureApp } from '../../src/app.setup.js';
import { randomInt, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { addDays, kstDate } from '../../src/common/time/kst.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { ScoringService } from '../../src/challenges/scoring.service.js';
import { DecisionService } from '../../src/verification/decision.service.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);
const SECRET = 'test-ai-ingest-secret-0123456789-abcdef';

describe.skipIf(!databaseUrl)(
  '챌린지 일별 결과·순위·운영 조치 (PostgreSQL)',
  () => {
    let app;
    let db;
    let http;
    let scoring;
    let decisions;
    let adminId;
    let adminToken;
    let categoryId;
    let difficultyId;
    /** 챌린지별로 지금 시각 기준 몇 번째 날이 "오늘"인지(앞당긴 일수) */
    const shifted = new Map();

    const tx = (fn) => db.withTransaction(fn);
    const auth = (token) => ({ Authorization: `Bearer ${token}` });
    const today = () => kstDate();
    const adminPost = (path, body) =>
      adminApi(http, adminToken).post(path, body);
    const bypass = (sql, params) =>
      tx(async (t) => {
        await t.query('SET LOCAL session_replication_role = replica');
        await t.query(sql, params);
      });

    async function createUser() {
      const id = randomUUID();
      await db.query('INSERT INTO users (id) VALUES ($1)', [id]);
      await db.query(
        'INSERT INTO profiles (user_id, nickname) VALUES ($1, $2)',
        [id, testNickname()],
      );
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

    /** 센서 인증 7일 챌린지, 처음에는 시작이 모레 */
    async function publicChallenge(overrides = {}) {
      const startDate = addDays(today(), 2);
      const created = await adminPost('/admin/v1/challenges', {
        title: `점수 테스트 ${RUN}`,
        description: '설명',
        categoryId,
        difficultyId,
        verificationMethod: 'sensor',
        exerciseCode: 'running',
        startDate,
        endDate: addDays(startDate, 6),
        requiredSuccessDays: 3,
        reward: { points: 300, userXp: 30, petXp: 60 },
        ...overrides,
      }).expect(201);
      await adminPost(
        `/admin/v1/challenges/${created.body.id}/publish`,
        {},
      ).expect(200);
      shifted.set(created.body.id, 0);
      return created.body;
    }

    /** 챌린지 전체(미션·일별 행·인증 기록·판정 시각)를 days일 앞당긴다. 음수면 뒤로 */
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
      // 참가·날짜 고유 제약이 행마다 검사되므로 멀리 옮겼다가 목표 날짜로 되돌린다
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
      shifted.set(challengeId, shifted.get(challengeId) + days);
    }

    /** dayIndex(0부터)번째 날이 오늘이 되도록 챌린지 시간을 옮긴다 */
    async function goToDay(challenge, dayIndex) {
      const row = (
        await db.query(
          'SELECT start_date::text AS d FROM challenges WHERE id = $1',
          [challenge.id],
        )
      ).rows[0];
      const current = row.d;
      const target = addDays(current, dayIndex);
      const diffDays = Math.round(
        (Date.parse(`${target}T00:00:00Z`) -
          Date.parse(`${today()}T00:00:00Z`)) /
          86_400_000,
      );
      await shiftBy(challenge.id, diffDays);
    }

    const missionOf = async (userId, challengeId, dayIndex) =>
      (
        await db.query(
          `SELECT d.id AS daily_id, d.mission_id FROM challenge_daily_missions d
          WHERE d.user_id = $1 AND d.challenge_id = $2 ORDER BY d.challenge_date OFFSET $3 LIMIT 1`,
          [userId, challengeId, dayIndex],
        )
      ).rows[0];

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
          reason: decision === 'rejected' ? '기준 미달' : '충족',
          rawResult: { raw: true },
        })
        .expect(200);

    /** 오늘 날짜의 미션을 수행해 제출하고 AI 결과를 받는다. recordId 반환 */
    async function performToday(user, challenge, dayIndex, decision) {
      await goToDay(challenge, dayIndex);
      const { mission_id: missionId } = await missionOf(
        user.id,
        challenge.id,
        dayIndex,
      );
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
    const dayStatuses = async (userId, challengeId) =>
      (
        await db.query(
          `SELECT status FROM challenge_daily_missions WHERE user_id = $1 AND challenge_id = $2
          ORDER BY challenge_date`,
          [userId, challengeId],
        )
      ).rows.map((r) => r.status);
    const join = (user, challenge) =>
      http
        .post(`/api/v1/challenges/${challenge.id}/join`)
        .set(auth(user.token))
        .expect(200);
    const ranking = async (user, challenge, query = {}) =>
      (
        await http
          .get(`/api/v1/challenges/${challenge.id}/ranking`)
          .query(query)
          .set(auth(user.token))
          .expect(200)
      ).body;

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
      http = request(app.getHttpServer());
      db = app.get(DatabaseService);
      scoring = app.get(ScoringService);
      decisions = app.get(DecisionService);

      adminId = randomUUID();
      await db.query(
        `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
        [adminId, `cs_${RUN}`, `${adminId}@example.com`],
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
        [categoryId, `csc${RUN}`, `점수카테고리${RUN}`],
      );
      await db.query(
        `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [difficultyId, `csd${RUN}`, `점수난이도${RUN}`],
      );
      await db.query(
        `INSERT INTO verification_criteria_versions
              (id, category_id, verification_method, version_no, rules_json, effective_at, created_by_admin_id)
       VALUES ($1,$2,'sensor',1,'{}'::jsonb, now() - interval '30 days', $3)`,
        [randomUUID(), categoryId, adminId],
      );
    });

    afterAll(async () => {
      await app.close();
    });

    it('승인되면 그날이 success, 거절되면 날이 끝날 때까지 pending(재시도 가능) 후 failed, 챌린지 미션은 보상을 주지 않음', async () => {
      const user = await createUser();
      const challenge = await publicChallenge();
      await join(user, challenge);

      // 1일차 승인 → success
      const first = await performToday(user, challenge, 0, 'approved');
      expect((await dayStatuses(user.id, challenge.id))[0]).toBe('success');
      const { rows } = await db.query(
        `SELECT qualifying_record_id, qualifying_result_id FROM challenge_daily_missions
        WHERE user_id = $1 ORDER BY challenge_date LIMIT 1`,
        [user.id],
      );
      expect(rows[0].qualifying_record_id).toBe(first);
      expect(rows[0].qualifying_result_id).toBeTruthy();

      // 2일차 거절 → 아직 날이 안 끝나 pending, 미션은 재시도 가능
      const rejected = await performToday(user, challenge, 1, 'rejected');
      expect((await dayStatuses(user.id, challenge.id)).slice(0, 2)).toEqual([
        'success',
        'pending',
      ]);
      const { mission_id: day2Mission } = await missionOf(
        user.id,
        challenge.id,
        1,
      );
      expect(
        (
          await db.query('SELECT status FROM missions WHERE id = $1', [
            day2Mission,
          ])
        ).rows[0].status,
      ).toBe('in_progress');
      expect(rejected).toBeTruthy();

      // 날이 끝나면 작업이 failed로 확정
      await goToDay(challenge, 2);
      const settled = await scoring.settleDays();
      expect(settled.participations).toBeGreaterThanOrEqual(1);
      expect((await dayStatuses(user.id, challenge.id)).slice(0, 3)).toEqual([
        'success',
        'failed',
        'pending',
      ]);

      // 포인트·XP·스트릭 없음
      expect(
        (
          await db.query(
            'SELECT 1 FROM point_transactions WHERE user_id = $1',
            [user.id],
          )
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query('SELECT 1 FROM experience_awards WHERE user_id = $1', [
            user.id,
          ])
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query('SELECT 1 FROM streak_days WHERE user_id = $1', [
            user.id,
          ])
        ).rows,
      ).toHaveLength(0);
    });

    it('순위: 성공 일수 내림차순, 같으면 마지막 성공 제출이 빠른 순서, 내 순위와 상위 N명, 잠정 표시', async () => {
      const challenge = await publicChallenge();
      const [a, b, c] = [
        await createUser(),
        await createUser(),
        await createUser(),
      ];
      for (const user of [a, b, c]) await join(user, challenge);

      // 같은 날 b가 c보다 먼저 제출, a는 이틀 성공
      await performToday(b, challenge, 0, 'approved');
      await performToday(a, challenge, 0, 'approved');
      await performToday(c, challenge, 0, 'approved');
      await performToday(a, challenge, 1, 'approved');

      const list = await ranking(a, challenge);
      expect(list).toMatchObject({ provisional: true, total: 3 });
      expect(
        list.items.map((i) => [i.rank, i.successfulDays, i.score]),
      ).toEqual([
        [1, 2, 200],
        [2, 1, 100],
        [3, 1, 100],
      ]);
      expect(list.items[0].isMe).toBe(true);
      expect(list.me).toMatchObject({ rank: 1, score: 200, isMe: true });

      // b의 1일차 제출이 c보다 빨랐으므로 b가 2위
      const second = await ranking(b, challenge, { limit: 2 });
      expect(second.items).toHaveLength(2);
      expect(second.me.rank).toBe(2);
      const third = await ranking(c, challenge, { limit: 1 });
      expect(third.items).toHaveLength(1);
      expect(third.me.rank).toBe(3);

      const outsider = await createUser();
      expect((await ranking(outsider, challenge)).me).toBeNull();
      await http.get(`/api/v1/challenges/${challenge.id}/ranking`).expect(401);
      await http
        .get(`/api/v1/challenges/${randomUUID()}/ranking`)
        .set(auth(a.token))
        .expect(404);
      await http
        .get(`/api/v1/challenges/${challenge.id}/ranking`)
        .query({ limit: 0 })
        .set(auth(a.token))
        .expect(400);
    });

    it('확정 작업은 판정 대기 중인 날만 남은 참가를 고르지 않음(대기가 쌓여도 다른 참가가 밀리지 않음)', async () => {
      const waiting = await createUser();
      const idle = await createUser();
      const challenge = await publicChallenge();
      await join(waiting, challenge);
      await join(idle, challenge);
      await performToday(waiting, challenge, 0, 'review_required');
      await goToDay(challenge, 1);

      const participation = async (userId) =>
        (
          await db.query(
            'SELECT id FROM challenge_participations WHERE user_id = $1 AND challenge_id = $2',
            [userId, challenge.id],
          )
        ).rows[0].id;
      const due = await scoring.dueParticipationIds(100_000);
      expect(due).toContain(await participation(idle.id));
      expect(due).not.toContain(await participation(waiting.id));

      await scoring.settleDays({ limit: 100_000 });
      expect((await dayStatuses(idle.id, challenge.id))[0]).toBe('failed');
      expect((await dayStatuses(waiting.id, challenge.id))[0]).toBe('pending');
    });

    it('판정 대기 중인 제출이 있으면 날이 끝나도 pending, 나중에 승인되면 그날이 success로 소급', async () => {
      const user = await createUser();
      const challenge = await publicChallenge();
      await join(user, challenge);
      const held = await performToday(user, challenge, 0, 'review_required');
      await goToDay(challenge, 1);
      await scoring.settleDays();
      expect((await dayStatuses(user.id, challenge.id))[0]).toBe('pending');
      const rankings = await http
        .get(`/admin/v1/challenges/${challenge.id}/rankings`)
        .set(auth(adminToken))
        .expect(200);
      expect(rankings.body.entries[0]).toMatchObject({
        userId: user.id,
        successfulDays: 0,
      });

      await redecide(held, 'approved');
      expect((await dayStatuses(user.id, challenge.id))[0]).toBe('success');
    });

    it('승인이 번복되면 점수가 내려가고, 다시 승인하면 복구', async () => {
      const user = await createUser();
      const challenge = await publicChallenge();
      await join(user, challenge);
      const record = await performToday(user, challenge, 0, 'approved');
      await goToDay(challenge, 1);

      await redecide(record, 'rejected');
      expect((await dayStatuses(user.id, challenge.id))[0]).toBe('failed');
      expect((await ranking(user, challenge)).me.score).toBe(0);
      await redecide(record, 'approved');
      expect((await dayStatuses(user.id, challenge.id))[0]).toBe('success');
      expect((await ranking(user, challenge)).me.score).toBe(100);
    });

    it('운영 조치: 일자 제외·복구, 실격(순위 제외, 앞으로의 미션 취소), 사유·상태 검증', async () => {
      const user = await createUser();
      const other = await createUser();
      const challenge = await publicChallenge();
      await join(user, challenge);
      await join(other, challenge);
      await performToday(user, challenge, 0, 'approved');
      await performToday(other, challenge, 0, 'approved');
      const participation = (
        await db.query(
          'SELECT id FROM challenge_participations WHERE user_id = $1',
          [user.id],
        )
      ).rows[0].id;
      const { daily_id: dailyId } = await missionOf(user.id, challenge.id, 0);
      const base = `/admin/v1/challenges/${challenge.id}/participants/${participation}`;

      await adminPost(`${base}/days/${dailyId}/exclude`, {}).expect(400);
      const excluded = await adminPost(`${base}/days/${dailyId}/exclude`, {
        reason: '부정 의심',
      }).expect(200);
      expect(excluded.body.ranking.challengeId).toBe(challenge.id);
      expect((await ranking(user, challenge)).me.score).toBe(0);
      // 제외된 날은 판정이 다시 반영돼도 그대로
      await scoring.settleDays();
      expect((await dayStatuses(user.id, challenge.id))[0]).toBe('excluded');

      await adminPost(`${base}/days/${dailyId}/restore`, {
        reason: '오탐',
      }).expect(200);
      expect((await dayStatuses(user.id, challenge.id))[0]).toBe('success');
      expect(
        (
          await adminPost(`${base}/days/${dailyId}/restore`, {
            reason: '또',
          }).expect(409)
        ).body.error.code,
      ).toBe('ADMIN_STATE_CONFLICT');
      await adminPost(`${base}/days/${randomUUID()}/exclude`, {
        reason: 'x',
      }).expect(404);
      const actions = await db.query(
        'SELECT action FROM challenge_moderation_actions WHERE participation_id = $1 ORDER BY occurred_at',
        [participation],
      );
      expect(actions.rows.map((r) => r.action)).toEqual([
        'exclude_day',
        'restore_day',
      ]);

      await adminPost(`${base}/disqualify`, {}).expect(400);
      const dq = await adminPost(`${base}/disqualify`, {
        reason: '규정 위반',
      }).expect(200);
      expect(dq.body.ranking.challengeId).toBe(challenge.id);
      expect(
        (await ranking(other, challenge)).items.map((i) => i.isMe),
      ).toEqual([true]);
      expect((await ranking(user, challenge)).me).toBeNull();
      const days = await dayStatuses(user.id, challenge.id);
      expect(days[0]).toBe('success'); // 지난 기록은 유지
      expect(days.slice(1).every((s) => s === 'cancelled')).toBe(true);
      expect(
        (await adminPost(`${base}/disqualify`, { reason: '다시' }).expect(409))
          .body.error.code,
      ).toBe('CHALLENGE_NOT_JOINED');

      // 실격자는 순위에서 빠짐
      const list = await http
        .get(`/admin/v1/challenges/${challenge.id}/rankings`)
        .set(auth(adminToken))
        .expect(200);
      expect(list.body.entries.map((e) => e.userId)).toEqual([other.id]);
      const detail = await http
        .get(`${base}/days`)
        .set(auth(adminToken))
        .expect(200);
      expect(detail.body.items).toHaveLength(7);
      await http
        .get(`/admin/v1/challenges/${challenge.id}/rankings`)
        .set(auth(user.token))
        .expect(401);
    });

    it('챌린지 미션의 승인은 "승인 미션 누적" 업적에 세지 않음', async () => {
      const definitionId = randomUUID();
      const imageId = randomUUID();
      const tag = randomInt(100_000, 999_999);
      await db.query(
        `INSERT INTO achievement_definitions (id, code, status, created_by_admin_id)
       VALUES ($1,$2,'public',$3)`,
        [definitionId, `chn_${tag}`, adminId],
      );
      await db.query(
        `INSERT INTO achievement_badge_images
              (id, achievement_id, version_no, r2_object_key, mime_type, size_bytes, uploaded_at, created_by_admin_id)
       VALUES ($1,$2,1,$3,'image/png',10,now() - interval '1 day',$4)`,
        [imageId, definitionId, `badge/chn${tag}`, adminId],
      );
      await db.query(
        `INSERT INTO achievement_versions
              (id, achievement_id, version_no, title, description, rarity, condition_type,
               target_count, reward_points, badge_image_id, effective_at, created_by_admin_id)
       VALUES ($1,$2,1,'첫 승인','승인 미션 1회','common','approved_mission_count',
               1,0,$3, now() - interval '1 day', $4)`,
        [randomUUID(), definitionId, imageId, adminId],
      );
      try {
        const user = await createUser();
        const challenge = await publicChallenge();
        await join(user, challenge);
        await performToday(user, challenge, 0, 'approved');
        expect((await dayStatuses(user.id, challenge.id))[0]).toBe('success');
        const { rows } = await db.query(
          'SELECT 1 FROM user_achievements WHERE user_id = $1',
          [user.id],
        );
        expect(rows).toHaveLength(0);
      } finally {
        await db.query(
          `UPDATE achievement_definitions SET status = 'hidden' WHERE id = $1`,
          [definitionId],
        );
      }
    });
  },
);
