import { createUser as createUserWith } from '../support/users.js';
import { createTestApp } from '../support/app.js';
import { randomInt, randomUUID } from 'node:crypto';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { sha256Hex } from '../../src/common/crypto/crypto.js';
import { addDays, kstDate } from '../../src/common/time/kst.js';
import { DatabaseService } from '../../src/database/database.service.js';

// DATABASE_URL이 있을 때만 실행, 마이그레이션 적용 필요
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999); // 반복 실행해도 고유 값이 겹치지 않게

describe.skipIf(!databaseUrl)('미션 원형·공개 검수 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let adminId;
  let adminToken;
  let counter = 0;

  const tx = (fn) => db.withTransaction(fn);
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const next = () => `${RUN}${counter++}`;

  const createUser = () => createUserWith(app, db);

  async function createReference({ rate = true, isActive = true } = {}) {
    const tag = next();
    const category = randomUUID();
    const difficulty = randomUUID();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order, is_active) VALUES ($1,$2,$3,1,$4)`,
      [category, `dc${tag}`, `원형카테고리${tag}`, isActive],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order, is_active) VALUES ($1,$2,$3,1,$4)`,
      [difficulty, `dd${tag}`, `원형난이도${tag}`, isActive],
    );
    if (rate) {
      await db.query(
        `INSERT INTO mission_reward_rate_versions
                (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
                 effective_at, created_by_admin_id)
         VALUES ($1,$2,$3,1,60,6,3, now() - interval '1 day', $4)`,
        [randomUUID(), category, difficulty, adminId],
      );
    }
    return {
      category,
      difficulty,
      categoryCode: `dc${tag}`,
      difficultyCode: `dd${tag}`,
    };
  }

  const definitionBody = (ref, overrides = {}) => ({
    title: '아침 스트레칭',
    description: '10분 스트레칭',
    categoryId: ref.category,
    difficultyId: ref.difficulty,
    verificationMethod: 'camera',
    ...overrides,
  });

  async function createDefinition(user, ref, overrides = {}) {
    const res = await http
      .post('/api/v1/me/mission-definitions')
      .set(auth(user.token))
      .send(definitionBody(ref, overrides))
      .expect(201);
    return res.body;
  }

  /** 검수 신청까지 한 원형 */
  async function pendingDefinition(user, ref, overrides) {
    const definition = await createDefinition(user, ref, overrides);
    await http
      .post(
        `/api/v1/me/mission-definitions/${definition.id}/publication-request`,
      )
      .set(auth(user.token))
      .expect(200);
    return definition;
  }

  const adminPost = (path, payload, key = randomUUID()) => {
    const req = http.post(path).set(auth(adminToken));
    if (key !== null) req.set('Idempotency-Key', key);
    return req.send(payload ?? {});
  };
  // M44: 모든 검수에 reason(1~500자) 필요
  const APPROVE_REASON = '승인 사유';
  const review = (id, decision, reason, key) =>
    adminPost(
      `/admin/v1/mission-definitions/${id}/reviews`,
      { decision, reason },
      key,
    );
  const approve = (id, key) => review(id, 'approved', APPROVE_REASON, key);
  const reject = (id, reason = '기준에 맞지 않음', key) =>
    review(id, 'rejected', reason, key);
  const hide = (id, reason = '부적절한 내용', key) =>
    review(id, 'hidden', reason, key);

  const statusOf = async (id) =>
    (
      await db.query(
        'SELECT publication_status FROM mission_definitions WHERE id = $1',
        [id],
      )
    ).rows[0].publication_status;
  const reviewsOf = async (id) =>
    (
      await db.query(
        `SELECT decision, reason, reviewed_by_admin_id, requested_by_user_id
           FROM mission_publication_reviews WHERE definition_id = $1
          ORDER BY created_at, id`,
        [id],
      )
    ).rows;

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());

    adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `df_${RUN}`, `${adminId}@example.com`],
    );
    const session = await tx((t) =>
      app.get(SessionsService).create(t, 'admin', adminId),
    );
    adminToken = await app
      .get(AccessTokenService)
      .issue('admin', adminId, session.sessionId);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('원형 만들기', () => {
    it('비공개로 만들고 기본 보상은 0, 작성자에게만 검수 상태가 보임', async () => {
      const user = await createUser();
      const ref = await createReference();
      const definition = await createDefinition(user, ref, {
        targetValue: 10,
        targetUnit: '분',
        estimatedDurationSeconds: 600,
      });
      expect(definition).toMatchObject({
        origin: 'user',
        title: '아침 스트레칭',
        description: '10분 스트레칭',
        categoryCode: ref.categoryCode,
        difficultyCode: ref.difficultyCode,
        verificationMethod: 'camera',
        targetValue: 10,
        targetUnit: '분',
        estimatedDurationSeconds: 600,
        publicationStatus: 'private',
      });
      const { rows } = await db.query(
        'SELECT base_points, base_user_xp, base_pet_xp FROM mission_definitions WHERE id = $1',
        [definition.id],
      );
      expect(rows[0]).toEqual({
        base_points: 0,
        base_user_xp: 0,
        base_pet_xp: 0,
      });
    });

    it('입력 검증과 비활성 카테고리·난이도 거절, 인증 필요', async () => {
      const user = await createUser();
      const ref = await createReference();
      for (const overrides of [
        { title: ' ' },
        { title: 'a'.repeat(201) },
        { verificationMethod: 'manual' },
        { targetValue: 5 },
        { targetUnit: '분' },
        { targetValue: 0, targetUnit: '분' },
        { estimatedDurationSeconds: 0 },
        { categoryId: 'x' },
      ]) {
        const res = await http
          .post('/api/v1/me/mission-definitions')
          .set(auth(user.token))
          .send(definitionBody(ref, overrides));
        expect(res.status, JSON.stringify(overrides)).toBe(400);
      }
      const inactive = await createReference({ isActive: false });
      const res = await http
        .post('/api/v1/me/mission-definitions')
        .set(auth(user.token))
        .send(definitionBody(inactive))
        .expect(422);
      expect(res.body.error.code).toBe('INACTIVE_REFERENCE');
      await http.post('/api/v1/me/mission-definitions').send({}).expect(401);
    });

    it('한 사용자가 만들 수 있는 원형은 100개, 삭제한 원형은 세지 않음', async () => {
      const user = await createUser();
      const ref = await createReference();
      await db.query(
        `INSERT INTO mission_definitions
                (id, origin, created_by_user_id, title, category_id, difficulty_id,
                 verification_method, publication_status)
         SELECT gen_random_uuid(), 'user', $1, '채우기 ' || n, $2, $3, 'camera', 'private'
           FROM generate_series(1, 99) AS n`,
        [user.id, ref.category, ref.difficulty],
      );
      const last = await createDefinition(user, ref);
      const over = await http
        .post('/api/v1/me/mission-definitions')
        .set(auth(user.token))
        .send(definitionBody(ref))
        .expect(409);
      expect(over.body.error.code).toBe('DEFINITION_LIMIT_REACHED');

      await http
        .delete(`/api/v1/me/mission-definitions/${last.id}`)
        .set(auth(user.token))
        .expect(204);
      await createDefinition(user, ref);
    });
  });

  describe('조회', () => {
    it('내 원형은 상태 필터와 함께, 공개 목록에는 공개된 것만(관리자 템플릿 포함) 나옴', async () => {
      const owner = await createUser();
      const other = await createUser();
      const ref = await createReference();
      const priv = await createDefinition(owner, ref, { title: '비공개' });
      const pending = await pendingDefinition(owner, ref, { title: '검수중' });
      const publicOne = await pendingDefinition(owner, ref, {
        title: '공개됨',
      });
      await approve(publicOne.id).expect(200);
      const hiddenOne = await pendingDefinition(owner, ref, { title: '숨김' });
      await hide(hiddenOne.id).expect(200);
      const deletedOne = await createDefinition(owner, ref, {
        title: '삭제됨',
      });
      await http
        .delete(`/api/v1/me/mission-definitions/${deletedOne.id}`)
        .set(auth(owner.token))
        .expect(204);
      const adminTemplate = randomUUID();
      await db.query(
        `INSERT INTO mission_definitions
                (id, origin, title, category_id, difficulty_id, verification_method,
                 publication_status, base_points)
         VALUES ($1,'admin','관리자 템플릿',$2,$3,'sensor','public',500)`,
        [adminTemplate, ref.category, ref.difficulty],
      );

      const mine = await http
        .get('/api/v1/mission-definitions')
        .query({ scope: 'mine' })
        .set(auth(owner.token))
        .expect(200);
      expect(
        Object.fromEntries(
          mine.body.items.map((d) => [d.title, d.publicationStatus]),
        ),
      ).toEqual({
        비공개: 'private',
        검수중: 'review_pending',
        공개됨: 'public',
        숨김: 'hidden',
      });
      const filtered = await http
        .get('/api/v1/mission-definitions')
        .query({ scope: 'mine', status: 'private' })
        .set(auth(owner.token))
        .expect(200);
      expect(filtered.body.items.map((d) => d.id)).toEqual([priv.id]);

      const pub = await http
        .get('/api/v1/mission-definitions')
        .query({ categoryId: ref.category })
        .set(auth(other.token))
        .expect(200);
      expect(pub.body.items.map((d) => d.id).sort()).toEqual(
        [publicOne.id, adminTemplate].sort(),
      );
      const item = pub.body.items.find((d) => d.id === publicOne.id);
      expect(item.authorNickname).toEqual(expect.any(String));
      // 검수 상태는 작성자에게만 보임
      expect(item).not.toHaveProperty('publicationStatus');
      expect(pub.body.items.find((d) => d.id === adminTemplate)).toMatchObject({
        origin: 'admin',
        authorNickname: null,
      });
      expect(pending.id).toBeTruthy();
    });

    it('공개 목록은 카테고리·난이도로 거르고 최신순 커서 페이지네이션', async () => {
      const owner = await createUser();
      const reader = await createUser();
      const ref = await createReference();
      const otherRef = await createReference();
      const ids = [];
      for (let i = 0; i < 5; i++) {
        const d = await pendingDefinition(owner, ref, { title: `공개${i}` });
        await approve(d.id).expect(200);
        ids.push(d.id);
      }
      const unrelated = await pendingDefinition(owner, otherRef);
      await approve(unrelated.id).expect(200);

      const seen = [];
      let cursor;
      for (let page = 0; page < 5; page++) {
        const res = await http
          .get('/api/v1/mission-definitions')
          .query({
            categoryId: ref.category,
            difficultyId: ref.difficulty,
            limit: 2,
            ...(cursor ? { cursor } : {}),
          })
          .set(auth(reader.token))
          .expect(200);
        seen.push(...res.body.items.map((d) => d.id));
        cursor = res.body.nextCursor;
        if (!cursor) break;
      }
      expect(seen).toEqual([...ids].reverse());

      for (const query of [
        { limit: 0 },
        { limit: 51 },
        { scope: 'x' },
        { cursor: 'zzz' },
        { status: 'private' },
      ]) {
        await http
          .get('/api/v1/mission-definitions')
          .query(query)
          .set(auth(reader.token))
          .expect(400);
      }
    });

    it('상세: 공개된 원형은 누구나, 비공개는 작성자만, 검수 이력은 작성자에게만', async () => {
      const owner = await createUser();
      const other = await createUser();
      const ref = await createReference();
      const priv = await createDefinition(owner, ref);
      const rejected = await pendingDefinition(owner, ref);
      await reject(rejected.id, '사진 기준이 모호함').expect(200);
      const shared = await pendingDefinition(owner, ref);
      await approve(shared.id).expect(200);

      const own = await http
        .get(`/api/v1/mission-definitions/${priv.id}`)
        .set(auth(owner.token))
        .expect(200);
      expect(own.body.publicationStatus).toBe('private');
      await http
        .get(`/api/v1/mission-definitions/${priv.id}`)
        .set(auth(other.token))
        .expect(404);

      const history = await http
        .get(`/api/v1/mission-definitions/${rejected.id}`)
        .set(auth(owner.token))
        .expect(200);
      expect(history.body.reviews.map((r) => [r.decision, r.reason])).toEqual([
        ['rejected', '사진 기준이 모호함'],
        ['submitted', null],
      ]);

      const asStranger = await http
        .get(`/api/v1/mission-definitions/${shared.id}`)
        .set(auth(other.token))
        .expect(200);
      expect(asStranger.body).not.toHaveProperty('reviews');
      expect(asStranger.body).not.toHaveProperty('publicationStatus');
      await http
        .get('/api/v1/mission-definitions/not-a-uuid')
        .set(auth(owner.token))
        .expect(400);
    });
  });

  describe('수정과 삭제', () => {
    it('비공개·반려 상태에서만 수정하고, 검수 중·공개 중에는 잠금', async () => {
      const user = await createUser();
      const ref = await createReference();
      const fresh = await createReference();
      const patch = (id, payload) =>
        http
          .patch(`/api/v1/me/mission-definitions/${id}`)
          .set(auth(user.token))
          .send(payload);

      const definition = await createDefinition(user, ref, {
        targetValue: 5,
        targetUnit: '회',
      });
      const edited = await patch(definition.id, {
        title: '바뀐 제목',
        description: '',
        categoryId: fresh.category,
        difficultyId: fresh.difficulty,
        targetValue: 7,
      }).expect(200);
      expect(edited.body).toMatchObject({
        title: '바뀐 제목',
        description: null,
        categoryCode: fresh.categoryCode,
        targetValue: 7,
        targetUnit: '회',
      });
      await patch(definition.id, {}).expect(400);
      await patch(definition.id, { targetUnit: ' ' }).expect(400);
      await patch(definition.id, {
        categoryId: (await createReference({ isActive: false })).category,
      }).expect(422);

      await http
        .post(
          `/api/v1/me/mission-definitions/${definition.id}/publication-request`,
        )
        .set(auth(user.token))
        .expect(200);
      const locked = await patch(definition.id, {
        title: '검수 중 수정',
      }).expect(409);
      expect(locked.body.error).toMatchObject({
        code: 'DEFINITION_LOCKED',
        details: { status: 'review_pending' },
      });

      await reject(definition.id).expect(200);
      await patch(definition.id, { title: '반려 후 수정' }).expect(200);

      await http
        .post(
          `/api/v1/me/mission-definitions/${definition.id}/publication-request`,
        )
        .set(auth(user.token))
        .expect(200);
      await approve(definition.id).expect(200);
      await patch(definition.id, { title: '공개 후 수정' }).expect(409);
    });

    it('남의 원형은 수정·삭제·신청할 수 없음', async () => {
      const owner = await createUser();
      const other = await createUser();
      const ref = await createReference();
      const definition = await createDefinition(owner, ref);
      await http
        .patch(`/api/v1/me/mission-definitions/${definition.id}`)
        .set(auth(other.token))
        .send({ title: '남의 것' })
        .expect(404);
      await http
        .delete(`/api/v1/me/mission-definitions/${definition.id}`)
        .set(auth(other.token))
        .expect(404);
      await http
        .post(
          `/api/v1/me/mission-definitions/${definition.id}/publication-request`,
        )
        .set(auth(other.token))
        .expect(404);
    });

    it('삭제: 검수 중에는 거절, 그 외에는 소프트 삭제되어 목록에서 사라지고 이미 쓴 미션은 유지', async () => {
      const owner = await createUser();
      const ref = await createReference();
      const definition = await pendingDefinition(owner, ref);
      const locked = await http
        .delete(`/api/v1/me/mission-definitions/${definition.id}`)
        .set(auth(owner.token))
        .expect(409);
      expect(locked.body.error.code).toBe('DEFINITION_LOCKED');

      await approve(definition.id).expect(200);
      const created = await http
        .post('/api/v1/missions')
        .set(auth(owner.token))
        .send({
          definitionId: definition.id,
          scheduledDates: [addDays(kstDate(), 1)],
        })
        .expect(201);
      await http
        .delete(`/api/v1/me/mission-definitions/${definition.id}`)
        .set(auth(owner.token))
        .expect(204);
      await http
        .delete(`/api/v1/me/mission-definitions/${definition.id}`)
        .set(auth(owner.token))
        .expect(404);
      await http
        .get(`/api/v1/mission-definitions/${definition.id}`)
        .set(auth(owner.token))
        .expect(404);

      const pub = await http
        .get('/api/v1/mission-definitions')
        .query({ categoryId: ref.category })
        .set(auth(owner.token))
        .expect(200);
      expect(pub.body.items).toEqual([]);
      const mission = await http
        .get(`/api/v1/missions/${created.body.items[0].id}`)
        .set(auth(owner.token))
        .expect(200);
      expect(mission.body.title).toBe('아침 스트레칭');
      await http
        .post('/api/v1/missions')
        .set(auth(owner.token))
        .send({
          definitionId: definition.id,
          scheduledDates: [addDays(kstDate(), 2)],
        })
        .expect(404);
    });
  });

  describe('공개 검수', () => {
    it('신청 → 승인: 상태와 검수 이력, 감사 로그가 함께 남고 다른 사용자가 미션에 쓸 수 있음', async () => {
      const owner = await createUser();
      const other = await createUser();
      const ref = await createReference();
      const definition = await createDefinition(owner, ref);

      const requested = await http
        .post(
          `/api/v1/me/mission-definitions/${definition.id}/publication-request`,
        )
        .set(auth(owner.token))
        .expect(200);
      expect(requested.body.publicationStatus).toBe('review_pending');
      const again = await http
        .post(
          `/api/v1/me/mission-definitions/${definition.id}/publication-request`,
        )
        .set(auth(owner.token))
        .expect(409);
      expect(again.body.error.code).toBe('ADMIN_STATE_CONFLICT');

      // 승인 전에는 다른 사용자가 쓸 수 없음
      await http
        .post('/api/v1/missions')
        .set(auth(other.token))
        .send({
          definitionId: definition.id,
          scheduledDates: [addDays(kstDate(), 1)],
        })
        .expect(404);

      const res = await approve(definition.id).expect(200);
      expect(res.body).toMatchObject({
        id: definition.id,
        publicationStatus: 'public',
      });
      expect(await statusOf(definition.id)).toBe('public');
      expect(await reviewsOf(definition.id)).toEqual([
        {
          decision: 'submitted',
          reason: null,
          reviewed_by_admin_id: null,
          requested_by_user_id: owner.id,
        },
        {
          decision: 'approved',
          reason: APPROVE_REASON,
          reviewed_by_admin_id: adminId,
          requested_by_user_id: owner.id,
        },
      ]);
      const { rows } = await db.query(
        `SELECT action, result, target_user_id, before_value, after_value
           FROM admin_audit_logs WHERE admin_id = $1 AND action = 'mission_definition.review'
            AND target_user_id = $2`,
        [adminId, owner.id],
      );
      expect(rows).toEqual([
        {
          action: 'mission_definition.review',
          result: 'success',
          target_user_id: owner.id,
          before_value: { publicationStatus: 'review_pending' },
          after_value: { publicationStatus: 'public' },
        },
      ]);

      const mission = await http
        .post('/api/v1/missions')
        .set(auth(other.token))
        .send({
          definitionId: definition.id,
          scheduledDates: [addDays(kstDate(), 1)],
        })
        .expect(201);
      expect(mission.body.items[0].reward).toEqual({
        points: 60,
        userXp: 6,
        petXp: 3,
      });
    });

    it('반려는 사유가 필수이고, 고쳐서 다시 신청하면 이력이 쌓임', async () => {
      const owner = await createUser();
      const ref = await createReference();
      const definition = await pendingDefinition(owner, ref);

      for (const payload of [{}, { reason: '' }, { reason: '   ' }]) {
        await adminPost(
          `/admin/v1/mission-definitions/${definition.id}/reviews`,
          { decision: 'rejected', ...payload },
        ).expect(400);
      }
      const res = await reject(definition.id, '설명이 부족함').expect(200);
      expect(res.body.publicationStatus).toBe('rejected');
      await http
        .post(
          `/api/v1/me/mission-definitions/${definition.id}/publication-request`,
        )
        .set(auth(owner.token))
        .expect(200);
      await approve(definition.id).expect(200);

      expect(
        (await reviewsOf(definition.id)).map((r) => [r.decision, r.reason]),
      ).toEqual([
        ['submitted', null],
        ['rejected', '설명이 부족함'],
        ['submitted', null],
        ['approved', APPROVE_REASON],
      ]);
    });

    it('숨김은 공개 중·검수 중 원형에 가능하고 새 사용만 막으며 기존 미션은 유지', async () => {
      const owner = await createUser();
      const other = await createUser();
      const ref = await createReference();
      const definition = await pendingDefinition(owner, ref);
      await approve(definition.id).expect(200);
      const created = await http
        .post('/api/v1/missions')
        .set(auth(other.token))
        .send({
          definitionId: definition.id,
          scheduledDates: [addDays(kstDate(), 1)],
        })
        .expect(201);

      await adminPost(
        `/admin/v1/mission-definitions/${definition.id}/reviews`,
        { decision: 'hidden' },
      ).expect(400);
      const res = await hide(definition.id, '신고가 접수됨').expect(200);
      expect(res.body.publicationStatus).toBe('hidden');
      await http
        .post('/api/v1/missions')
        .set(auth(other.token))
        .send({
          definitionId: definition.id,
          scheduledDates: [addDays(kstDate(), 2)],
        })
        .expect(404);
      await http
        .get(`/api/v1/missions/${created.body.items[0].id}`)
        .set(auth(other.token))
        .expect(200);
      await http
        .get(`/api/v1/mission-definitions/${definition.id}`)
        .set(auth(other.token))
        .expect(404);

      const pending = await pendingDefinition(owner, ref);
      await hide(pending.id).expect(200);
      expect(await statusOf(pending.id)).toBe('hidden');
    });

    it('허용되지 않은 전이와 없는 원형은 거절', async () => {
      const owner = await createUser();
      const ref = await createReference();
      const priv = await createDefinition(owner, ref);

      for (const call of [
        () => approve(priv.id),
        () => reject(priv.id),
        () => hide(priv.id),
      ]) {
        const res = await call().expect(409);
        expect(res.body.error).toMatchObject({
          code: 'ADMIN_STATE_CONFLICT',
          details: { status: 'private' },
        });
      }
      const done = await pendingDefinition(owner, ref);
      await approve(done.id).expect(200);
      await approve(done.id).expect(409);
      await reject(done.id).expect(409);

      await approve(randomUUID()).expect(404);
      await adminPost('/admin/v1/mission-definitions/not-a-uuid/reviews', {
        decision: 'approved',
        reason: '승인',
      }).expect(400);
      // 관리자 템플릿은 검수 대상이 아님
      const template = randomUUID();
      await db.query(
        `INSERT INTO mission_definitions
                (id, origin, title, category_id, difficulty_id, verification_method, publication_status)
         VALUES ($1,'admin','템플릿',$2,$3,'sensor','public')`,
        [template, ref.category, ref.difficulty],
      );
      await hide(template).expect(404);
    });

    it('검수 대기열은 오래된 순서로 커서 페이지네이션하고 상태로 거를 수 있음', async () => {
      const owner = await createUser();
      const ref = await createReference();
      const queued = [];
      for (let i = 0; i < 3; i++)
        queued.push(
          (await pendingDefinition(owner, ref, { title: `대기${i}` })).id,
        );
      const done = await pendingDefinition(owner, ref, { title: '처리됨' });
      await approve(done.id).expect(200);

      const mineOnly = (items) =>
        items.filter((d) => d.authorId === owner.id).map((d) => d.id);
      const seen = [];
      for (let page = 1; page <= 200; page++) {
        const res = await http
          .get('/admin/v1/mission-definitions')
          .query({
            origin: 'user',
            publicationStatus: 'review_pending',
            sort: 'createdAt,asc',
            size: 100,
            page,
          })
          .set(auth(adminToken))
          .expect(200);
        seen.push(...mineOnly(res.body.items));
        for (const item of res.body.items)
          expect(item.publicationStatus).toBe('review_pending');
        if (page * res.body.size >= res.body.totalCount) break;
      }
      expect(seen).toEqual(queued);

      const approved = await http
        .get('/admin/v1/mission-definitions')
        .query({ origin: 'user', publicationStatus: 'public', size: 100 })
        .set(auth(adminToken))
        .expect(200);
      expect(approved.body.items.map((d) => d.id)).toContain(done.id);
      const item = approved.body.items.find((d) => d.id === done.id);
      expect(item).toMatchObject({ authorId: owner.id, title: '처리됨' });
      expect(item.submittedAt).toEqual(expect.any(String));
      await http
        .get('/admin/v1/mission-definitions')
        .query({ publicationStatus: 'x' })
        .set(auth(adminToken))
        .expect(400);
    });

    it('관리자 토큰만 접근할 수 있음', async () => {
      const user = await createUser();
      const ref = await createReference();
      const definition = await pendingDefinition(user, ref);
      await http
        .get('/admin/v1/mission-definitions')
        .set(auth(user.token))
        .expect(401);
      await http
        .post(`/admin/v1/mission-definitions/${definition.id}/reviews`)
        .set(auth(user.token))
        .set('Idempotency-Key', randomUUID())
        .expect(401);
      await http.get('/admin/v1/mission-definitions').expect(401);
      // 사용자 API에는 관리자 토큰을 쓸 수 없음
      await http
        .get('/api/v1/mission-definitions')
        .set(auth(adminToken))
        .expect(401);
      expect(await statusOf(definition.id)).toBe('review_pending');
    });
  });

  describe('Idempotency-Key', () => {
    it('키가 없거나 형식이 틀리면 거절', async () => {
      const owner = await createUser();
      const ref = await createReference();
      const definition = await pendingDefinition(owner, ref);
      for (const key of [null, 'short', 'a'.repeat(129), 'has space in key']) {
        const res = await approve(definition.id, key).expect(400);
        expect(res.body.error.code).toBe('COMMON_VALIDATION_FAILED');
      }
      expect(await statusOf(definition.id)).toBe('review_pending');
    });

    it('같은 키로 다시 보내면 처리하지 않고 저장된 응답을 재생', async () => {
      const owner = await createUser();
      const ref = await createReference();
      const definition = await pendingDefinition(owner, ref);
      const key = randomUUID();

      const first = await approve(definition.id, key).expect(200);
      const second = await approve(definition.id, key).expect(200);
      expect(second.body).toEqual(first.body);
      expect(
        (await reviewsOf(definition.id)).filter(
          (r) => r.decision === 'approved',
        ),
      ).toHaveLength(1);
      const { rows } = await db.query(
        `SELECT status, response_status FROM admin_idempotency_keys WHERE admin_id = $1 AND idempotency_key = $2`,
        [adminId, key],
      );
      expect(rows).toEqual([{ status: 'completed', response_status: 200 }]);

      // 새 키로 같은 처리를 보내면 상태 전이 오류
      await approve(definition.id, randomUUID()).expect(409);
    });

    it('같은 키로 다른 요청을 보내면 409', async () => {
      const owner = await createUser();
      const ref = await createReference();
      const a = await pendingDefinition(owner, ref);
      const b = await pendingDefinition(owner, ref);
      const key = randomUUID();
      await approve(a.id, key).expect(200);

      for (const call of [
        () => approve(b.id, key),
        () => reject(a.id, '사유', key),
      ]) {
        const res = await call().expect(409);
        expect(res.body.error.code).toBe('COMMON_IDEMPOTENCY_KEY_REUSED');
      }
      expect(await statusOf(b.id)).toBe('review_pending');
    });

    it('거절된 요청(4xx)은 같은 키로 보내면 같은 오류를 재생', async () => {
      const owner = await createUser();
      const ref = await createReference();
      const definition = await createDefinition(owner, ref); // private라 승인 불가
      const key = randomUUID();

      const first = await approve(definition.id, key).expect(409);
      // 상태가 바뀐 뒤에도 같은 키는 처음 응답을 재생
      await http
        .post(
          `/api/v1/me/mission-definitions/${definition.id}/publication-request`,
        )
        .set(auth(owner.token))
        .expect(200);
      const replay = await approve(definition.id, key).expect(409);
      expect(replay.body.error.code).toBe(first.body.error.code);
      expect(await statusOf(definition.id)).toBe('review_pending');
      const { rows } = await db.query(
        `SELECT status, response_status FROM admin_idempotency_keys WHERE admin_id = $1 AND idempotency_key = $2`,
        [adminId, key],
      );
      expect(rows).toEqual([{ status: 'failed', response_status: 409 }]);
    });

    it('동시에 같은 키로 여러 번 보내도 한 번만 처리', async () => {
      const owner = await createUser();
      const ref = await createReference();
      const definition = await pendingDefinition(owner, ref);
      const key = randomUUID();
      const results = await Promise.all(
        [1, 2, 3, 4].map(() => approve(definition.id, key)),
      );

      expect(results.some((r) => r.status === 200)).toBe(true);
      // 나머지는 재생(200)이거나 처리 중(409 request_in_progress)
      for (const r of results.filter((r) => r.status !== 200)) {
        expect(r.body.error.code).toBe('COMMON_REQUEST_IN_PROGRESS');
      }
      expect(
        (await reviewsOf(definition.id)).filter(
          (r) => r.decision === 'approved',
        ),
      ).toHaveLength(1);
    });

    it('처리 중으로 남은 요청: 최근이면 409, 오래 멈췄으면 같은 키로 다시 실행, 다른 요청에는 쓸 수 없음', async () => {
      const owner = await createUser();
      const ref = await createReference();
      const definition = await pendingDefinition(owner, ref);
      // 서버가 호출하는 것과 같은 방식으로 요청 해시를 계산
      const hashOf = (id) =>
        sha256Hex(
          `mission_definition.review\n{"action":"approve","definitionId":"${id}","reason":"${APPROVE_REASON}"}`,
        );
      const insertInProgress = (key, requestHash, age) =>
        db.query(
          `INSERT INTO admin_idempotency_keys
                  (id, admin_id, idempotency_key, operation, request_hash, created_at)
           VALUES ($1,$2,$3,'mission_definition.review',$4, now() - $5::interval)`,
          [randomUUID(), adminId, key, requestHash, age],
        );

      const recent = randomUUID();
      await insertInProgress(recent, hashOf(definition.id), '1 minute');
      const busy = await approve(definition.id, recent).expect(409);
      expect(busy.body.error.code).toBe('COMMON_REQUEST_IN_PROGRESS');
      expect(await statusOf(definition.id)).toBe('review_pending');

      const stale = randomUUID();
      await insertInProgress(stale, hashOf(definition.id), '10 minutes');
      await approve(definition.id, stale).expect(200);
      expect(await statusOf(definition.id)).toBe('public');
      const { rows } = await db.query(
        `SELECT status FROM admin_idempotency_keys WHERE admin_id = $1 AND idempotency_key = $2`,
        [adminId, stale],
      );
      expect(rows).toEqual([{ status: 'completed' }]);

      // 요청 내용이 다르면 오래된 행이라도 재사용 거절
      const other = await pendingDefinition(owner, ref);
      const mismatch = randomUUID();
      await insertInProgress(mismatch, hashOf(definition.id), '10 minutes');
      await approve(other.id, mismatch).expect(409);
    });

    it('키는 관리자별로 구분', async () => {
      const owner = await createUser();
      const ref = await createReference();
      const definition = await pendingDefinition(owner, ref);
      const key = randomUUID();
      const other = randomUUID();
      await db.query(
        `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
        [other, `df2_${next()}`, `${other}@example.com`],
      );
      await db.query(
        `INSERT INTO admin_idempotency_keys (id, admin_id, idempotency_key, operation, request_hash)
         VALUES ($1,$2,$3,'mission_definition.review','x')`,
        [randomUUID(), other, key],
      );
      // 다른 관리자가 같은 키를 이미 썼어도 영향 없음
      await approve(definition.id, key).expect(200);
    });
  });

  describe('이용 제한', () => {
    it('제한 중에는 만들기·검수 신청을 막고 조회·수정·삭제는 허용', async () => {
      const user = await createUser();
      const ref = await createReference();
      const mine = await createDefinition(user, ref);
      const toDelete = await createDefinition(user, ref);
      await db.query(
        `INSERT INTO account_actions
                (id, user_id, admin_id, action_type, reason, starts_at, ends_at)
         VALUES ($1,$2,$3,'restriction','사유', now() - interval '1 hour', now() + interval '1 hour')`,
        [randomUUID(), user.id, adminId],
      );

      for (const call of [
        () =>
          http
            .post('/api/v1/me/mission-definitions')
            .set(auth(user.token))
            .send(definitionBody(ref)),
        () =>
          http
            .post(
              `/api/v1/me/mission-definitions/${mine.id}/publication-request`,
            )
            .set(auth(user.token)),
      ]) {
        const res = await call().expect(403);
        expect(res.body.error.code).toBe('AUTH_ACCOUNT_RESTRICTED');
      }
      await http
        .get('/api/v1/mission-definitions')
        .query({ scope: 'mine' })
        .set(auth(user.token))
        .expect(200);
      await http
        .patch(`/api/v1/me/mission-definitions/${mine.id}`)
        .set(auth(user.token))
        .send({ title: '수정' })
        .expect(200);
      await http
        .delete(`/api/v1/me/mission-definitions/${toDelete.id}`)
        .set(auth(user.token))
        .expect(204);
    });
  });
});
