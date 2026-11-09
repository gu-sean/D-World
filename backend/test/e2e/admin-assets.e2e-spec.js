import { randomInt, randomUUID } from 'node:crypto';
import { createTestApp } from '../support/app.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { AchievementsService } from '../../src/achievements/achievements.service.js';
import { OBJECT_STORAGE } from '../../src/media/storage/object-storage.js';

// 관리자 업적(M76~M78)·펫 종류(M79~M81)·이미지 업로드(M84·M85)
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);
const REASON = '테스트 사유';

describe.skipIf(!databaseUrl)('관리자 업적·펫·이미지 API (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let storage;
  let adminId;
  let adminToken;
  let categoryCode;

  const auth = () => ({ Authorization: `Bearer ${adminToken}` });
  const get = (path) => http.get(path).set(auth());
  const post = (path, body = {}) =>
    http
      .post(path)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .send({ reason: REASON, ...body });

  /** 이미지 하나: 티켓 발급 → 업로드 모사 → 완료 */
  async function uploadAsset(assetKind, ownerId, mimeType = 'image/png') {
    const ticket = await post('/admin/v1/assets/upload-urls', {
      assetKind,
      ownerId,
      mimeType,
      sizeBytes: 1234,
    }).expect(201);
    const { rows } = await db.query(
      'SELECT object_key FROM admin_asset_uploads WHERE id = $1',
      [ticket.body.assetId],
    );
    storage.simulateUpload(rows[0].object_key, {
      size: 1234,
      contentType: mimeType,
    });
    const done = await http
      .post(`/admin/v1/assets/${ticket.body.assetId}/complete`)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .expect(200);
    expect(done.body.assetId).toBe(ticket.body.assetId);
    expect(done.body.imageUrl).toContain('memory://get/');
    return ticket.body.assetId;
  }

  const achievementBody = (extra) => ({
    code: `ach_${RUN}`,
    title: `업적${RUN}`,
    description: '설명',
    rarity: 'rare',
    conditionType: 'approved_mission_count',
    targetCount: 5,
    rewardPoints: 10,
    rewardUserXp: 20,
    rewardPetXp: 30,
    status: 'public',
    effectiveAt: new Date(Date.now() - 60_000).toISOString(),
    ...extra,
  });

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    storage = app.get(OBJECT_STORAGE);
    adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `as_${RUN}`, `${adminId}@example.com`],
    );
    const session = await db.withTransaction((tx) =>
      app.get(SessionsService).create(tx, 'admin', adminId),
    );
    adminToken = await app
      .get(AccessTokenService)
      .issue('admin', adminId, session.sessionId);
    categoryCode = `ca${RUN}`;
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order)
       VALUES ($1, $2, $3, 1)`,
      [randomUUID(), categoryCode, `분야${RUN}`],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('이미지 업로드 (M84·M85)', () => {
    it('2MB 초과·허용 안 하는 형식은 400', async () => {
      const base = {
        assetKind: 'badge',
        ownerId: randomUUID(),
        mimeType: 'image/png',
        sizeBytes: 100,
      };
      await post('/admin/v1/assets/upload-urls', {
        ...base,
        sizeBytes: 2 * 1024 * 1024 + 1,
      }).expect(400);
      await post('/admin/v1/assets/upload-urls', {
        ...base,
        mimeType: 'image/gif',
      }).expect(400);
    });

    it('저장소가 형식 뒤에 매개변수를 붙여도(image/png; charset=binary) 같은 형식으로 인정', async () => {
      const ticket = await post('/admin/v1/assets/upload-urls', {
        assetKind: 'badge',
        ownerId: randomUUID(),
        mimeType: 'image/png',
        sizeBytes: 321,
      }).expect(201);
      const { rows } = await db.query(
        'SELECT object_key FROM admin_asset_uploads WHERE id = $1',
        [ticket.body.assetId],
      );
      storage.simulateUpload(rows[0].object_key, {
        size: 321,
        contentType: 'IMAGE/PNG; charset=binary',
      });
      await http
        .post(`/admin/v1/assets/${ticket.body.assetId}/complete`)
        .set(auth())
        .set('Idempotency-Key', randomUUID())
        .expect(200);
      await http
        .post(`/admin/v1/assets/${randomUUID()}/complete`)
        .set(auth())
        .set('Idempotency-Key', randomUUID())
        .expect(404);
    });

    it('올리지 않고 완료하면 409, 크기·형식이 다르면 409', async () => {
      const ticket = await post('/admin/v1/assets/upload-urls', {
        assetKind: 'badge',
        ownerId: randomUUID(),
        mimeType: 'image/png',
        sizeBytes: 500,
      }).expect(201);
      const complete = () =>
        http
          .post(`/admin/v1/assets/${ticket.body.assetId}/complete`)
          .set(auth())
          .set('Idempotency-Key', randomUUID());
      expect((await complete()).status).toBe(409);
      const { rows } = await db.query(
        'SELECT object_key FROM admin_asset_uploads WHERE id = $1',
        [ticket.body.assetId],
      );
      storage.simulateUpload(rows[0].object_key, {
        size: 999,
        contentType: 'image/png',
      });
      expect((await complete()).status).toBe(409);
    });
  });

  describe('업적 (M76~M78)', () => {
    it('이미지 → 새 업적 → 새 버전, 이전 버전은 남고 현재 버전이 바뀜', async () => {
      const id = randomUUID();
      const first = await uploadAsset('badge', id);
      const created = await post(
        '/admin/v1/achievements',
        achievementBody({ badgeAssetId: first }),
      ).expect(201);
      expect(created.body).toMatchObject({
        id,
        code: `ach_${RUN}`,
        status: 'public',
        currentVersionNo: 1,
      });
      expect(created.body.versions[0]).toMatchObject({
        title: `업적${RUN}`,
        rewardUserXp: 20,
        rewardPetXp: 30,
        badgeAssetId: first,
      });

      const second = await uploadAsset('badge', id, 'image/webp');
      const { code: _code, ...versionBody } = achievementBody({
        badgeAssetId: second,
        title: '새 제목',
        targetCount: 10,
        status: 'draft',
      });
      const next = await post(
        `/admin/v1/achievements/${id}/versions`,
        versionBody,
      ).expect(201);
      expect(next.body.status).toBe('draft');
      expect(next.body.currentVersionNo).toBe(2);
      expect(next.body.versions.map((v) => v.versionNo)).toEqual([1, 2]);
      expect(next.body.versions[0].title).toBe(`업적${RUN}`);

      const list = await get('/admin/v1/achievements').expect(200);
      expect(list.body.map((a) => a.id)).toContain(id);
    });

    it('공개 버전만 소급 평가 요청이 쌓이고, 작업이 끝까지 처리하면 완료됨', async () => {
      const publicId = randomUUID();
      const publicAsset = await uploadAsset('badge', publicId);
      await post(
        '/admin/v1/achievements',
        achievementBody({
          code: `bf_${RUN}`,
          badgeAssetId: publicAsset,
          targetCount: 1_000_000,
        }),
      ).expect(201);
      const draftId = randomUUID();
      const draftAsset = await uploadAsset('badge', draftId);
      await post(
        '/admin/v1/achievements',
        achievementBody({
          code: `bfd_${RUN}`,
          badgeAssetId: draftAsset,
          status: 'draft',
        }),
      ).expect(201);

      const runs = async (id) =>
        (
          await db.query(
            'SELECT * FROM achievement_backfill_runs WHERE achievement_id = $1',
            [id],
          )
        ).rows;
      expect(await runs(draftId)).toHaveLength(0);
      const [run] = await runs(publicId);
      expect(run.completed_at).toBeNull();

      // 테스트 DB에는 회원이 많이 쌓여 있으므로 커서를 끝쪽으로 옮겨 남은 대상만 처리
      await db.query(
        `UPDATE achievement_backfill_runs
            SET cursor_user_id = (SELECT id FROM users ORDER BY id DESC OFFSET 30 LIMIT 1)
          WHERE achievement_id = $1`,
        [publicId],
      );
      const service = app.get(AchievementsService);
      const summary = await service.processBackfillRuns({
        runLimit: 50,
        batchSize: 10,
      });
      expect(summary.completed).toBeGreaterThanOrEqual(1);
      const [done] = await runs(publicId);
      expect(done.completed_at).not.toBeNull();
      expect(done.processed_users).toBeGreaterThan(0);
      expect(done.earned_count).toBe(0);
    });

    it('조건과 맞지 않는 값은 400, 같은 코드는 409', async () => {
      const id = randomUUID();
      const asset = await uploadAsset('badge', id);
      const bad = await post(
        '/admin/v1/achievements',
        achievementBody({
          code: `bad_${RUN}`,
          badgeAssetId: asset,
          conditionType: 'streak_milestone',
          targetCount: 5,
        }),
      ).expect(400);
      expect(bad.body.error.code).toBe('COMMON_VALIDATION_FAILED');
      await post(
        '/admin/v1/achievements',
        achievementBody({
          code: `bad2_${RUN}`,
          badgeAssetId: asset,
          conditionType: 'category_approved_mission_count',
        }),
      ).expect(400);

      const dupId = randomUUID();
      const dupAsset = await uploadAsset('badge', dupId);
      const dup = await post(
        '/admin/v1/achievements',
        achievementBody({ badgeAssetId: dupAsset }),
      ).expect(409);
      expect(dup.body.error.code).toBeDefined();
    });

    it('다른 업적에 올린 이미지는 쓸 수 없음', async () => {
      const ownerA = randomUUID();
      const asset = await uploadAsset('badge', ownerA);
      const { rows } = await db.query(
        'SELECT id FROM achievement_definitions LIMIT 1',
      );
      const { code: _code, ...versionBody } = achievementBody({
        badgeAssetId: asset,
      });
      const res = await post(
        `/admin/v1/achievements/${rows[0].id}/versions`,
        versionBody,
      ).expect(409);
      expect(res.body.error.code).toBe('ADMIN_STATE_CONFLICT');
    });
  });

  describe('펫 종류 (M79~M81)', () => {
    const speciesBody = (stageAssets, extra) => ({
      code: `pet_${RUN}`,
      name: `펫${RUN}`,
      description: '설명',
      personality: '활발함',
      worldText: '세계관',
      categoryCode,
      unlockConditionType: 'none',
      hatchMissionCount: 3,
      stages: [
        { stageNo: 1, minTotalXp: 0, bonusBasisPoints: 0 },
        { stageNo: 2, minTotalXp: 100, bonusBasisPoints: 500 },
        { stageNo: 3, minTotalXp: 500, bonusBasisPoints: 1000 },
      ].map((stage, index) => ({ ...stage, imageAssetId: stageAssets[index] })),
      status: 'public',
      effectiveAt: new Date(Date.now() - 60_000).toISOString(),
      ...extra,
    });

    async function uploadStages(id) {
      return [
        await uploadAsset('pet_stage', id),
        await uploadAsset('pet_stage', id, 'image/jpeg'),
        await uploadAsset('pet_stage', id, 'image/webp'),
      ];
    }

    it('단계 이미지 3장 → 새 종류 → 새 버전', async () => {
      const id = randomUUID();
      const created = await post(
        '/admin/v1/pet-species',
        speciesBody(await uploadStages(id)),
      ).expect(201);
      expect(created.body).toMatchObject({
        id,
        code: `pet_${RUN}`,
        currentVersionNo: 1,
      });
      const [version] = created.body.versions;
      expect(version.categoryCode).toBe(categoryCode);
      expect(version.stages.map((s) => s.stageCode)).toEqual([
        'egg',
        'baby',
        'adult',
      ]);
      expect(version.stages[0].imageUrl).toContain('memory://get/');

      const { code: _code, ...versionBody } = speciesBody(
        await uploadStages(id),
        {
          name: '새 이름',
          unlockConditionType: 'approved_mission_count',
          unlockTargetCount: 10,
        },
      );
      const next = await post(
        `/admin/v1/pet-species/${id}/versions`,
        versionBody,
      ).expect(201);
      expect(next.body.versions.map((v) => v.versionNo)).toEqual([1, 2]);
      expect(next.body.versions[1]).toMatchObject({
        name: '새 이름',
        unlockConditionType: 'approved_mission_count',
        unlockTargetCount: 10,
      });
      const list = await get('/admin/v1/pet-species').expect(200);
      expect(list.body.map((s) => s.id)).toContain(id);
    });

    it('해금 조건·단계 구성이 맞지 않으면 400', async () => {
      const id = randomUUID();
      const assets = await uploadStages(id);
      await post(
        '/admin/v1/pet-species',
        speciesBody(assets, {
          code: `bad_${RUN}`,
          unlockConditionType: 'streak_milestone',
          unlockTargetCount: 5,
        }),
      ).expect(400);
      const body = speciesBody(assets, { code: `bad2_${RUN}` });
      body.stages[2].minTotalXp = 50;
      await post('/admin/v1/pet-species', body).expect(400);
      const short = speciesBody(assets, { code: `bad3_${RUN}` });
      short.stages = short.stages.slice(0, 2);
      await post('/admin/v1/pet-species', short).expect(400);
    });
  });
});
