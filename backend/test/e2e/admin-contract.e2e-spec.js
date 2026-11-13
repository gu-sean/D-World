import { randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { createTestApp } from '../support/app.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';

// 관리자 API 공통 규칙 (팀 문서 09 §0): reason 필수, AdminPage 목록, 감사 로그
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)('관리자 API 공통 규칙 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let adminId;
  let adminToken;

  const auth = () => ({ Authorization: `Bearer ${adminToken}` });
  const post = (path, body, key = newId()) =>
    http.post(path).set(auth()).set('Idempotency-Key', key).send(body);

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    adminId = newId();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `ac_${RUN}`, `${adminId.toLowerCase()}@example.com`],
    );
    const session = await db.withTransaction((tx) =>
      app.get(SessionsService).create(tx, 'admin', adminId),
    );
    adminToken = await app
      .get(AccessTokenService)
      .issue('admin', adminId, session.sessionId);
  });

  afterAll(async () => {
    await app.close();
  });

  it('변경 요청에 reason이 없거나 공백이면 400 ADMIN_REASON_REQUIRED', async () => {
    for (const body of [{}, { reason: '' }, { reason: '   ' }]) {
      const res = await post('/admin/v1/goal-categories', {
        code: `rq${RUN}`,
        name: `사유필수${RUN}`,
        displayOrder: 1,
        ...body,
      }).expect(400);
      expect(res.body.error.code).toBe('ADMIN_REASON_REQUIRED');
    }
    const long = await post('/admin/v1/goal-categories', {
      code: `rq${RUN}`,
      name: `사유필수${RUN}`,
      displayOrder: 1,
      reason: 'x'.repeat(501),
    }).expect(400);
    expect(long.body.error.code).toBe('ADMIN_REASON_REQUIRED');
  });

  it('성공한 변경은 감사 로그에 팀 문서의 action 이름과 reason을 남김', async () => {
    const code = `au${RUN}`;
    await post('/admin/v1/goal-categories', {
      code,
      name: `감사${RUN}`,
      displayOrder: 1,
      reason: '감사 확인용',
    }).expect(201);
    const { rows } = await db.query(
      `SELECT action, result, reason FROM admin_audit_logs
        WHERE admin_id = $1 AND action = 'category.create'`,
      [adminId],
    );
    expect(rows).toEqual([
      { action: 'category.create', result: 'success', reason: '감사 확인용' },
    ]);
  });

  it('목록은 AdminPage(items, page, size, totalCount)이고 page·size·sort를 검증', async () => {
    const res = await http
      .get('/admin/v1/verifications')
      .query({ status: 'approved', page: 1, size: 5 })
      .set(auth())
      .expect(200);
    expect(res.body).toEqual({
      items: expect.any(Array),
      page: 1,
      size: 5,
      totalCount: expect.any(Number),
    });
    expect(res.headers['x-completed-today']).toMatch(/^\d+$/);

    for (const query of [
      { size: 101 },
      { size: 0 },
      { page: 0 },
      { sort: 'name,asc' },
      { status: 'unknown' },
    ]) {
      const bad = await http
        .get('/admin/v1/verifications')
        .query(query)
        .set(auth())
        .expect(400);
      expect(bad.body.error.code).toBe('COMMON_VALIDATION_FAILED');
    }
  });

  it('이의 제기 목록·상세(M34, M35)는 없는 ID에 404', async () => {
    const list = await http.get('/admin/v1/appeals').set(auth()).expect(200);
    expect(list.body).toMatchObject({ page: 1, size: 20 });
    await http.get(`/admin/v1/appeals/${newId()}`).set(auth()).expect(404);
  });

  it('미션 틀 목록(M42)은 출처·공개 상태 필터와 AdminPage 형식', async () => {
    const res = await http
      .get('/admin/v1/mission-definitions')
      .query({ origin: 'admin', publicationStatus: 'public' })
      .set(auth())
      .expect(200);
    expect(res.body).toMatchObject({ page: 1, size: 20 });
    expect(res.body.items.every((i) => i.origin === 'admin')).toBe(true);
  });

  it('챌린지 목록(M53)은 단계·출처 필터를 검증하고 AdminPage로 응답', async () => {
    const res = await http
      .get('/admin/v1/challenges')
      .query({ phase: 'ongoing', origin: 'admin', sort: 'startDate,asc' })
      .set(auth())
      .expect(200);
    expect(res.body).toMatchObject({ page: 1, size: 20 });
    await http
      .get('/admin/v1/challenges')
      .query({ phase: 'someday' })
      .set(auth())
      .expect(400);
  });

  it('쓰이는 분야는 끌 수 없음 (CATALOG_IN_USE)', async () => {
    const category = (
      await post('/admin/v1/goal-categories', {
        code: `iu${RUN}`,
        name: `사용중${RUN}`,
        displayOrder: 1,
        reason: '준비',
      }).expect(201)
    ).body;
    const difficulty = newId();
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [difficulty, `iud${RUN}`, `사용중난이도${RUN}`],
    );
    await db.query(
      `INSERT INTO mission_definitions
              (id, origin, title, category_id, difficulty_id, verification_method, publication_status)
       VALUES ($1,'admin','공개 틀',$2,$3,'camera','public')`,
      [newId(), category.id, difficulty],
    );
    const res = await http
      .patch(`/admin/v1/goal-categories/${category.id}`)
      .set(auth())
      .set('Idempotency-Key', newId())
      .send({ isActive: false, reason: '정리' })
      .expect(409);
    expect(res.body.error.code).toBe('CATALOG_IN_USE');
  });

  describe('포인트 조정·조회와 감사 로그 조회', () => {
    let userId;

    beforeAll(async () => {
      userId = newId();
      await db.query('INSERT INTO users (id) VALUES ($1)', [userId]);
    });

    const adjust = (body, key = newId()) =>
      post(
        '/admin/v1/point-adjustments',
        { userId, reason: '보상 지급', ...body },
        key,
      );

    it('수동 지급·회수는 거래 원장에 남고 감사 로그에 기록됨 (M71)', async () => {
      const grant = await adjust({ kind: 'manual_grant', amount: 500 }).expect(
        201,
      );
      expect(grant.body).toMatchObject({
        userId,
        kind: 'manual_grant',
        availableDelta: 500,
        balanceAfter: 500,
        sourceType: 'admin_adjustment',
        reason: '보상 지급',
        createdByAdminId: adminId,
      });
      const recovery = await adjust({
        kind: 'manual_recovery',
        amount: 200,
      }).expect(201);
      expect(recovery.body).toMatchObject({
        availableDelta: -200,
        balanceAfter: 300,
      });

      const { rows } = await db.query(
        `SELECT action, result, target_user_id, reason FROM admin_audit_logs
          WHERE admin_id = $1 AND action = 'point.adjust' ORDER BY recorded_at`,
        [adminId],
      );
      expect(rows).toEqual([
        {
          action: 'point.adjust',
          result: 'success',
          target_user_id: userId,
          reason: '보상 지급',
        },
        {
          action: 'point.adjust',
          result: 'success',
          target_user_id: userId,
          reason: '보상 지급',
        },
      ]);
    });

    it('같은 키로 다시 보내면 한 번만 반영, 잔액보다 많이 회수하면 422', async () => {
      const key = newId();
      const first = await adjust(
        { kind: 'manual_grant', amount: 10 },
        key,
      ).expect(201);
      const replay = await adjust(
        { kind: 'manual_grant', amount: 10 },
        key,
      ).expect(201);
      expect(replay.body).toEqual(first.body);
      const over = await adjust({
        kind: 'manual_recovery',
        amount: 1_000_000,
      }).expect(422);
      expect(over.body.error.code).toBe('POINT_INSUFFICIENT');
    });

    it('입력 검증: 사유 필수, 종류·수량·회원 확인', async () => {
      const noReason = await post('/admin/v1/point-adjustments', {
        userId,
        kind: 'manual_grant',
        amount: 5,
      }).expect(400);
      expect(noReason.body.error.code).toBe('ADMIN_REASON_REQUIRED');
      for (const bad of [
        { kind: 'spend' },
        { amount: 0 },
        { amount: 1.5 },
        { amount: 2_000_000 },
      ]) {
        await adjust({ kind: 'manual_grant', amount: 5, ...bad }).expect(400);
      }
      await adjust({
        kind: 'manual_grant',
        amount: 5,
        userId: newId(),
      }).expect(404);
    });

    it('거래 목록은 AdminPage이고 사용자·종류 필터와 X-Pending-Points 헤더 (M70)', async () => {
      const res = await http
        .get('/admin/v1/point-transactions')
        .query({ userId, kind: 'manual_grant', size: 50 })
        .set(auth())
        .expect(200);
      expect(res.body.totalCount).toBe(2);
      expect(
        res.body.items.every(
          (i) => i.userId === userId && i.kind === 'manual_grant',
        ),
      ).toBe(true);
      expect(res.headers['x-pending-points']).toMatch(/^\d+$/);

      const asc = await http
        .get('/admin/v1/point-transactions')
        .query({ userId, sort: 'occurredAt,asc' })
        .set(auth())
        .expect(200);
      const times = asc.body.items.map((i) => Date.parse(i.occurredAt));
      expect(times).toEqual([...times].sort((a, b) => a - b));

      await http
        .get('/admin/v1/point-transactions')
        .query({ kind: 'bad' })
        .set(auth())
        .expect(400);
      await http
        .get('/admin/v1/point-transactions')
        .query({ userId: 'x' })
        .set(auth())
        .expect(400);
    });

    it('감사 로그 조회: action 앞부분·대상 사용자·결과·기간 필터 (M101)', async () => {
      const res = await http
        .get('/admin/v1/audit-logs')
        .query({ action: 'point.', targetUserId: userId, result: 'success' })
        .set(auth())
        .expect(200);
      expect(res.body.totalCount).toBe(3);
      expect(res.body.items[0]).toMatchObject({
        adminId,
        adminLoginId: `ac_${RUN}`,
        targetUserId: userId,
        action: 'point.adjust',
        result: 'success',
        reason: '보상 지급',
      });
      expect(res.body.items[0].afterValue).toMatchObject({
        kind: expect.any(String),
      });

      const none = await http
        .get('/admin/v1/audit-logs')
        .query({
          action: 'point.',
          from: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .set(auth())
        .expect(200);
      expect(none.body.totalCount).toBe(0);

      // LIKE 특수문자는 문자 그대로 취급
      const literal = await http
        .get('/admin/v1/audit-logs')
        .query({ action: '%' })
        .set(auth())
        .expect(200);
      expect(literal.body.totalCount).toBe(0);

      await http
        .get('/admin/v1/audit-logs')
        .query({ result: 'maybe' })
        .set(auth())
        .expect(400);
      await http
        .get('/admin/v1/audit-logs')
        .query({ sort: 'recordedAt,sideways' })
        .set(auth())
        .expect(400);
      await http.get('/admin/v1/audit-logs').expect(401);
    });
  });

  describe('관리자 미션 틀 등록·수정·조회 (M40, M41, M43)', () => {
    let categoryId;
    let difficultyId;

    beforeAll(async () => {
      categoryId = newId();
      difficultyId = newId();
      await db.query(
        `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [categoryId, `md${RUN}`, `틀분야${RUN}`],
      );
      await db.query(
        `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [difficultyId, `mdd${RUN}`, `틀난이도${RUN}`],
      );
    });

    const body = (overrides = {}) => ({
      title: `관리자 틀 ${RUN}`,
      description: '설명',
      categoryCode: `md${RUN}`,
      difficultyCode: `mdd${RUN}`,
      exerciseCode: 'squat',
      verificationMethod: 'camera',
      targetValue: 20,
      targetUnit: '회',
      estimatedDurationSeconds: 300,
      reason: '신규 등록',
      ...overrides,
    });

    it('등록하면 origin=admin·기본 공개로 만들어지고 단건·목록에서 조회됨', async () => {
      const created = await post(
        '/admin/v1/mission-definitions',
        body(),
      ).expect(201);
      expect(created.body).toMatchObject({
        origin: 'admin',
        title: `관리자 틀 ${RUN}`,
        categoryCode: `md${RUN}`,
        difficultyCode: `mdd${RUN}`,
        exerciseCode: 'squat',
        verificationMethod: 'camera',
        targetValue: 20,
        targetUnit: '회',
        publicationStatus: 'public',
        authorId: null,
      });

      const got = await http
        .get(`/admin/v1/mission-definitions/${created.body.id}`)
        .set(auth())
        .expect(200);
      expect(got.body).toEqual(created.body);

      const list = await http
        .get('/admin/v1/mission-definitions')
        .query({
          origin: 'admin',
          categoryCode: `md${RUN}`,
          query: '관리자 틀',
        })
        .set(auth())
        .expect(200);
      expect(list.body.items.map((i) => i.id)).toContain(created.body.id);

      const { rows } = await db.query(
        `SELECT action, reason FROM admin_audit_logs
          WHERE admin_id = $1 AND action = 'mission_definition.create'`,
        [adminId],
      );
      expect(rows).toEqual([
        { action: 'mission_definition.create', reason: '신규 등록' },
      ]);
    });

    it('수정은 보낸 필드만 바꾸고 감사 로그에 전후 값이 남음', async () => {
      const created = (
        await post(
          '/admin/v1/mission-definitions',
          body({ title: `수정 대상 ${RUN}` }),
        ).expect(201)
      ).body;
      const patched = await http
        .patch(`/admin/v1/mission-definitions/${created.id}`)
        .set(auth())
        .set('Idempotency-Key', newId())
        .send({
          title: `바뀐 제목 ${RUN}`,
          publicationStatus: 'hidden',
          reason: '정리',
        })
        .expect(200);
      expect(patched.body).toMatchObject({
        title: `바뀐 제목 ${RUN}`,
        publicationStatus: 'hidden',
        targetValue: 20,
        exerciseCode: 'squat',
      });
      const { rows } = await db.query(
        `SELECT before_value, after_value FROM admin_audit_logs
          WHERE admin_id = $1 AND action = 'mission_definition.update'
          ORDER BY recorded_at DESC LIMIT 1`,
        [adminId],
      );
      expect(rows[0].before_value).toEqual({
        title: `수정 대상 ${RUN}`,
        publicationStatus: 'public',
      });
      expect(rows[0].after_value).toMatchObject({
        publicationStatus: 'hidden',
      });
    });

    it('검증: 사유 필수, 달리기-센서 정합성, 목표 값·단위 쌍, 비활성·없는 분야, 사용자 틀 수정 불가', async () => {
      const noReason = await post(
        '/admin/v1/mission-definitions',
        body({ reason: undefined }),
      ).expect(400);
      expect(noReason.body.error.code).toBe('ADMIN_REASON_REQUIRED');

      const mismatch = await post(
        '/admin/v1/mission-definitions',
        body({ exerciseCode: 'running', verificationMethod: 'camera' }),
      ).expect(422);
      expect(mismatch.body.error.code).toBe('VERIFY_EVIDENCE_KIND_MISMATCH');
      await post(
        '/admin/v1/mission-definitions',
        body({ targetUnit: undefined }),
      ).expect(422);
      await post(
        '/admin/v1/mission-definitions',
        body({ targetValue: 0 }),
      ).expect(400);
      await post(
        '/admin/v1/mission-definitions',
        body({ publicationStatus: 'review_pending' }),
      ).expect(400);
      await post(
        '/admin/v1/mission-definitions',
        body({ categoryCode: 'no_such_code' }),
      ).expect(400);

      await db.query(
        'UPDATE goal_categories SET is_active = false WHERE id = $1',
        [categoryId],
      );
      const inactive = await post(
        '/admin/v1/mission-definitions',
        body(),
      ).expect(422);
      expect(inactive.body.error.code).toBe('CATALOG_INACTIVE');
      await db.query(
        'UPDATE goal_categories SET is_active = true WHERE id = $1',
        [categoryId],
      );

      const userDefinition = newId();
      const userId = newId();
      await db.query('INSERT INTO users (id) VALUES ($1)', [userId]);
      await db.query(
        `INSERT INTO mission_definitions
                (id, origin, created_by_user_id, title, category_id, difficulty_id,
                 verification_method, publication_status)
         VALUES ($1,'user',$2,'사용자 틀',$3,$4,'camera','private')`,
        [userDefinition, userId, categoryId, difficultyId],
      );
      const conflict = await http
        .patch(`/admin/v1/mission-definitions/${userDefinition}`)
        .set(auth())
        .set('Idempotency-Key', newId())
        .send({ title: '바꾸기', reason: '시도' })
        .expect(409);
      expect(conflict.body.error.code).toBe('NOT_ADMIN_DEFINITION');

      await http
        .patch(`/admin/v1/mission-definitions/${newId()}`)
        .set(auth())
        .set('Idempotency-Key', newId())
        .send({ title: 'x', reason: '시도' })
        .expect(404);
      await http
        .patch(`/admin/v1/mission-definitions/${userDefinition}`)
        .set(auth())
        .set('Idempotency-Key', newId())
        .send({ reason: '빈 수정' })
        .expect(400);
      await http
        .get(`/admin/v1/mission-definitions/${newId()}`)
        .set(auth())
        .expect(404);
    });
  });
});
