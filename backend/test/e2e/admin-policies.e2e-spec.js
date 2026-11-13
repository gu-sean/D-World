import { createTestApp } from '../support/app.js';
import { randomInt, randomUUID } from 'node:crypto';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { DatabaseService } from '../../src/database/database.service.js';

const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);
const DAY = 24 * 60 * 60 * 1000;
const future = (days = 1) => new Date(Date.now() + days * DAY).toISOString();

describe.skipIf(!databaseUrl)('관리자 핵심 정책 API (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let adminId;
  let adminToken;
  let userToken;

  const tx = (fn) => db.withTransaction(fn);
  // 모든 관리자 변경 요청에는 reason이 필요 (팀 문서 09 §0-4)
  const withReason = (body) =>
    body && typeof body === 'object' && !('reason' in body)
      ? { ...body, reason: '테스트 사유' }
      : body;
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const post = (path, body, key = randomUUID()) => {
    const req = http.post(path).set(auth(adminToken));
    if (key !== null) req.set('Idempotency-Key', key);
    return req.send(withReason(body));
  };
  const patch = (path, body, key = randomUUID()) =>
    http
      .patch(path)
      .set(auth(adminToken))
      .set('Idempotency-Key', key)
      .send(withReason(body));
  const get = (path, query = {}) =>
    http.get(path).set(auth(adminToken)).query(query);

  async function newCategory(suffix = '') {
    const res = await post('/admin/v1/goal-categories', {
      code: `apc${RUN}${suffix}${randomInt(1000, 9999)}`,
      name: `정책카테고리${RUN}${suffix}${randomInt(1000, 9999)}`,
      displayOrder: 1,
    }).expect(201);
    return res.body;
  }
  async function newDifficulty() {
    const res = await post('/admin/v1/difficulty-levels', {
      code: `apd${RUN}${randomInt(1000, 9999)}`,
      name: `정책난이도${RUN}${randomInt(1000, 9999)}`,
      displayOrder: 1,
    }).expect(201);
    return res.body;
  }

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());

    adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `pl_${RUN}`, `${adminId}@example.com`],
    );
    const adminSession = await tx((t) =>
      app.get(SessionsService).create(t, 'admin', adminId),
    );
    adminToken = await app
      .get(AccessTokenService)
      .issue('admin', adminId, adminSession.sessionId);

    const userId = randomUUID();
    await db.query('INSERT INTO users (id) VALUES ($1)', [userId]);
    const session = await tx((t) =>
      app.get(SessionsService).create(t, 'user', userId),
    );
    userToken = await app
      .get(AccessTokenService)
      .issue('user', userId, session.sessionId);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('공통', () => {
    it('관리자 토큰이 없으면 401, 변경에는 Idempotency-Key가 필요', async () => {
      await http
        .get('/admin/v1/goal-categories')
        .set(auth(userToken))
        .expect(401);
      await http
        .post('/admin/v1/goal-categories')
        .set(auth(userToken))
        .set('Idempotency-Key', randomUUID())
        .send({ code: 'x', name: 'x', displayOrder: 0 })
        .expect(401);
      const missing = await post(
        '/admin/v1/goal-categories',
        { code: `nokey${RUN}`, name: `키없음${RUN}`, displayOrder: 0 },
        null,
      ).expect(400);
      expect(missing.body.error.code).toBe('COMMON_VALIDATION_FAILED');
    });

    it('같은 키로 다시 보내면 저장된 응답을 재생하고 내용이 다르면 409', async () => {
      const key = randomUUID();
      const body = {
        code: `replay${RUN}`,
        name: `재생${RUN}`,
        displayOrder: 3,
      };
      const first = await post('/admin/v1/goal-categories', body, key).expect(
        201,
      );
      const replay = await post('/admin/v1/goal-categories', body, key).expect(
        201,
      );
      expect(replay.body).toEqual(first.body);
      const { rows } = await db.query(
        'SELECT 1 FROM goal_categories WHERE code = $1',
        [body.code],
      );
      expect(rows).toHaveLength(1);
      await post(
        '/admin/v1/goal-categories',
        { ...body, displayOrder: 4 },
        key,
      ).expect(409);
    });
  });

  describe('카테고리·난이도', () => {
    it('만들기, 코드·이름 중복 409, 형식 오류 400, 목록 정렬', async () => {
      const created = await newCategory();
      expect(created).toMatchObject({ displayOrder: 1, isActive: true });

      const duplicateCode = await post('/admin/v1/goal-categories', {
        code: created.code,
        name: `다른이름${RUN}${randomInt(1000, 9999)}`,
        displayOrder: 1,
      }).expect(409);
      expect(duplicateCode.body.error.code).toBe('CODE_TAKEN');
      const duplicateName = await post('/admin/v1/goal-categories', {
        code: `other${RUN}${randomInt(1000, 9999)}`,
        name: created.name,
        displayOrder: 1,
      }).expect(409);
      expect(duplicateName.body.error.code).toBe('NAME_TAKEN');

      for (const body of [
        { code: 'Upper', name: '이름', displayOrder: 1 },
        { code: '1abc', name: '이름', displayOrder: 1 },
        { code: 'ok_code', name: '   ', displayOrder: 1 },
        { code: 'ok_code', name: '이름', displayOrder: -1 },
        { code: 'ok_code', name: '이름' },
      ]) {
        await post('/admin/v1/goal-categories', body).expect(400);
      }

      const list = await get('/admin/v1/goal-categories').expect(200);
      expect(list.body.some((i) => i.id === created.id)).toBe(true);
      const orders = list.body.map((i) => i.displayOrder);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    });

    it('이름·순서·활성 여부 수정, 바꿀 항목이 없으면 400, 없는 항목은 404', async () => {
      const created = await newDifficulty();
      const updated = await patch(`/admin/v1/difficulty-levels/${created.id}`, {
        name: `바뀐이름${RUN}${randomInt(1000, 9999)}`,
        displayOrder: 7,
        isActive: false,
      }).expect(200);
      expect(updated.body).toMatchObject({
        id: created.id,
        code: created.code,
        displayOrder: 7,
        isActive: false,
      });
      expect(updated.body.name).not.toBe(created.name);

      await patch(`/admin/v1/difficulty-levels/${created.id}`, {}).expect(400);
      await patch(`/admin/v1/difficulty-levels/${randomUUID()}`, {
        displayOrder: 1,
      }).expect(404);
      await patch('/admin/v1/difficulty-levels/not-a-uuid', {
        displayOrder: 1,
      }).expect(400);

      const other = await newDifficulty();
      const clash = await patch(`/admin/v1/difficulty-levels/${other.id}`, {
        name: updated.body.name,
      }).expect(409);
      expect(clash.body.error.code).toBe('NAME_TAKEN');
    });
  });

  describe('보상표', () => {
    it('버전 번호가 이어지고 최신순으로 조회, 비활성·없는 항목·과거 시행 시각은 거절', async () => {
      const category = await newCategory();
      const difficulty = await newDifficulty();
      const body = {
        categoryId: category.id,
        difficultyId: difficulty.id,
        points: 100,
        userXp: 10,
        petXp: 20,
      };

      const first = await post('/admin/v1/mission-reward-rates', body).expect(
        201,
      );
      expect(first.body).toMatchObject({
        versionNo: 1,
        points: 100,
        userXp: 10,
        petXp: 20,
      });
      const second = await post('/admin/v1/mission-reward-rates', {
        ...body,
        points: 150,
        effectiveAt: future(2),
      }).expect(201);
      expect(second.body.versionNo).toBe(2);

      const list = await get('/admin/v1/mission-reward-rates', {
        categoryId: category.id,
        difficultyId: difficulty.id,
      }).expect(200);
      expect(list.body.map((i) => i.versionNo)).toEqual([2, 1]);

      // 미션 생성이 첫 버전(시행 중)을 쓰는지는 DB의 작성자 기록으로 확인
      const { rows } = await db.query(
        'SELECT created_by_admin_id FROM mission_reward_rate_versions WHERE id = $1',
        [first.body.id],
      );
      expect(rows[0].created_by_admin_id).toBe(adminId);

      const past = await post('/admin/v1/mission-reward-rates', {
        ...body,
        effectiveAt: new Date(Date.now() - 2 * DAY).toISOString(),
      }).expect(422);
      expect(past.body.error.code).toBe('EFFECTIVE_AT_IN_PAST');
      expect(
        (
          await post('/admin/v1/mission-reward-rates', {
            ...body,
            categoryId: randomUUID(),
          }).expect(404)
        ).body.error.code,
      ).toBe('CATALOG_NOT_FOUND');
      for (const bad of [
        { points: -1 },
        { points: 1.5 },
        { userXp: 'a' },
        { effectiveAt: 'tomorrow' },
        { difficultyId: 'x' },
      ]) {
        await post('/admin/v1/mission-reward-rates', {
          ...body,
          ...bad,
        }).expect(400);
      }

      await patch(`/admin/v1/goal-categories/${category.id}`, {
        isActive: false,
      }).expect(200);
      const inactive = await post(
        '/admin/v1/mission-reward-rates',
        body,
      ).expect(422);
      expect(inactive.body.error.code).toBe('CATALOG_INACTIVE');
    });

    it('같은 조합에 동시에 추가해도 버전 번호가 겹치지 않음', async () => {
      const category = await newCategory();
      const difficulty = await newDifficulty();
      const body = {
        categoryId: category.id,
        difficultyId: difficulty.id,
        points: 1,
        userXp: 0,
        petXp: 0,
      };
      const responses = await Promise.all([
        post('/admin/v1/mission-reward-rates', body),
        post('/admin/v1/mission-reward-rates', body),
        post('/admin/v1/mission-reward-rates', body),
      ]);
      expect(responses.map((r) => r.status)).toEqual([201, 201, 201]);
      expect(responses.map((r) => r.body.versionNo).sort()).toEqual([1, 2, 3]);
    });
  });

  describe('판정 기준', () => {
    it('카테고리·인증 방식별로 버전을 추가하고 조회', async () => {
      const category = await newCategory();
      const rules = {
        minSteps: 3000,
        window: { start: '06:00', end: '22:00' },
      };
      const camera = await post('/admin/v1/verification-criteria', {
        categoryId: category.id,
        verificationMethod: 'camera',
        rules,
      }).expect(201);
      expect(camera.body).toMatchObject({
        versionNo: 1,
        verificationMethod: 'camera',
        rules,
      });
      const sensor = await post('/admin/v1/verification-criteria', {
        categoryId: category.id,
        verificationMethod: 'sensor',
        rules: {},
      }).expect(201);
      expect(sensor.body.versionNo).toBe(1);
      const next = await post('/admin/v1/verification-criteria', {
        categoryId: category.id,
        verificationMethod: 'camera',
        rules: { minSteps: 1 },
        effectiveAt: future(),
      }).expect(201);
      expect(next.body.versionNo).toBe(2);

      const list = await get('/admin/v1/verification-criteria', {
        categoryId: category.id,
        method: 'camera',
      }).expect(200);
      expect(list.body.map((i) => i.versionNo)).toEqual([2, 1]);
      expect(list.body[1].rules).toEqual(rules);

      for (const bad of [
        { rules: [] },
        { rules: 'x' },
        { rules: { unknownKey: 1 } },
        { rules: { minSteps: -5 } },
        { verificationMethod: 'audio' },
        { categoryId: 'x' },
      ]) {
        await post('/admin/v1/verification-criteria', {
          categoryId: category.id,
          verificationMethod: 'camera',
          rules: {},
          ...bad,
        }).expect(400);
      }
      await post('/admin/v1/verification-criteria', {
        categoryId: randomUUID(),
        verificationMethod: 'camera',
        rules: {},
      }).expect(404);
    });
  });

  describe('스트릭 마일스톤 금액', () => {
    it('기준 일수는 7·30·100만, 시행 예정 버전을 추가하고 기준별로 조회', async () => {
      const first = await post('/admin/v1/streak-milestone-policies', {
        targetSuccessDays: 30,
        points: 300,
        userXp: 20,
        petXp: 10,
        effectiveAt: future(30),
      }).expect(201);
      expect(first.body).toMatchObject({ userXp: 20, petXp: 10 });
      const second = await post('/admin/v1/streak-milestone-policies', {
        targetSuccessDays: 30,
        points: 400,
        userXp: 0,
        petXp: 0,
        effectiveAt: future(60),
      }).expect(201);
      expect(second.body.versionNo).toBe(first.body.versionNo + 1);

      const list = await get('/admin/v1/streak-milestone-policies').expect(200);
      const mine = list.body.items.filter((i) =>
        [first.body.id, second.body.id].includes(i.id),
      );
      expect(mine.map((i) => i.points)).toEqual([400, 300]);
      expect(mine[1]).toMatchObject({ userXp: 20, petXp: 10 });

      for (const bad of [
        { targetSuccessDays: 8 },
        { targetSuccessDays: 'x' },
        { points: -5 },
        { points: 1e9 },
        { userXp: -1 },
        { petXp: 1e9 },
      ]) {
        await post('/admin/v1/streak-milestone-policies', {
          targetSuccessDays: 7,
          points: 1,
          userXp: 0,
          petXp: 0,
          ...bad,
        }).expect(400);
      }
    });
  });

  describe('월간 포인트 한도', () => {
    it('이번 달 이전은 거절하고 다음 달 이후만, 같은 달 중복은 409', async () => {
      const current = (
        await db.query(
          `SELECT date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date::text AS m`,
        )
      ).rows[0].m;
      const rejected = await post('/admin/v1/point-cap-policies', {
        effectiveMonth: current,
        monthlyLimitPoints: 5000,
      }).expect(422);
      expect(rejected.body.error.code).toBe('EFFECTIVE_MONTH_NOT_FUTURE');

      const month = `${randomInt(2200, 2900)}-${String(randomInt(1, 13)).padStart(2, '0')}-01`;
      const created = await post('/admin/v1/point-cap-policies', {
        effectiveMonth: month,
        monthlyLimitPoints: 7000,
      }).expect(201);
      expect(created.body).toMatchObject({
        effectiveMonth: month,
        monthlyLimitPoints: 7000,
      });
      const dup = await post('/admin/v1/point-cap-policies', {
        effectiveMonth: month,
        monthlyLimitPoints: 8000,
      }).expect(409);
      expect(dup.body.error.code).toBe('POLICY_EXISTS');

      const list = await get('/admin/v1/point-cap-policies').expect(200);
      expect(list.body.items.some((i) => i.id === created.body.id)).toBe(true);

      for (const effectiveMonth of ['2999-13-01', '2999-01-02', 'next', 5]) {
        await post('/admin/v1/point-cap-policies', {
          effectiveMonth,
          monthlyLimitPoints: 1,
        }).expect(400);
      }
      await post('/admin/v1/point-cap-policies', {
        effectiveMonth: month,
        monthlyLimitPoints: -1,
      }).expect(400);
    });
  });

  describe.each([
    ['user-levels', '사용자'],
    ['pet-levels', '펫'],
  ])('%s 레벨 정책', (kind) => {
    const path = `/admin/v1/policies/${kind}`;

    it('임곗값 표를 새 버전으로 추가(순서가 섞여도 정렬)하고 조회', async () => {
      const created = await post(path, {
        thresholds: [
          { levelNo: 3, minTotalXp: 500 },
          { levelNo: 1, minTotalXp: 0 },
          { levelNo: 2, minTotalXp: 100 },
        ],
        effectiveAt: future(5),
      }).expect(201);
      expect(created.body.thresholds).toEqual([
        { levelNo: 1, minTotalXp: 0 },
        { levelNo: 2, minTotalXp: 100 },
        { levelNo: 3, minTotalXp: 500 },
      ]);
      const list = await get(path).expect(200);
      const found = list.body.items.find((i) => i.id === created.body.id);
      expect(found.thresholds).toEqual(created.body.thresholds);
      expect(found.versionNo).toBe(created.body.versionNo);
    });

    it('1레벨부터 빠짐없이, 1레벨은 0 XP, 임곗값은 증가해야 함', async () => {
      const cases = [
        [{ levelNo: 1, minTotalXp: 10 }],
        [{ levelNo: 2, minTotalXp: 100 }],
        [
          { levelNo: 1, minTotalXp: 0 },
          { levelNo: 3, minTotalXp: 100 },
        ],
        [
          { levelNo: 1, minTotalXp: 0 },
          { levelNo: 2, minTotalXp: 0 },
        ],
        [
          { levelNo: 1, minTotalXp: 0 },
          { levelNo: 2, minTotalXp: 100 },
          { levelNo: 3, minTotalXp: 100 },
        ],
      ];
      for (const thresholds of cases) {
        const res = await post(path, {
          thresholds,
          effectiveAt: future(),
        }).expect(422);
        expect(res.body.error.code).toBe('INVALID_THRESHOLDS');
      }
      for (const bad of [
        { thresholds: [] },
        { thresholds: 'x' },
        { thresholds: [{ levelNo: 1 }] },
      ]) {
        await post(path, { effectiveAt: future(), ...bad }).expect(400);
      }
      // 실패한 요청은 정책 행을 남기지 않음
      const { rows } = await db.query(
        `SELECT count(*)::int AS n FROM ${kind === 'user-levels' ? 'user_level_policy_versions' : 'pet_level_policy_versions'}
          WHERE created_by_admin_id = $1`,
        [adminId],
      );
      expect(rows[0].n).toBe(1);
    });
  });

  describe('감사 로그와 준비 상태', () => {
    it('변경마다 감사 로그가 남음', async () => {
      const { rows } = await db.query(
        `SELECT action, result, after_value FROM admin_audit_logs
          WHERE admin_id = $1 AND action IN ('reward_rate.create', 'category.create',
                'difficulty.update', 'criteria.create', 'point_cap.create')
          ORDER BY recorded_at`,
        [adminId],
      );
      // 거절된 변경(중복·조건 위반 등)은 failure로 함께 남고, 성공한 변경은 모두 변경 내용을 가짐
      const succeeded = rows.filter((r) => r.result === 'success');
      const actions = new Set(succeeded.map((r) => r.action));
      expect(actions).toEqual(
        new Set([
          'reward_rate.create',
          'category.create',
          'difficulty.update',
          'criteria.create',
          'point_cap.create',
        ]),
      );
      expect(succeeded.every((r) => r.after_value)).toBe(true);
      // failure 행은 상태 코드와 오류 코드를 기록
      expect(
        rows
          .filter((r) => r.result === 'failure')
          .every(
            (r) => r.after_value?.statusCode >= 400 && r.after_value?.code,
          ),
      ).toBe(true);
    });
  });
});
