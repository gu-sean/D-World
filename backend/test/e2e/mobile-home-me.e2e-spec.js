import { randomInt, randomUUID } from 'node:crypto';
import { addDays, kstDate } from '../../src/common/time/kst.js';
import { createTestApp } from '../support/app.js';
import { createUser as createUserWith } from '../support/users.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

const HOME_KEYS = [
  'activeChallenge',
  'date',
  'message',
  'missions',
  'recommendation',
  'summary',
  'week',
];
const ME_KEYS = [
  'availablePoints',
  'id',
  'levelNo',
  'nextLevelXp',
  'nickname',
  'notificationEnabled',
  'pendingConsents',
  'phoneLinked',
  'providers',
  'representativeBadge',
  'representativePet',
  'restriction',
  'streakDays',
  'totalXp',
];

describe.skipIf(!databaseUrl)(
  '모바일 홈·내 정보·보상 조회 (PostgreSQL)',
  () => {
    let app;
    let db;
    let http;
    let ref;

    const auth = (user) => ({ Authorization: `Bearer ${user.token}` });
    const day = (offset) => addDays(kstDate(), offset);

    beforeAll(async () => {
      ({ app, http, db } = await createTestApp());
      const adminId = randomUUID();
      await db.query(
        `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
        [adminId, `mh_${RUN}`, `${adminId}@example.com`],
      );
      const category = randomUUID();
      const difficulty = randomUUID();
      await db.query(
        `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [category, `mhc${RUN}`, `홈카테고리${RUN}`],
      );
      await db.query(
        `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [difficulty, `mhd${RUN}`, `홈난이도${RUN}`],
      );
      await db.query(
        `INSERT INTO mission_reward_rate_versions
              (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,$3,1,100,10,5, now() - interval '1 day', $4)`,
        [randomUUID(), category, difficulty, adminId],
      );
      ref = {
        categoryCode: `mhc${RUN}`,
        difficultyCode: `mhd${RUN}`,
        category,
        difficulty,
        adminId,
      };
    });

    afterAll(() => app.close());

    async function todayMission(user, overrides = {}) {
      const res = await http
        .post('/api/v1/missions')
        .set(auth(user))
        .send({
          title: '스쿼트 20개',
          categoryCode: ref.categoryCode,
          difficultyCode: ref.difficultyCode,
          exerciseCode: 'squat',
          verificationMethod: 'camera',
          targetValue: 20,
          targetUnit: 'reps',
          scheduledDate: kstDate(),
          ...overrides,
        })
        .expect(201);
      return res.body;
    }

    it('A29 홈: 빈 사용자도 모든 키가 있고 주 7일이 월~일 순서', async () => {
      const user = await createUserWith(app, db);
      const res = await http.get('/api/v1/home').set(auth(user)).expect(200);
      expect(Object.keys(res.body).sort()).toEqual(HOME_KEYS);
      expect(res.body.date).toBe(kstDate());
      expect(res.body.message).toEqual(expect.any(String));
      expect(res.body.week).toHaveLength(7);
      expect(res.body.week.filter((d) => d.isToday)).toHaveLength(1);
      expect(res.body.summary).toEqual({
        completedCount: 0,
        totalCount: 0,
        progressRate: 0,
        streakDays: 0,
      });
      expect(res.body.missions).toEqual([]);
      expect(res.body.recommendation).toBeNull();
      expect(res.body.activeChallenge).toBeNull();
      await http
        .get('/api/v1/home?date=2026-13-40')
        .set(auth(user))
        .expect(400);
    });

    it('A29 홈: 그날 미션과 주간 집계', async () => {
      const user = await createUserWith(app, db);
      const mission = await todayMission(user);
      await todayMission(user, { scheduledDate: day(1), title: '내일 미션' });

      const res = await http.get('/api/v1/home').set(auth(user)).expect(200);
      expect(res.body.missions).toHaveLength(1);
      expect(res.body.missions[0]).toEqual(
        expect.objectContaining({
          id: mission.id,
          categoryCode: ref.categoryCode,
          difficultyCode: ref.difficultyCode,
          exerciseCode: 'squat',
          challengeId: null,
          rewardPreview: { points: 100, userXp: 10, petXp: 5 },
        }),
      );
      expect(res.body.summary).toMatchObject({
        totalCount: 1,
        completedCount: 0,
      });
      const today = res.body.week.find((d) => d.isToday);
      expect(today).toMatchObject({ totalCount: 1, completedCount: 0 });

      const other = await http
        .get(`/api/v1/home?date=${day(1)}`)
        .set(auth(user))
        .expect(200);
      expect(other.body.missions.map((m) => m.title)).toEqual(['내일 미션']);
      expect(other.body.week.filter((d) => d.isToday)).toHaveLength(
        other.body.week.some((d) => d.date === kstDate()) ? 1 : 0,
      );
    });

    it('A29 홈: 조건에 맞는 추천 문구를 우선순위대로 고름', async () => {
      const user = await createUserWith(app, db);
      await db.query(
        `INSERT INTO recommendation_messages
              (id, message, condition_type, priority, created_by_admin_id, updated_by_admin_id)
       VALUES ($1, $2, 'no_mission_today', 100, $3, $3)`,
        [randomUUID(), `오늘은 쉬는 날 ${RUN}`, ref.adminId],
      );
      const res = await http.get('/api/v1/home').set(auth(user)).expect(200);
      expect(res.body.message).toBe(`오늘은 쉬는 날 ${RUN}`);
      await todayMission(user);
      const busy = await http.get('/api/v1/home').set(auth(user)).expect(200);
      expect(busy.body.message).not.toBe(`오늘은 쉬는 날 ${RUN}`);
      await db.query(
        `UPDATE recommendation_messages SET is_active = false WHERE message = $1`,
        [`오늘은 쉬는 날 ${RUN}`],
      );
    });

    it('A29 홈: 살아 있는 상황 추천을 한 건 실음', async () => {
      const user = await createUserWith(app, db);
      const empty = await http.get('/api/v1/home').set(auth(user)).expect(200);
      expect(empty.body.recommendation).toBeNull();

      await db.query(
        `INSERT INTO mission_definitions
              (id, origin, title, category_id, difficulty_id, verification_method,
               publication_status, exercise_code, base_points, base_user_xp, base_pet_xp)
       SELECT $1,'admin',$2,c.id,d.id,'camera','public','squat',50,5,2
         FROM goal_categories c, difficulty_levels d
        WHERE c.code = $3 AND d.code = $4`,
        [randomUUID(), `홈추천 ${RUN}`, ref.categoryCode, ref.difficultyCode],
      );
      await http
        .post('/api/v1/recommendations/situational')
        .set(auth(user))
        .send({ kind: 'moving', isMoving: true })
        .expect(201);
      const home = await http.get('/api/v1/home').set(auth(user)).expect(200);
      expect(home.body.recommendation).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          rankNo: 1,
          status: 'shown',
          missionDefinition: expect.objectContaining({
            id: expect.any(String),
          }),
        }),
      );
    });

    it('A31 미션 생성: Idempotency-Key가 있으면 재시도가 같은 미션을 돌려줌', async () => {
      const user = await createUserWith(app, db);
      const key = randomUUID();
      const send = () =>
        http
          .post('/api/v1/missions')
          .set(auth(user))
          .set('Idempotency-Key', key)
          .send({
            title: '멱등 미션',
            categoryCode: ref.categoryCode,
            difficultyCode: ref.difficultyCode,
            verificationMethod: 'camera',
            scheduledDate: kstDate(),
          });
      const first = await send().expect(201);
      const again = await send().expect(201);
      expect(again.body.id).toBe(first.body.id);
      const list = await http
        .get(`/api/v1/missions?date=${kstDate()}`)
        .set(auth(user))
        .expect(200);
      expect(list.body.items).toHaveLength(1);
      // 같은 키로 다른 본문은 거절
      await http
        .post('/api/v1/missions')
        .set(auth(user))
        .set('Idempotency-Key', key)
        .send({
          title: '다른 미션',
          categoryCode: ref.categoryCode,
          difficultyCode: ref.difficultyCode,
          verificationMethod: 'camera',
          scheduledDate: kstDate(),
        })
        .expect(409);
    });

    it('A11 내 정보: 모바일 키와 기본값', async () => {
      const user = await createUserWith(app, db);
      const res = await http.get('/api/v1/me').set(auth(user)).expect(200);
      expect(res.body).toEqual(expect.objectContaining({ id: user.id }));
      for (const key of ME_KEYS) expect(res.body).toHaveProperty(key);
      expect(res.body).toMatchObject({
        phoneLinked: false,
        providers: [],
        levelNo: 1,
        totalXp: 0,
        availablePoints: 0,
        streakDays: 0,
        representativePet: null,
        representativeBadge: null,
        pendingConsents: [],
      });

      const patched = await http
        .patch('/api/v1/me/profile')
        .set(auth(user))
        .send({ notificationEnabled: true })
        .expect(200);
      expect(patched.body.notificationEnabled).toBe(true);
    });

    it('A14·A15·A16 탈퇴 신청, 푸시 등록과 해제', async () => {
      const user = await createUserWith(app, db);
      const token = `push-token-${RUN}-${user.id}`;
      await http
        .put('/api/v1/me/push-devices')
        .set(auth(user))
        .send({ platform: 'android', token })
        .expect(200);
      await http
        .post('/api/v1/me/push-devices/unregister')
        .set(auth(user))
        .send({ token })
        .expect(204);
      // 없는 토큰도 성공
      await http
        .post('/api/v1/me/push-devices/unregister')
        .set(auth(user))
        .send({ token: 'unknown-token' })
        .expect(204);
      const device = await db.query(
        'SELECT is_active FROM push_devices WHERE token = $1',
        [token],
      );
      expect(device.rows[0].is_active).toBe(false);

      const res = await http
        .post('/api/v1/me/withdrawal-requests')
        .set(auth(user))
        .send({ reason: '그만 쓸게요' })
        .expect(202);
      expect(Object.keys(res.body).sort()).toEqual(['requestId', 'status']);
    });

    it('A110 알림함은 X-Unread-Count 헤더를 줌', async () => {
      const user = await createUserWith(app, db);
      await db.query(
        `INSERT INTO user_notifications (id, user_id, kind, event_key, title, body)
       VALUES ($1, $2, 'system', $3, '제목', '본문')`,
        [randomUUID(), user.id, `mobile-home-me:${randomUUID()}`],
      );
      const res = await http
        .get('/api/v1/me/notifications')
        .set(auth(user))
        .expect(200);
      expect(res.headers['x-unread-count']).toBe('1');
      expect(res.body.items).toHaveLength(1);
    });

    it('A70·A72~A76 상점·인벤토리·포인트·스트릭·업적 조회', async () => {
      const user = await createUserWith(app, db);

      const items = await http
        .get('/api/v1/shop/items')
        .set(auth(user))
        .expect(200);
      expect(Array.isArray(items.body)).toBe(true);

      const inventory = await http
        .get('/api/v1/me/inventory')
        .set(auth(user))
        .expect(200);
      expect(inventory.body).toEqual([]);

      const points = await http
        .get('/api/v1/me/points')
        .set(auth(user))
        .expect(200);
      expect(points.body).toMatchObject({
        availablePoints: 0,
        outstandingPoints: 0,
        pendingPoints: 0,
        monthlyEarnedPoints: 0,
        monthlyLimitPoints: expect.any(Number),
      });

      const transactions = await http
        .get('/api/v1/me/point-transactions?direction=earn')
        .set(auth(user))
        .expect(200);
      expect(transactions.body).toEqual({ items: [], nextCursor: null });
      await http
        .get('/api/v1/me/point-transactions?direction=sideways')
        .set(auth(user))
        .expect(400);

      const streak = await http
        .get('/api/v1/me/streak')
        .set(auth(user))
        .expect(200);
      expect(streak.body).toMatchObject({
        currentSuccessDays: 0,
        bestSuccessDays: 0,
        todayStatus: 'pending',
      });
      expect(streak.body.recentDays).toHaveLength(7);
      expect(streak.body.recentDays.at(-1)).toEqual({
        date: kstDate(),
        status: 'pending',
      });
      expect(streak.body.nextMilestone).toMatchObject({ targetSuccessDays: 7 });

      const achievements = await http
        .get('/api/v1/achievements')
        .set(auth(user))
        .expect(200);
      expect(Array.isArray(achievements.body)).toBe(true);
      await http
        .get('/api/v1/achievements?rarity=mythic')
        .set(auth(user))
        .expect(400);
    });

    it('A74 포인트 내역은 제목과 증감을 보여 줌', async () => {
      const user = await createUserWith(app, db);
      const mission = await todayMission(user);
      await db.query(
        `INSERT INTO point_wallets (user_id, available_points) VALUES ($1, 50)
       ON CONFLICT (user_id) DO UPDATE SET available_points = 50`,
        [user.id],
      );
      // 원장 트리거를 우회해 거래 한 건을 직접 넣는다(같은 트랜잭션 안에서만)
      await db.withTransaction(async (tx) => {
        await tx.query('SET LOCAL session_replication_role = replica');
        await tx.query(
          `INSERT INTO point_transactions
                (id, user_id, kind, available_delta, balance_after, outstanding_after,
                 source_type, source_id, idempotency_key)
         VALUES ($1,$2,'auto_award',50,50,0,'mission',$3,$4)`,
          [randomUUID(), user.id, mission.id, `mobile-home-me-${randomUUID()}`],
        );
      });

      const res = await http
        .get('/api/v1/me/point-transactions')
        .set(auth(user))
        .expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toEqual(
        expect.objectContaining({
          kind: 'auto_award',
          sourceType: 'mission',
          sourceId: mission.id,
          title: '스쿼트 20개 인증 성공',
          availableDelta: 50,
          balanceAfter: 50,
        }),
      );
      const spend = await http
        .get('/api/v1/me/point-transactions?direction=spend')
        .set(auth(user))
        .expect(200);
      expect(spend.body.items).toEqual([]);
    });

    it('A81·A82·A85 펫 종류와 진화 기록: 없는 대상은 404', async () => {
      const user = await createUserWith(app, db);
      const species = await http
        .get('/api/v1/pet-species')
        .set(auth(user))
        .expect(200);
      expect(Array.isArray(species.body)).toBe(true);
      await http
        .get(`/api/v1/pet-species/${randomUUID()}`)
        .set(auth(user))
        .expect(404);
      await http
        .get(`/api/v1/me/pets/${randomUUID()}/evolution-events`)
        .set(auth(user))
        .expect(404);
      await http
        .put('/api/v1/me/representative-pet')
        .set(auth(user))
        .send({ petId: randomUUID() })
        .expect(404);
      const pets = await http
        .get('/api/v1/me/pets')
        .set(auth(user))
        .expect(200);
      expect(pets.body).toEqual([]);
    });
  },
);
