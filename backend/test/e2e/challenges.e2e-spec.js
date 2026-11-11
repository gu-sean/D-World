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

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)('챌린지 정의·공개 (PostgreSQL)', () => {
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
  const post = (path, body, key = randomUUID()) =>
    adminApi(http, adminToken).post(path, body, key);
  const patch = (path, body) => adminApi(http, adminToken).patch(path, body);

  const definition = (overrides = {}) => ({
    title: `공식 챌린지 ${RUN}`,
    description: '일주일 동안 매일 운동하기',
    categoryId,
    difficultyId,
    verificationMethod: 'camera',
    exerciseCode: 'push_up',
    startDate: addDays(today(), 3),
    endDate: addDays(today(), 9),
    reward: { points: 300, userXp: 30, petXp: 60 },
    ...overrides,
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

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());

    adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `ch_${RUN}`, `${adminId}@example.com`],
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
      [categoryId, `chc${RUN}`, `챌린지카테고리${RUN}`],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [difficultyId, `chd${RUN}`, `챌린지난이도${RUN}`],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('공식 챌린지를 초안으로 만들고(기본 완주 일수는 기간 전체) 보상 묶음과 함께 조회', async () => {
    const res = await post('/admin/v1/challenges', definition()).expect(201);
    expect(res.body).toMatchObject({
      origin: 'admin',
      publicationStatus: 'draft',
      requiredSuccessDays: 7,
      phase: 'recruiting',
      participantCount: 0,
      exerciseCode: 'push_up',
      reward: {
        points: 300,
        userXp: 30,
        petXp: 60,
        badgeAchievementVersionId: null,
      },
    });
    const detail = await http
      .get(`/admin/v1/challenges/${res.body.id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(detail.body).toEqual(res.body);

    const custom = await post(
      '/admin/v1/challenges',
      definition({ requiredSuccessDays: 5, maxParticipants: 100 }),
    ).expect(201);
    expect(custom.body).toMatchObject({
      requiredSuccessDays: 5,
      maxParticipants: 100,
    });
  });

  it('기간·완주 일수·운동 종류·참조 검증', async () => {
    const bad = async (overrides, status, code) => {
      const res = await post(
        '/admin/v1/challenges',
        definition(overrides),
      ).expect(status);
      if (code) expect(res.body.error.code).toBe(code);
    };
    await bad({ endDate: addDays(today(), 10) }, 400, 'GOAL_INVALID_PERIOD'); // 8일
    await bad({ requiredSuccessDays: 8 }, 422, 'INVALID_REQUIRED_DAYS');
    await bad(
      { verificationMethod: 'sensor' },
      422,
      'VERIFY_EVIDENCE_KIND_MISMATCH',
    ); // 푸시업은 카메라
    await bad(
      { exerciseCode: 'running' },
      422,
      'VERIFY_EVIDENCE_KIND_MISMATCH',
    );
    await bad({ categoryId: randomUUID() }, 404, 'CATALOG_NOT_FOUND');
    await bad({ title: '  ' }, 400);
    await bad({ startDate: '2026-02-30' }, 400);
    await bad({ reward: { points: -1, userXp: 0, petXp: 0 } }, 400);
    await bad(
      {
        reward: {
          points: 1,
          userXp: 0,
          petXp: 0,
          badgeAchievementVersionId: randomUUID(),
        },
      },
      422,
      'INVALID_BADGE',
    );

    await http.post('/admin/v1/challenges').send(definition()).expect(401);
    const user = await createUser();
    await http
      .post('/admin/v1/challenges')
      .set(auth(user.token))
      .set('Idempotency-Key', randomUUID())
      .send(definition())
      .expect(401);
    await post('/admin/v1/challenges', definition(), null).expect(400);
  });

  it('공개 전에는 사용자에게 보이지 않고, 공개하면 목록·상세에 나타나며 시작일이 오늘 이전이면 공개 불가', async () => {
    const user = await createUser();
    const created = (
      await post(
        '/admin/v1/challenges',
        definition({ title: `공개 테스트 ${RUN}` }),
      ).expect(201)
    ).body;
    await http
      .get(`/api/v1/challenges/${created.id}`)
      .set(auth(user.token))
      .expect(404);

    const published = await post(
      `/admin/v1/challenges/${created.id}/publish`,
      {},
    ).expect(200);
    expect(published.body).toMatchObject({ publicationStatus: 'public' });
    expect(published.body.publishedAt).toBeTruthy();

    const detail = await http
      .get(`/api/v1/challenges/${created.id}`)
      .set(auth(user.token))
      .expect(200);
    expect(detail.body).toMatchObject({
      id: created.id,
      myParticipation: null,
      phase: 'recruiting',
    });
    const list = await http
      .get('/api/v1/challenges')
      .query({ phase: 'recruiting', categoryId, limit: 50 })
      .set(auth(user.token))
      .expect(200);
    expect(list.body.items.some((i) => i.id === created.id)).toBe(true);
    const ongoing = await http
      .get('/api/v1/challenges')
      .query({ phase: 'ongoing', categoryId })
      .set(auth(user.token))
      .expect(200);
    expect(ongoing.body.items.some((i) => i.id === created.id)).toBe(false);

    // 이미 공개한 챌린지, 시작일이 오늘인 초안
    expect(
      (await post(`/admin/v1/challenges/${created.id}/publish`, {}).expect(409))
        .body.error.code,
    ).toBe('CHALLENGE_NOT_DRAFT');
    const late = (
      await post(
        '/admin/v1/challenges',
        definition({ startDate: today(), endDate: addDays(today(), 6) }),
      ).expect(201)
    ).body;
    expect(
      (await post(`/admin/v1/challenges/${late.id}/publish`, {}).expect(422))
        .body.error.code,
    ).toBe('START_DATE_NOT_FUTURE');
    await post(`/admin/v1/challenges/${randomUUID()}/publish`, {}).expect(404);
  });

  it('목록은 커서로 이어서 조회하고 잘못된 필터는 400', async () => {
    const user = await createUser();
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const c = (
        await post(
          '/admin/v1/challenges',
          definition({ title: `페이지 ${i} ${RUN}` }),
        ).expect(201)
      ).body;
      await post(`/admin/v1/challenges/${c.id}/publish`, {}).expect(200);
      ids.push(c.id);
    }
    const seen = [];
    let cursor;
    for (let page = 0; page < 100; page++) {
      const res = await http
        .get('/api/v1/challenges')
        .query({ categoryId, limit: 2, ...(cursor ? { cursor } : {}) })
        .set(auth(user.token))
        .expect(200);
      expect(res.body.items.length).toBeLessThanOrEqual(2);
      seen.push(...res.body.items.map((i) => i.id));
      cursor = res.body.nextCursor;
      if (!cursor) break;
    }
    for (const id of ids) expect(seen).toContain(id);
    expect(new Set(seen).size).toBe(seen.length);

    await http
      .get('/api/v1/challenges')
      .query({ phase: 'later' })
      .set(auth(user.token))
      .expect(400);
    await http
      .get('/api/v1/challenges')
      .query({ limit: 0 })
      .set(auth(user.token))
      .expect(400);
    await http
      .get('/api/v1/challenges')
      .query({ cursor: 'garbage' })
      .set(auth(user.token))
      .expect(400);
    await http.get('/api/v1/challenges').expect(401);
  });

  it('수정은 초안·공개 상태에서 가능하고, 숨김은 사유가 필요하며 숨기면 목록에서 사라짐', async () => {
    const user = await createUser();
    const created = (
      await post(
        '/admin/v1/challenges',
        definition({ title: `수정 ${RUN}` }),
      ).expect(201)
    ).body;

    const edited = await patch(`/admin/v1/challenges/${created.id}`, {
      title: `수정됨 ${RUN}`,
      endDate: addDays(today(), 16), // 14일
      reward: { points: 500, userXp: 50, petXp: 100 },
    }).expect(200);
    expect(edited.body).toMatchObject({
      title: `수정됨 ${RUN}`,
      endDate: addDays(today(), 16),
      requiredSuccessDays: 7,
      reward: { points: 500 },
    });
    await patch(`/admin/v1/challenges/${created.id}`, {}).expect(400);
    await patch(`/admin/v1/challenges/${created.id}`, {
      endDate: addDays(today(), 11),
    }).expect(400);
    await patch(`/admin/v1/challenges/${randomUUID()}`, { title: 'x' }).expect(
      404,
    );

    await post(`/admin/v1/challenges/${created.id}/publish`, {}).expect(200);
    await post(`/admin/v1/challenges/${created.id}/hide`, {}).expect(400);
    const hidden = await post(`/admin/v1/challenges/${created.id}/hide`, {
      reason: '부적절한 내용',
    }).expect(200);
    expect(hidden.body.publicationStatus).toBe('hidden');
    await http
      .get(`/api/v1/challenges/${created.id}`)
      .set(auth(user.token))
      .expect(404);
    expect(
      (
        await patch(`/admin/v1/challenges/${created.id}`, {
          title: 'again',
        }).expect(409)
      ).body.error.code,
    ).toBe('CHALLENGE_NOT_EDITABLE');
    expect(
      (
        await post(`/admin/v1/challenges/${created.id}/hide`, {
          reason: '다시',
        }).expect(409)
      ).body.error.code,
    ).toBe('CHALLENGE_NOT_PUBLIC');

    const events = await db.query(
      'SELECT event_type, reason FROM challenge_rule_events WHERE challenge_id = $1 ORDER BY occurred_at',
      [created.id],
    );
    expect(events.rows.map((r) => r.event_type)).toEqual([
      'published',
      'hidden',
    ]);
    const filtered = await http
      .get('/admin/v1/challenges')
      .query({ publicationStatus: 'hidden', size: 100 })
      .set(auth(adminToken))
      .expect(200);
    expect(filtered.body.items.some((i) => i.id === created.id)).toBe(true);
  });

  it('같은 Idempotency-Key로 다시 보내면 챌린지를 하나만 만든다', async () => {
    const key = randomUUID();
    const body = definition({ title: `멱등 ${RUN}` });
    const first = await post('/admin/v1/challenges', body, key).expect(201);
    const replay = await post('/admin/v1/challenges', body, key).expect(201);
    expect(replay.body).toEqual(first.body);
    const { rows } = await db.query(
      'SELECT 1 FROM challenges WHERE title = $1',
      [body.title],
    );
    expect(rows).toHaveLength(1);
  });
});
