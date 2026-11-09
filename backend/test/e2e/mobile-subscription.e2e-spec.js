import { createTestApp } from '../support/app.js';
import { createUser as createUserWith } from '../support/users.js';

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)('모바일 구독 A130 (PostgreSQL)', () => {
  let app;
  let db;
  let http;

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
  });

  afterAll(() => app.close());

  it('로그인한 사용자에게 501 COMMON_NOT_IMPLEMENTED', async () => {
    const user = await createUserWith(app, db);
    const res = await http
      .get('/api/v1/me/subscription')
      .set({ Authorization: `Bearer ${user.token}` })
      .expect(501);
    expect(res.body.error.code).toBe('COMMON_NOT_IMPLEMENTED');
    await http.get('/api/v1/me/subscription').expect(401);
  });
});
