import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { createTestApp } from '../support/app.js';
import { createUser } from '../support/users.js';

// 앱 API Idempotency-Key 처리 (user_idempotency_keys), 대표 엔드포인트: POST /goals
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)('앱 API 멱등 키 (PostgreSQL)', () => {
  let app;
  let http;
  let db;
  let user;
  let categoryId;
  let difficultyId;

  const auth = () => ({ Authorization: `Bearer ${user.token}` });
  const body = (overrides = {}) => ({
    title: '멱등 목표',
    categoryId,
    difficultyId,
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    ...overrides,
  });
  const create = (key, payload = body()) =>
    http
      .post('/api/v1/goals')
      .set(auth())
      .set('Idempotency-Key', key)
      .send(payload);

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    user = await createUser(app, db);
    categoryId = newId();
    difficultyId = newId();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order, is_active) VALUES ($1,$2,$3,1,true)`,
      [categoryId, `ik${RUN}`, `멱등카테고리${RUN}`],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order, is_active) VALUES ($1,$2,$3,1,true)`,
      [difficultyId, `id${RUN}`, `멱등난이도${RUN}`],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('키가 없거나 형식이 틀리면 400 COMMON_VALIDATION_FAILED', async () => {
    const res = await http
      .post('/api/v1/goals')
      .set(auth())
      .set('Idempotency-Key', 'short')
      .send(body())
      .expect(400);
    expect(res.body.error.code).toBe('COMMON_VALIDATION_FAILED');
  });

  it('같은 키·같은 본문은 저장된 응답을 그대로 재생(중복 생성 없음)', async () => {
    const key = newId();
    const first = await create(key).expect(201);
    const replay = await create(key).expect(201);
    expect(replay.body).toEqual(first.body);
    const { rows } = await db.query(
      'SELECT count(*)::int AS n FROM goals WHERE user_id = $1 AND title = $2',
      [user.id, '멱등 목표'],
    );
    expect(rows[0].n).toBe(1);
    const stored = await db.query(
      `SELECT status, response_status FROM user_idempotency_keys
        WHERE user_id = $1 AND idempotency_key = $2`,
      [user.id, key],
    );
    expect(stored.rows[0]).toEqual({
      status: 'completed',
      response_status: 201,
    });
  });

  it('같은 키에 다른 본문이면 409 COMMON_IDEMPOTENCY_KEY_REUSED', async () => {
    const key = newId();
    await create(key).expect(201);
    const res = await create(key, body({ title: '다른 목표' })).expect(409);
    expect(res.body.error.code).toBe('COMMON_IDEMPOTENCY_KEY_REUSED');
  });

  it('실패한 요청은 키를 지워 같은 키로 다시 시도할 수 있음', async () => {
    const key = newId();
    const bad = await create(key, body({ endDate: '2026-10-01' }));
    expect(bad.status).toBeGreaterThanOrEqual(400);
    const { rows } = await db.query(
      'SELECT 1 FROM user_idempotency_keys WHERE user_id = $1 AND idempotency_key = $2',
      [user.id, key],
    );
    expect(rows).toHaveLength(0);
  });

  it('처리 중인 같은 키는 409 COMMON_REQUEST_IN_PROGRESS', async () => {
    const key = newId();
    const first = create(key, body({ title: '동시 목표' })).then((r) => r);
    const second = create(key, body({ title: '동시 목표' })).then((r) => r);
    const [a, b] = await Promise.all([first, second]);
    const statuses = [a.status, b.status].sort();
    // 한쪽은 생성(201), 다른 쪽은 진행 중 409 또는 재생 201
    expect(statuses[0]).toBe(201);
    if (statuses[1] === 409) {
      const loser = a.status === 409 ? a : b;
      expect(loser.body.error.code).toBe('COMMON_REQUEST_IN_PROGRESS');
    }
    const { rows } = await db.query(
      'SELECT count(*)::int AS n FROM goals WHERE user_id = $1 AND title = $2',
      [user.id, '동시 목표'],
    );
    expect(rows[0].n).toBe(1);
  });
  it('목표 수정·삭제: 키가 있으면 재생, 없으면 그대로 실행(선택 멱등)', async () => {
    const created = await create(newId(), body({ title: '선택 멱등' }));
    const goalId = created.body.id;

    const key = newId();
    const patch = () =>
      http
        .patch(`/api/v1/goals/${goalId}`)
        .set(auth())
        .set('Idempotency-Key', key)
        .send({ title: '수정됨' });
    const first = await patch().expect(200);
    // 다른 값으로 바꾼 뒤 같은 키로 다시 보내면 저장된 응답이 재생되고 값은 되돌아가지 않음
    await http
      .patch(`/api/v1/goals/${goalId}`)
      .set(auth())
      .send({ title: '다른 수정' })
      .expect(200);
    const replay = await patch().expect(200);
    expect(replay.body).toEqual(first.body);
    const { rows } = await db.query('SELECT title FROM goals WHERE id = $1', [
      goalId,
    ]);
    expect(rows[0].title).toBe('다른 수정');

    // 같은 키에 다른 본문은 409
    const reused = await http
      .patch(`/api/v1/goals/${goalId}`)
      .set(auth())
      .set('Idempotency-Key', key)
      .send({ title: '또 다름' })
      .expect(409);
    expect(reused.body.error.code).toBe('COMMON_IDEMPOTENCY_KEY_REUSED');

    // 삭제 재전송은 두 번째도 204(첫 응답 재생)
    const delKey = newId();
    const del = () =>
      http
        .delete(`/api/v1/goals/${goalId}`)
        .set(auth())
        .set('Idempotency-Key', delKey);
    await del().expect(204);
    await del().expect(204);
  });
});
