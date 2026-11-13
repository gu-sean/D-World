import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { addDays, kstDate } from '../../src/common/time/kst.js';
import { adminApi } from '../support/admin-api.js';
import { createTestApp } from '../support/app.js';
import { createUser as createUserWith } from '../support/users.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)(
  '모바일 챌린지 API A100~A107 (PostgreSQL)',
  () => {
    let app;
    let db;
    let http;
    let adminToken;
    let category;
    let difficulty;

    const auth = (user) => ({ Authorization: `Bearer ${user.token}` });
    const day = (offset) => addDays(kstDate(), offset);
    const adminPost = (path, body) =>
      adminApi(http, adminToken).post(path, body);

    beforeAll(async () => {
      ({ app, http, db } = await createTestApp());
      const adminId = newId();
      await db.query(
        `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
        [adminId, `mc_${RUN}`, `${adminId.toLowerCase()}@example.com`],
      );
      const session = await db.withTransaction((t) =>
        app.get(SessionsService).create(t, 'admin', adminId),
      );
      adminToken = await app
        .get(AccessTokenService)
        .issue('admin', adminId, session.sessionId);
      category = { id: newId(), code: `mcc${RUN}` };
      difficulty = { id: newId(), code: `mcd${RUN}` };
      await db.query(
        `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [category.id, category.code, `모바일챌린지${RUN}`],
      );
      await db.query(
        `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [difficulty.id, difficulty.code, `모바일챌린지난이도${RUN}`],
      );
    });

    afterAll(() => app.close());

    /** 공개된 7일 공식 챌린지 (시작일은 모레) */
    async function publicChallenge(overrides = {}) {
      const startDate = overrides.startDate ?? day(2);
      const created = await adminPost('/admin/v1/challenges', {
        title: `모바일 챌린지 ${RUN}`,
        description: '설명',
        categoryId: category.id,
        difficultyId: difficulty.id,
        verificationMethod: 'camera',
        exerciseCode: 'squat',
        startDate,
        endDate: addDays(startDate, 6),
        requiredSuccessDays: 5,
        reward: { points: 300, userXp: 30, petXp: 60 },
        ...overrides,
      }).expect(201);
      await adminPost(
        `/admin/v1/challenges/${created.body.id}/publish`,
        {},
      ).expect(200);
      return created.body;
    }

    it('A100·A101 목록과 상세에 모바일 키가 있음', async () => {
      const user = await createUserWith(app, db);
      const challenge = await publicChallenge();

      const detail = await http
        .get(`/api/v1/challenges/${challenge.id}`)
        .set(auth(user))
        .expect(200);
      expect(detail.body).toEqual(
        expect.objectContaining({
          id: challenge.id,
          categoryCode: category.code,
          difficultyCode: difficulty.code,
          exerciseCode: 'squat',
          periodDays: 7,
          capacity: null,
          completionRateRequired: Number((5 / 7).toFixed(4)),
          rewardPoints: 300,
          phase: 'recruiting',
          joined: false,
        }),
      );

      const list = await http
        .get(
          `/api/v1/challenges?phase=recruiting&categoryCode=${category.code}`,
        )
        .set(auth(user))
        .expect(200);
      expect(list.body.items.map((c) => c.id)).toContain(challenge.id);
    });

    it('A102 참여 → A104 내 챌린지 → A103 포기', async () => {
      const user = await createUserWith(app, db);
      const challenge = await publicChallenge();

      const joined = await http
        .post(`/api/v1/challenges/${challenge.id}/participations`)
        .set(auth(user))
        .expect(201);
      expect(joined.body).toEqual(
        expect.objectContaining({
          participationId: expect.any(String),
          status: 'enrolled',
          successDays: 0,
          requiredDays: 5,
          todayStatus: null,
          withdrawnAt: null,
        }),
      );
      expect(joined.body.challenge).toMatchObject({
        id: challenge.id,
        joined: true,
      });

      await http
        .post(`/api/v1/challenges/${challenge.id}/participations`)
        .set(auth(user))
        .expect(409)
        .expect((res) =>
          expect(res.body.error.code).toBe('CHALLENGE_ALREADY_JOINED'),
        );

      const mine = await http
        .get('/api/v1/me/challenges?status=enrolled')
        .set(auth(user))
        .expect(200);
      expect(Array.isArray(mine.body)).toBe(true);
      expect(mine.body).toHaveLength(1);
      expect(mine.body[0].challenge.id).toBe(challenge.id);
      await http
        .get('/api/v1/me/challenges?status=bogus')
        .set(auth(user))
        .expect(400);

      await http
        .delete(`/api/v1/challenges/${challenge.id}/participations/me`)
        .set(auth(user))
        .set('Idempotency-Key', newId())
        .expect(204);
      await http
        .delete(`/api/v1/challenges/${challenge.id}/participations/me`)
        .set(auth(user))
        .set('Idempotency-Key', newId())
        .expect(409)
        .expect((res) =>
          expect(res.body.error.code).toBe('CHALLENGE_NOT_JOINED'),
        );
      const after = await http
        .get('/api/v1/me/challenges?status=withdrawn')
        .set(auth(user))
        .expect(200);
      expect(after.body[0].status).toBe('withdrawn');
    });

    it('A105 순위와 A107 결과(정산 전)', async () => {
      const user = await createUserWith(app, db);
      const challenge = await publicChallenge();
      await http
        .post(`/api/v1/challenges/${challenge.id}/participations`)
        .set(auth(user))
        .expect(201);

      const ranking = await http
        .get(`/api/v1/challenges/${challenge.id}/rankings`)
        .set(auth(user))
        .expect(200);
      expect(Object.keys(ranking.body).sort()).toEqual([
        'calculatedAt',
        'challengeId',
        'entries',
        'isFinal',
        'myRank',
      ]);
      expect(ranking.body).toMatchObject({
        challengeId: challenge.id,
        isFinal: false,
      });

      const result = await http
        .get(`/api/v1/me/challenges/${challenge.id}/result`)
        .set(auth(user))
        .expect(200);
      expect(result.body).toEqual(
        expect.objectContaining({
          status: 'enrolled',
          rankNo: null,
          successfulDays: 0,
          requiredDays: 5,
          rewardPoints: 0,
          settledAt: null,
        }),
      );

      const stranger = await createUserWith(app, db);
      await http
        .get(`/api/v1/me/challenges/${challenge.id}/result`)
        .set(auth(stranger))
        .expect(409)
        .expect((res) =>
          expect(res.body.error.code).toBe('CHALLENGE_NOT_JOINED'),
        );
    });

    it('A106 모바일 입력(periodDays·capacity·completionRateRequired)으로 만들기', async () => {
      const user = await createUserWith(app, db);
      const res = await http
        .post('/api/v1/challenges')
        .set(auth(user))
        .send({
          title: `내 챌린지 ${RUN}`,
          description: '같이 해요',
          categoryCode: category.code,
          difficultyCode: difficulty.code,
          exerciseCode: 'squat',
          targetValue: 20,
          targetUnit: 'reps',
          startDate: day(3),
          periodDays: 7,
          capacity: 30,
          completionRateRequired: 0.8,
        })
        .expect(201);
      expect(res.body).toEqual(
        expect.objectContaining({
          origin: 'user',
          periodDays: 7,
          capacity: 30,
          requiredSuccessDays: 6,
          exerciseCode: 'squat',
          verificationMethod: 'camera',
          endDate: day(9),
        }),
      );
    });
  },
);
