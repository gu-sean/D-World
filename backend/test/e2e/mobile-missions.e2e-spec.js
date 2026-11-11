import { randomInt, randomUUID } from 'node:crypto';
import { addDays, kstDate } from '../../src/common/time/kst.js';
import { createTestApp } from '../support/app.js';
import { createUser as createUserWith } from '../support/users.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)('모바일 미션 API A30~A36 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let adminId;
  let ref;

  const auth = (user) => ({ Authorization: `Bearer ${user.token}` });
  const day = (offset) => addDays(kstDate(), offset);

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `mm_${RUN}`, `${adminId}@example.com`],
    );
    const category = randomUUID();
    const difficulty = randomUUID();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [category, `mmc${RUN}`, `모바일미션${RUN}`],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [difficulty, `mmd${RUN}`, `모바일난이도${RUN}`],
    );
    await db.query(
      `INSERT INTO mission_reward_rate_versions
              (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,$3,1,100,10,5, now() - interval '1 day', $4)`,
      [randomUUID(), category, difficulty, adminId],
    );
    ref = { categoryCode: `mmc${RUN}`, difficultyCode: `mmd${RUN}` };
  });

  afterAll(() => app.close());

  const input = (overrides = {}) => ({
    title: '스쿼트 20개',
    categoryCode: ref.categoryCode,
    difficultyCode: ref.difficultyCode,
    exerciseCode: 'squat',
    verificationMethod: 'camera',
    targetValue: 20,
    targetUnit: 'reps',
    scheduledDate: day(1),
    ...overrides,
  });

  it('A31 한 날짜로 만들면 Mission 하나를 돌려줌', async () => {
    const user = await createUserWith(app, db);
    const res = await http
      .post('/api/v1/missions')
      .set(auth(user))
      .send(input())
      .expect(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        sourceType: 'user',
        categoryCode: ref.categoryCode,
        difficultyCode: ref.difficultyCode,
        exerciseCode: 'squat',
        goalStepId: null,
        challengeId: null,
        scheduledDate: day(1),
        status: 'scheduled',
        rewardPreview: { points: 100, userXp: 10, petXp: 5 },
      }),
    );
  });

  it('A30 목록은 Page, status는 쉼표로 여러 값', async () => {
    const user = await createUserWith(app, db);
    for (const date of [day(1), day(2)]) {
      await http
        .post('/api/v1/missions')
        .set(auth(user))
        .send(input({ scheduledDate: date }))
        .expect(201);
    }
    const list = await http
      .get(
        `/api/v1/missions?from=${day(1)}&to=${day(2)}&status=scheduled,in_progress`,
      )
      .set(auth(user))
      .expect(200);
    expect(list.body.items).toHaveLength(2);
    expect(list.body).toHaveProperty('nextCursor', null);

    await http.get('/api/v1/missions?status=bogus').set(auth(user)).expect(400);
    const byCategory = await http
      .get(`/api/v1/missions?categoryCode=${ref.categoryCode}`)
      .set(auth(user))
      .expect(200);
    expect(byCategory.body.items).toHaveLength(2);
  });

  it('A32 상세, A33 수정, A34 취소', async () => {
    const user = await createUserWith(app, db);
    const made = await http
      .post('/api/v1/missions')
      .set(auth(user))
      .send(input())
      .expect(201);

    const detail = await http
      .get(`/api/v1/missions/${made.body.id}`)
      .set(auth(user))
      .expect(200);
    expect(detail.body).toEqual(
      expect.objectContaining({
        latestRecord: null,
        submissionCount: 0,
        remainingSubmissions: 4,
        canStart: true,
        canEdit: true,
        guide: expect.any(String),
      }),
    );

    const patched = await http
      .patch(`/api/v1/missions/${made.body.id}`)
      .set(auth(user))
      .send({ title: '스쿼트 30개', targetValue: 30 })
      .expect(200);
    expect(patched.body.title).toBe('스쿼트 30개');
    expect(patched.body).toHaveProperty('canEdit', true);

    const cancelled = await http
      .post(`/api/v1/missions/${made.body.id}/cancel`)
      .set(auth(user))
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
  });

  it('A33·A34 수정·취소: Idempotency-Key가 있으면 재전송이 같은 응답, 같은 키에 다른 본문은 409', async () => {
    const user = await createUserWith(app, db);
    const made = await http
      .post('/api/v1/missions')
      .set(auth(user))
      .send(input())
      .expect(201);
    const url = `/api/v1/missions/${made.body.id}`;

    const patchKey = randomUUID();
    const patch = (body) =>
      http
        .patch(url)
        .set(auth(user))
        .set('Idempotency-Key', patchKey)
        .send(body);
    const first = await patch({ title: '재전송 수정' }).expect(200);
    // 다른 값으로 바뀐 뒤에도 같은 키·본문은 처음 응답을 돌려줌
    await http
      .patch(url)
      .set(auth(user))
      .send({ title: '중간에 바뀜' })
      .expect(200);
    const replay = await patch({ title: '재전송 수정' }).expect(200);
    expect(replay.body).toEqual(first.body);
    await patch({ title: '다른 본문' }).expect(409);

    const cancelKey = randomUUID();
    const cancel = () =>
      http
        .post(`${url}/cancel`)
        .set(auth(user))
        .set('Idempotency-Key', cancelKey);
    const cancelled = await cancel().expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    // 이미 취소된 미션이어도 같은 키의 재전송은 성공 응답을 그대로 돌려줌
    const again = await cancel().expect(200);
    expect(again.body).toEqual(cancelled.body);
  });

  it('A35 틀 목록과 A36 추천', async () => {
    const user = await createUserWith(app, db);
    const definitionId = randomUUID();
    await db.query(
      `INSERT INTO mission_definitions
              (id, origin, title, category_id, difficulty_id, estimated_duration_seconds,
               target_value, target_unit, verification_method, publication_status,
               exercise_code, base_points, base_user_xp, base_pet_xp)
       SELECT $1,'admin',$2,c.id,d.id,300,15,'reps','camera','public','plank',70,7,3
         FROM goal_categories c, difficulty_levels d
        WHERE c.code = $3 AND d.code = $4`,
      [definitionId, `틀${RUN}`, ref.categoryCode, ref.difficultyCode],
    );

    const list = await http
      .get(
        `/api/v1/mission-definitions?categoryCode=${ref.categoryCode}&exerciseCode=plank&sort=duration`,
      )
      .set(auth(user))
      .expect(200);
    expect(list.body.items[0]).toEqual(
      expect.objectContaining({
        id: definitionId,
        origin: 'admin',
        exerciseCode: 'plank',
        rewardPreview: { points: 70, userXp: 7, petXp: 3 },
      }),
    );

    const next = await http
      .get('/api/v1/recommendations/next-missions?source=all')
      .set(auth(user))
      .expect(200);
    expect(Array.isArray(next.body)).toBe(true);
    expect(next.body.length).toBeLessThanOrEqual(10);

    // 틀에서 만들면 운동 종류와 보상이 복사됨
    const fromTemplate = await http
      .post('/api/v1/missions')
      .set(auth(user))
      .send({ definitionId, scheduledDate: day(1) })
      .expect(201);
    expect(fromTemplate.body).toEqual(
      expect.objectContaining({
        sourceType: 'template',
        exerciseCode: 'plank',
        rewardPreview: { points: 70, userXp: 7, petXp: 3 },
      }),
    );
  });
});
