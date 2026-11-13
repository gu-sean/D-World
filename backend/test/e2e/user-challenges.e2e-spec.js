import { createTestApp } from '../support/app.js';
import { testNickname } from '../support/users.js';
import { adminApi } from '../support/admin-api.js';
import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { addDays, kstDate } from '../../src/common/time/kst.js';
import { DatabaseService } from '../../src/database/database.service.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)('사용자 개설 챌린지와 검수 (PostgreSQL)', () => {
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
  const adminPost = (path, body = {}) =>
    adminApi(http, adminToken).post(path, body);

  async function createUser() {
    const id = newId();
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

  const definition = (overrides = {}) => ({
    title: `사용자 챌린지 ${RUN}`,
    description: '같이 걸어요',
    categoryId,
    difficultyId,
    verificationMethod: 'sensor',
    exerciseCode: 'running',
    startDate: addDays(today(), 3),
    endDate: addDays(today(), 9),
    ...overrides,
  });
  const create = (user, overrides) =>
    http
      .post('/api/v1/challenges')
      .set(auth(user.token))
      .send(definition(overrides));
  const submit = (user, id) =>
    http.post(`/api/v1/challenges/${id}/submit`).set(auth(user.token));
  const review = (id, body) =>
    adminPost(`/admin/v1/challenges/${id}/review`, body);
  const reviews = async (id) =>
    (
      await db.query(
        'SELECT decision, reason FROM challenge_publication_reviews WHERE challenge_id = $1 ORDER BY created_at, id',
        [id],
      )
    ).rows;

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());

    adminId = newId();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `uc_${RUN}`, `${adminId.toLowerCase()}@example.com`],
    );
    const session = await tx((t) =>
      app.get(SessionsService).create(t, 'admin', adminId),
    );
    adminToken = await app
      .get(AccessTokenService)
      .issue('admin', adminId, session.sessionId);
    categoryId = newId();
    difficultyId = newId();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [categoryId, `ucc${RUN}`, `개설카테고리${RUN}`],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [difficultyId, `ucd${RUN}`, `개설난이도${RUN}`],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('초안을 만들면 보상 없이 개설자에게만 보이고, 형식·참조·권한 검증', async () => {
    const owner = await createUser();
    const other = await createUser();
    // 요청에 보상을 넣어도 무시되고 항상 0
    const res = await create(owner, {
      reward: { points: 999, userXp: 9, petXp: 9 },
    }).expect(201);
    expect(res.body).toMatchObject({
      origin: 'user',
      publicationStatus: 'draft',
      requiredSuccessDays: 7,
      creatorNickname: expect.any(String),
      reward: {
        points: 0,
        userXp: 0,
        petXp: 0,
        badgeAchievementVersionId: null,
      },
    });
    await http
      .get(`/api/v1/challenges/${res.body.id}`)
      .set(auth(other.token))
      .expect(404);
    await http
      .get(`/api/v1/challenges/${res.body.id}`)
      .set(auth(owner.token))
      .expect(404); // 공개 전에는 개설자도 탐색 목록으로는 못 봄

    const mine = await http
      .get('/api/v1/me/challenges/created')
      .set(auth(owner.token))
      .expect(200);
    expect(mine.body.items.map((i) => i.id)).toContain(res.body.id);
    expect(mine.body.items[0].lastReview).toBeNull();
    expect(
      (
        await http
          .get('/api/v1/me/challenges/created')
          .set(auth(other.token))
          .expect(200)
      ).body.items,
    ).toHaveLength(0);

    const bad = async (overrides, status, code) => {
      const r = await create(owner, overrides).expect(status);
      if (code) expect(r.body.error.code).toBe(code);
    };
    await bad({ endDate: addDays(today(), 10) }, 400, 'GOAL_INVALID_PERIOD');
    await bad({ requiredSuccessDays: 8 }, 422, 'INVALID_REQUIRED_DAYS');
    await bad(
      { verificationMethod: 'camera' },
      422,
      'VERIFY_EVIDENCE_KIND_MISMATCH',
    );
    await bad({ categoryId: newId() }, 404, 'CATALOG_NOT_FOUND');
    await bad({ title: ' ' }, 400);

    await http.post('/api/v1/challenges').send(definition()).expect(401);
    const restricted = await createUser();
    await db.query(
      `INSERT INTO account_actions (id, user_id, admin_id, action_type, reason, starts_at, ends_at)
       VALUES ($1,$2,$3,'restriction','테스트', now() - interval '1 minute', now() + interval '1 day')`,
      [newId(), restricted.id, adminId],
    );
    expect((await create(restricted).expect(403)).body.error.code).toBe(
      'AUTH_ACCOUNT_RESTRICTED',
    );
  });

  it('초안은 개설자만 수정하고, 검수를 신청하면 수정할 수 없으며 시작일이 내일 이전이면 신청 불가', async () => {
    const owner = await createUser();
    const other = await createUser();
    const draft = (await create(owner).expect(201)).body;

    const edit = (user, body) =>
      http
        .patch(`/api/v1/challenges/${draft.id}`)
        .set(auth(user.token))
        .send(body);
    const edited = await edit(owner, {
      title: `수정됨 ${RUN}`,
      endDate: addDays(today(), 16),
    }).expect(200);
    expect(edited.body).toMatchObject({
      title: `수정됨 ${RUN}`,
      endDate: addDays(today(), 16),
    });
    await edit(other, { title: '남의 것' }).expect(404);
    await edit(owner, {}).expect(400);
    await edit(owner, { endDate: addDays(today(), 11) }).expect(400);

    const early = (
      await create(owner, {
        startDate: today(),
        endDate: addDays(today(), 6),
      }).expect(201)
    ).body;
    expect((await submit(owner, early.id).expect(422)).body.error.code).toBe(
      'START_DATE_NOT_FUTURE',
    );
    await submit(other, draft.id).expect(404);

    const submitted = await submit(owner, draft.id).expect(200);
    expect(submitted.body.publicationStatus).toBe('review_pending');
    await submit(owner, draft.id).expect(200); // 반복해도 같은 결과
    expect(await reviews(draft.id)).toEqual([
      { decision: 'submitted', reason: null },
    ]);
    expect(
      (await edit(owner, { title: '또 수정' }).expect(409)).body.error.code,
    ).toBe('CHALLENGE_NOT_EDITABLE');
    await http
      .post(`/api/v1/challenges/${draft.id}/join`)
      .set(auth(other.token))
      .expect(404); // 승인 전 참여 불가
  });

  it('관리자는 대기열에서 승인(공개)하고, 공개된 뒤에는 누구나 참가할 수 있으며 개설자도 같은 규칙', async () => {
    const owner = await createUser();
    const joiner = await createUser();
    const challenge = (
      await create(owner, { title: `승인 대상 ${RUN}` }).expect(201)
    ).body;
    await submit(owner, challenge.id).expect(200);

    const queue = await http
      .get('/admin/v1/challenges')
      .query({ origin: 'user', publicationStatus: 'review_pending', size: 100 })
      .set(auth(adminToken))
      .expect(200);
    expect(queue.body.items.find((i) => i.id === challenge.id)).toMatchObject({
      origin: 'user',
      publicationStatus: 'review_pending',
    });
    await http.get('/admin/v1/challenges').set(auth(owner.token)).expect(401);

    // 공식 챌린지용 API로는 처리할 수 없음
    const official = await adminPost(
      `/admin/v1/challenges/${challenge.id}/publish`,
    ).expect(409);
    expect(official.body.error.code).toBe('NOT_OFFICIAL');
    await http
      .patch(`/admin/v1/challenges/${challenge.id}`)
      .set(auth(adminToken))
      .set('Idempotency-Key', newId())
      .send({ title: 'x', reason: '시도' })
      .expect(409);

    const approved = await review(challenge.id, { decision: 'approve' }).expect(
      200,
    );
    expect(approved.body).toMatchObject({
      publicationStatus: 'public',
      creatorNickname: expect.any(String),
    });
    expect(approved.body.publishedAt).toBeTruthy();
    expect((await reviews(challenge.id)).map((r) => r.decision)).toEqual([
      'submitted',
      'approved',
    ]);
    expect(
      (
        await db.query(
          `SELECT event_type FROM challenge_rule_events WHERE challenge_id = $1`,
          [challenge.id],
        )
      ).rows,
    ).toEqual([{ event_type: 'published' }]);

    const list = await http
      .get('/api/v1/challenges')
      .query({ categoryId, limit: 50 })
      .set(auth(joiner.token))
      .expect(200);
    expect(list.body.items.find((i) => i.id === challenge.id)).toMatchObject({
      origin: 'user',
    });
    await http
      .post(`/api/v1/challenges/${challenge.id}/join`)
      .set(auth(joiner.token))
      .expect(200);
    await http
      .post(`/api/v1/challenges/${challenge.id}/join`)
      .set(auth(owner.token))
      .expect(200);
    const detail = await http
      .get(`/api/v1/challenges/${challenge.id}`)
      .set(auth(owner.token))
      .expect(200);
    expect(detail.body.participantCount).toBe(2);
    expect(
      (await review(challenge.id, { decision: 'approve' }).expect(409)).body
        .error.code,
    ).toBe('CHALLENGE_NOT_PENDING');
    // 공개 후 규칙은 개설자도 바꿀 수 없음
    await http
      .patch(`/api/v1/challenges/${challenge.id}`)
      .set(auth(owner.token))
      .send({ title: 'x' })
      .expect(409);
  });

  it('반려는 사유가 필요하고, 개설자는 사유를 확인해 고친 뒤 다시 신청할 수 있음', async () => {
    const owner = await createUser();
    const challenge = (
      await create(owner, { title: `반려 대상 ${RUN}` }).expect(201)
    ).body;
    await submit(owner, challenge.id).expect(200);

    await review(challenge.id, { decision: 'reject' }).expect(400);
    await review(challenge.id, { decision: 'reject', reason: '  ' }).expect(
      400,
    );
    await review(challenge.id, { decision: 'maybe' }).expect(400);
    const rejected = await review(challenge.id, {
      decision: 'reject',
      reason: '설명이 부족함',
    }).expect(200);
    expect(rejected.body.publicationStatus).toBe('rejected');

    const mine = await http
      .get('/api/v1/me/challenges/created')
      .set(auth(owner.token))
      .expect(200);
    expect(
      mine.body.items.find((i) => i.id === challenge.id).lastReview,
    ).toMatchObject({
      decision: 'rejected',
      reason: '설명이 부족함',
    });
    const fixed = await http
      .patch(`/api/v1/challenges/${challenge.id}`)
      .set(auth(owner.token))
      .send({ description: '충분히 자세한 설명' })
      .expect(200);
    expect(fixed.body.publicationStatus).toBe('rejected');
    await submit(owner, challenge.id).expect(200);
    expect((await reviews(challenge.id)).map((r) => r.decision)).toEqual([
      'submitted',
      'rejected',
      'submitted',
    ]);
    await review(challenge.id, {
      decision: 'approve',
      reason: '보완 확인',
    }).expect(200);

    await review(newId(), { decision: 'approve' }).expect(404);
    const official = (
      await adminPost('/admin/v1/challenges', {
        title: `공식 ${RUN}`,
        description: '설명',
        categoryId,
        difficultyId,
        verificationMethod: 'sensor',
        exerciseCode: 'running',
        startDate: addDays(today(), 3),
        endDate: addDays(today(), 9),
        reward: { points: 0, userXp: 0, petXp: 0 },
      }).expect(201)
    ).body;
    expect(
      (await review(official.id, { decision: 'approve' }).expect(409)).body
        .error.code,
    ).toBe('NOT_USER_CHALLENGE');
  });

  it('검수 중 시작일이 지났으면 승인할 수 없고(고쳐서 재신청), 공개 후 숨기면 이력이 남음', async () => {
    const owner = await createUser();
    const late = (await create(owner, { title: `지연 ${RUN}` }).expect(201))
      .body;
    await submit(owner, late.id).expect(200);
    await tx(async (t) => {
      await t.query('SET LOCAL session_replication_role = replica');
      await t.query(
        `UPDATE challenges SET start_date = $2::date, end_date = $2::date + 6 WHERE id = $1`,
        [late.id, today()],
      );
    });
    expect(
      (await review(late.id, { decision: 'approve' }).expect(422)).body.error
        .code,
    ).toBe('START_DATE_NOT_FUTURE');

    const ok = (await create(owner, { title: `숨김 ${RUN}` }).expect(201)).body;
    await submit(owner, ok.id).expect(200);
    await review(ok.id, { decision: 'approve' }).expect(200);
    await adminPost(`/admin/v1/challenges/${ok.id}/hide`, {}).expect(400);
    const hidden = await adminPost(`/admin/v1/challenges/${ok.id}/hide`, {
      reason: '신고 접수',
    }).expect(200);
    expect(hidden.body.publicationStatus).toBe('hidden');
    expect((await reviews(ok.id)).map((r) => r.decision)).toEqual([
      'submitted',
      'approved',
      'hidden',
    ]);
    await http
      .get(`/api/v1/challenges/${ok.id}`)
      .set(auth(owner.token))
      .expect(404);
    const mine = await http
      .get('/api/v1/me/challenges/created')
      .set(auth(owner.token))
      .expect(200);
    expect(
      mine.body.items.find((i) => i.id === ok.id).lastReview,
    ).toMatchObject({
      decision: 'hidden',
      reason: '신고 접수',
    });

    const audit = await db.query(
      `SELECT action FROM admin_audit_logs WHERE admin_id = $1 AND action = 'challenge.review'`,
      [adminId],
    );
    expect(audit.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('동시에 만들 수 있는 미완료 챌린지는 5개까지', async () => {
    const owner = await createUser();
    const ids = [];
    for (let i = 0; i < 5; i++)
      ids.push(
        (await create(owner, { title: `상한 ${i} ${RUN}` }).expect(201)).body
          .id,
      );
    const over = await create(owner, { title: `초과 ${RUN}` }).expect(409);
    expect(over.body.error).toMatchObject({
      code: 'CREATION_LIMIT_REACHED',
      details: { limit: 5 },
    });

    // 동시에 여러 개를 만들어도 상한을 넘지 않음
    const racer = await createUser();
    const results = await Promise.all(
      Array.from({ length: 7 }, (_, i) =>
        create(racer, { title: `경쟁 ${i} ${RUN}` }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(5);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    expect(ids).toHaveLength(5);
  });
});
