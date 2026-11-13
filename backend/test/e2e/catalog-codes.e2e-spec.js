import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { createTestApp } from '../support/app.js';
import { createUser } from '../support/users.js';

// 분야·난이도는 API에서 code로 주고받음 (팀 문서 03 §7)
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)('분야·난이도 code 변환 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let user;
  const codes = { category: `cc${RUN}`, difficulty: `cd${RUN}` };
  const ids = { category: newId(), difficulty: newId() };
  const auth = () => ({ Authorization: `Bearer ${user.token}` });

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    user = await createUser(app, db);
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [ids.category, codes.category, `코드분야${RUN}`],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [ids.difficulty, codes.difficulty, `코드난이도${RUN}`],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const body = (overrides = {}) => ({
    title: '코드로 만든 목표',
    categoryCode: codes.category,
    difficultyCode: codes.difficulty,
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    ...overrides,
  });

  it('요청은 code로 받고 응답도 code로 돌려주며 UUID 키는 노출하지 않음', async () => {
    const res = await http
      .post('/api/v1/goals')
      .set(auth())
      .send(body())
      .expect(201);
    expect(res.body).toMatchObject({
      categoryCode: codes.category,
      difficultyCode: codes.difficulty,
    });
    expect(res.body).not.toHaveProperty('categoryId');
    expect(res.body).not.toHaveProperty('difficultyId');

    const { rows } = await db.query(
      'SELECT category_id, difficulty_id FROM goals WHERE id = $1',
      [res.body.id],
    );
    expect(rows[0]).toMatchObject({
      category_id: ids.category,
      difficulty_id: ids.difficulty,
    });
  });

  it('목록 응답 안의 항목도 code로 바뀜', async () => {
    const res = await http.get('/api/v1/goals').set(auth()).expect(200);
    const item = res.body.items.find((goal) => goal.categoryCode);
    expect(item.categoryCode).toBe(codes.category);
    expect(item).not.toHaveProperty('categoryId');
  });

  it('없는 code는 400 COMMON_VALIDATION_FAILED', async () => {
    const res = await http
      .post('/api/v1/goals')
      .set(auth())
      .send(body({ categoryCode: 'no_such_code' }))
      .expect(400);
    expect(res.body.error.code).toBe('COMMON_VALIDATION_FAILED');
  });
});
