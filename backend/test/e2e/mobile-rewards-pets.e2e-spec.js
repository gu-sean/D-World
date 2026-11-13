import { randomBytes, randomInt } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { createTestApp } from '../support/app.js';
import { createUser } from '../support/users.js';
import { AchievementsService } from '../../src/achievements/achievements.service.js';
import { PointsService } from '../../src/points/points.service.js';

// 모바일 보상·펫 조회를 데이터가 있는 상태로 확인: 펫(A80~A85), 인벤토리(A72), 포인트 내역(A74), 업적(A76)
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)('모바일 펫·인벤토리·업적 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let adminId;
  let achievements;
  const createdAchievements = [];

  const auth = (user) => ({ Authorization: `Bearer ${user.token}` });
  const tag = () => randomBytes(5).toString('hex');

  async function createCategory() {
    const id = newId();
    const t = tag();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [id, `mr${t}`, `보상카테고리${t}`],
    );
    return { id, code: `mr${t}` };
  }

  /** 3단계를 갖춘 공개 펫 종류, 해금 조건 없으면 바로 선택 가능 */
  async function createSpecies({ unlockType = 'none', target = null } = {}) {
    const t = tag();
    const category = await createCategory();
    const speciesId = newId();
    const versionId = newId();
    const imageId = newId();
    await db.query(
      `INSERT INTO pet_species (id, code, name, status, created_by_admin_id)
       VALUES ($1,$2,$3,'public',$4)`,
      [speciesId, `sp${t}`, `종류${t}`, adminId],
    );
    await db.query(
      `INSERT INTO pet_species_versions
              (id, species_id, version_no, name, description, category_id,
               unlock_condition_type, unlock_target_count, hatch_mission_count,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,1,$3,'설명',$4,$5,$6,2, now() - interval '1 day',$7)`,
      [
        versionId,
        speciesId,
        `종류${t}`,
        category.id,
        unlockType,
        target,
        adminId,
      ],
    );
    await db.query(
      `INSERT INTO pet_stage_images
              (id, species_id, r2_object_key, mime_type, size_bytes, uploaded_at, created_by_admin_id)
       VALUES ($1,$2,$3,'image/png',10,now(),$4)`,
      [imageId, speciesId, `pet/${t}.png`, adminId],
    );
    for (const [stage, code, xp, bonus] of [
      [1, 'egg', 0, 0],
      [2, 'baby', 100, 500],
      [3, 'adult', 300, 1500],
    ]) {
      await db.query(
        `INSERT INTO pet_stage_versions
                (species_version_id, species_id, stage_no, stage_code, min_total_xp,
                 bonus_basis_points, image_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [versionId, speciesId, stage, code, xp, bonus, imageId],
      );
    }
    return { speciesId, versionId, categoryCode: category.code };
  }

  async function createItem(kind, price) {
    const id = newId();
    const t = tag();
    await db.query(
      `INSERT INTO shop_items (id, code, name, item_kind, display_order, is_active)
       VALUES ($1,$2,$3,$4,900,true)`,
      [id, `mi${t}`, `상품${t}`, kind],
    );
    await db.query(
      `INSERT INTO shop_item_price_versions
              (id, item_id, version_no, price_points, effective_at, created_by_admin_id)
       VALUES ($1,$2,1,$3, now() - interval '1 minute', $4)`,
      [newId(), id, price, adminId],
    );
    return { id, name: `상품${t}` };
  }

  async function fund(user, amount) {
    await db.withTransaction((tx) =>
      app.get(PointsService).manualAdjust(tx, {
        adminId,
        userId: user.id,
        kind: 'manual_grant',
        amount,
        reason: '테스트 지급',
      }),
    );
  }

  async function createApprovedMission(userId, categoryId, criteriaId) {
    const difficultyId = newId();
    const missionId = newId();
    const recordId = newId();
    const t = tag();
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [difficultyId, `md${t}`, `보상난이도${t}`],
    );
    await db.query(
      `INSERT INTO missions
              (id, user_id, source_type, title, category_id, difficulty_id,
               verification_method, scheduled_date)
       VALUES ($1,$2,'user','걷기',$3,$4,'sensor',CURRENT_DATE)`,
      [missionId, userId, categoryId, difficultyId],
    );
    await db.query(
      `INSERT INTO mission_records
              (id, mission_id, user_id, attempt_no, submission_no, status, evidence_kind, submitted_at)
       VALUES ($1,$2,$3,1,1,'submitted','sensor_summary', now())`,
      [recordId, missionId, userId],
    );
    await db.query(
      `INSERT INTO verification_results
              (id, record_id, result_no, source, decision, criteria_version_id, engine_version)
       VALUES ($1,$2,1,'ai','approved',$3,'model-v1')`,
      [newId(), recordId, criteriaId],
    );
    await db.query(`UPDATE missions SET status = 'completed' WHERE id = $1`, [
      missionId,
    ]);
  }

  async function createCriteria(categoryId) {
    const id = newId();
    await db.query(
      `INSERT INTO verification_criteria_versions
              (id, category_id, verification_method, version_no, rules_json, effective_at, created_by_admin_id)
       VALUES ($1,$2,'sensor',$3,'{}'::jsonb, now() - interval '1 day', $4)`,
      [id, categoryId, randomInt(1, 1_000_000_000), adminId],
    );
    return id;
  }

  async function createAchievement({ targetCount, rarity = 'common' }) {
    const t = tag();
    const def = newId();
    const image = newId();
    await db.query(
      `INSERT INTO achievement_definitions (id, code, status, created_by_admin_id)
       VALUES ($1,$2,'public',$3)`,
      [def, `ach_${t}`, adminId],
    );
    await db.query(
      `INSERT INTO achievement_badge_images
              (id, achievement_id, version_no, r2_object_key, mime_type, size_bytes,
               uploaded_at, created_by_admin_id)
       VALUES ($1,$2,1,$3,'image/png',10,now(),$4)`,
      [image, def, `badge/${t}`, adminId],
    );
    await db.query(
      `INSERT INTO achievement_versions
              (id, achievement_id, version_no, title, description, rarity,
               condition_type, target_count, reward_points, reward_user_xp,
               reward_pet_xp, badge_image_id, effective_at, created_by_admin_id)
       VALUES ($1,$2,1,'모바일 업적','설명',$3,'approved_mission_count',$4,25,0,0,$5,
               now() - interval '1 day',$6)`,
      [newId(), def, rarity, targetCount, image, adminId],
    );
    createdAchievements.push(def);
    return { id: def, code: `ach_${t}` };
  }

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    achievements = app.get(AchievementsService);
    adminId = newId();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash)
       VALUES ($1,$2,$3,'x')`,
      [adminId, `mr_${RUN}`, `${adminId.toLowerCase()}@example.com`],
    );

    // 펫을 고르려면 발효된 펫 레벨 정책이 있어야 한다. 시드된 DB에는 있지만 새로 마이그레이션한 DB에는 없으므로,
    // 없을 때만 넣는다. 다른 e2e 파일이 만드는 정책(1일 전)이 항상 더 최신이 되도록 아주 오래된 시각으로 둔다.
    const hasPetPolicy = await db.query(
      `SELECT 1 FROM pet_level_policy_versions WHERE effective_at <= now() LIMIT 1`,
    );
    if (hasPetPolicy.rowCount === 0) {
      const policyId = newId();
      await db.query(
        `INSERT INTO pet_level_policy_versions (id, version_no, effective_at, created_by_admin_id)
         VALUES ($1, $3, now() - interval '30 days', $2)`,
        [policyId, adminId, randomInt(1, 1_000_000_000)],
      );
      for (const [level, xp] of [
        [1, 0],
        [2, 40],
        [3, 120],
        [4, 400],
      ]) {
        await db.query(
          `INSERT INTO pet_level_thresholds (policy_version_id, level_no, min_total_xp)
           VALUES ($1, $2, $3)`,
          [policyId, level, xp],
        );
      }
    }
  });

  afterAll(async () => {
    // 공개 업적은 전역이라 다른 e2e 파일의 사용자도 달성하므로, 끝나면 숨겨서 영향을 남기지 않음
    if (createdAchievements.length > 0) {
      await db.query(
        `UPDATE achievement_definitions SET status = 'hidden' WHERE id = ANY($1::short_id[])`,
        [createdAchievements],
      );
    }
    await app.close();
  });

  describe('펫 (A80~A85)', () => {
    it('종류 목록·상세: 해금 조건과 단계 정보, 선택 전후 owned', async () => {
      const user = await createUser(app, db);
      const open = await createSpecies();
      const locked = await createSpecies({
        unlockType: 'approved_mission_count',
        target: 3,
      });

      const list = await http
        .get('/api/v1/pet-species')
        .set(auth(user))
        .expect(200);
      const openView = list.body.find((s) => s.id === open.speciesId);
      expect(openView).toMatchObject({
        categoryCode: open.categoryCode,
        unlockConditionType: 'always',
        unlocked: true,
        owned: false,
        hatchMissionCount: 2,
      });
      expect(openView.stages).toEqual([
        expect.objectContaining({ stageNo: 1, stageCode: 'egg', bonusRate: 0 }),
        expect.objectContaining({
          stageNo: 2,
          stageCode: 'baby',
          minTotalXp: 100,
          bonusRate: 0.05,
        }),
        expect.objectContaining({
          stageNo: 3,
          stageCode: 'adult',
          bonusRate: 0.15,
        }),
      ]);

      const lockedView = (
        await http
          .get(`/api/v1/pet-species/${locked.speciesId}`)
          .set(auth(user))
          .expect(200)
      ).body;
      expect(lockedView).toMatchObject({
        unlockConditionType: 'approved_mission_count',
        unlockTargetCount: 3,
        unlocked: false,
      });

      // 카테고리 필터
      const filtered = await http
        .get(`/api/v1/pet-species?categoryCode=${open.categoryCode}`)
        .set(auth(user))
        .expect(200);
      expect(filtered.body.map((s) => s.id)).toEqual([open.speciesId]);
    });

    it('알 선택(멱등) → 목록 → 대표 설정 → 단계 변화 기록', async () => {
      const user = await createUser(app, db);
      const species = await createSpecies();
      const key = newId();
      const body = { speciesId: species.speciesId, nickname: '모모' };

      const first = await http
        .post('/api/v1/me/pets')
        .set(auth(user))
        .set('Idempotency-Key', key)
        .send(body)
        .expect(201);
      const replay = await http
        .post('/api/v1/me/pets')
        .set(auth(user))
        .set('Idempotency-Key', key)
        .send(body)
        .expect(201);
      expect(replay.body).toEqual(first.body);
      const petId = first.body.id;

      const list = await http
        .get('/api/v1/me/pets')
        .set(auth(user))
        .expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({ id: petId, nickname: '모모' });

      const picked = await http
        .get(`/api/v1/pet-species/${species.speciesId}`)
        .set(auth(user))
        .expect(200);
      expect(picked.body.owned).toBe(true);

      const representative = await http
        .put('/api/v1/me/representative-pet')
        .set(auth(user))
        .send({ petId })
        .expect(200);
      expect(representative.body).toMatchObject({ id: petId });

      // 단계 변화 기록: 처음엔 비어 있고, 진화 두 번이 오래된 순으로 나옴
      const empty = await http
        .get(`/api/v1/me/pets/${petId}/evolution-events`)
        .set(auth(user))
        .expect(200);
      expect(empty.body).toEqual([]);

      await db.query(
        `INSERT INTO pet_evolution_events
                (id, user_pet_id, from_stage_no, to_stage_no, total_xp_after, reason, occurred_at)
         VALUES ($1,$2,1,2,100,'growth', now() - interval '2 hours'),
                ($3,$2,2,3,300,'growth', now() - interval '1 hour')`,
        [newId(), petId, newId()],
      );
      const events = await http
        .get(`/api/v1/me/pets/${petId}/evolution-events`)
        .set(auth(user))
        .expect(200);
      expect(events.body).toHaveLength(2);
      expect(events.body[0]).toMatchObject({
        petId,
        fromStageCode: 'egg',
        toStageCode: 'baby',
        bonusRateBefore: 0,
        bonusRateAfter: 0.05,
        newDialogues: [],
      });
      expect(events.body[1]).toMatchObject({
        fromStageCode: 'baby',
        toStageCode: 'adult',
        bonusRateAfter: 0.15,
      });

      // after 이후만
      const later = await http
        .get(
          `/api/v1/me/pets/${petId}/evolution-events?after=${encodeURIComponent(events.body[0].occurredAt)}`,
        )
        .set(auth(user))
        .expect(200);
      expect(later.body.map((e) => e.toStageCode)).toEqual(['adult']);

      // 다른 사용자의 펫은 404
      const other = await createUser(app, db);
      await http
        .get(`/api/v1/me/pets/${petId}/evolution-events`)
        .set(auth(other))
        .expect(404);
    });
  });

  describe('인벤토리·포인트 내역 (A72·A74)', () => {
    it('주문 후 보유 목록, 내역 제목, earn·spend 필터, 커서 페이지', async () => {
      const user = await createUser(app, db);
      const snack = await createItem('consumable', 100);
      const hat = await createItem('permanent', 200);
      await fund(user, 1000);

      for (const [item, quantity] of [
        [snack, 2],
        [hat, 1],
      ]) {
        await http
          .post('/api/v1/shop/orders')
          .set(auth(user))
          .send({ itemId: item.id, quantity })
          .expect(201);
      }

      const inventory = await http
        .get('/api/v1/me/inventory')
        .set(auth(user))
        .expect(200);
      expect(inventory.body).toHaveLength(2);
      expect(inventory.body).toContainEqual(
        expect.objectContaining({
          itemId: snack.id,
          name: snack.name,
          itemKind: 'consumable',
          quantity: 2,
          acquiredAt: expect.any(String),
        }),
      );
      expect(inventory.body).toContainEqual(
        expect.objectContaining({
          itemId: hat.id,
          itemKind: 'permanent',
          quantity: 1,
        }),
      );

      const spend = await http
        .get('/api/v1/me/point-transactions?direction=spend')
        .set(auth(user))
        .expect(200);
      expect(spend.body.items.map((t) => t.title).sort()).toEqual(
        [`${hat.name} 교환`, `${snack.name} 교환`].sort(),
      );
      expect(spend.body.items.map((t) => t.availableDelta).sort()).toEqual([
        -200, -200,
      ]);

      const earn = await http
        .get('/api/v1/me/point-transactions?direction=earn')
        .set(auth(user))
        .expect(200);
      expect(earn.body.items).toEqual([
        expect.objectContaining({
          title: '관리자 조정',
          availableDelta: 1000,
          balanceAfter: 1000,
        }),
      ]);

      // 한 건씩 커서로 넘기면 모든 거래를 한 번씩만 만남
      const seen = [];
      let cursor;
      for (let i = 0; i < 5; i += 1) {
        const page = await http
          .get(
            `/api/v1/me/point-transactions?limit=1${cursor ? `&cursor=${cursor}` : ''}`,
          )
          .set(auth(user))
          .expect(200);
        seen.push(...page.body.items.map((t) => t.id));
        cursor = page.body.nextCursor;
        if (!cursor) break;
      }
      expect(seen).toHaveLength(3);
      expect(new Set(seen).size).toBe(3);
    });

    it('수량이 0이 된 상품은 인벤토리에서 빠짐', async () => {
      const user = await createUser(app, db);
      const snack = await createItem('consumable', 50);
      await fund(user, 100);
      const order = await http
        .post('/api/v1/shop/orders')
        .set(auth(user))
        .send({ itemId: snack.id, quantity: 1 })
        .expect(201);
      await http
        .post(`/api/v1/shop/orders/${order.body.id}/cancel`)
        .set(auth(user))
        .send({ reason: '마음이 바뀜' })
        .expect(200);
      const inventory = await http
        .get('/api/v1/me/inventory')
        .set(auth(user))
        .expect(200);
      expect(inventory.body).toEqual([]);
    });
  });

  describe('업적 목록 (A76)', () => {
    it('진행도 → 달성 후 earned·earnedAt, rarity 필터', async () => {
      const user = await createUser(app, db);
      const rare = await createAchievement({ targetCount: 2, rarity: 'rare' });
      const category = await createCategory();
      const criteriaId = await createCriteria(category.id);

      const find = async (query = '') =>
        (
          await http
            .get(`/api/v1/achievements${query}`)
            .set(auth(user))
            .expect(200)
        ).body.find((a) => a.id === rare.id);

      expect(await find()).toMatchObject({
        code: rare.code,
        rarity: 'rare',
        conditionType: 'approved_mission_count',
        targetCount: 2,
        progressCount: 0,
        earned: false,
        earnedAt: null,
        rewardPoints: 25,
      });

      await createApprovedMission(user.id, category.id, criteriaId);
      expect((await find()).progressCount).toBe(1);

      await createApprovedMission(user.id, category.id, criteriaId);
      await db.withTransaction((tx) =>
        achievements.evaluate(tx, {
          userId: user.id,
          trigger: 'mission_approved',
        }),
      );
      expect(await find()).toMatchObject({
        earned: true,
        earnedAt: expect.any(String),
        progressCount: 2,
      });

      // rarity 필터: 맞는 등급에만 나옴
      expect(await find('?rarity=rare')).toBeDefined();
      expect(await find('?rarity=common')).toBeUndefined();

      // 달성 보상 포인트가 업적 보상으로 기록됨
      const earn = await http
        .get('/api/v1/me/point-transactions?direction=earn')
        .set(auth(user))
        .expect(200);
      expect(earn.body.items).toContainEqual(
        expect.objectContaining({ title: '업적 보상', availableDelta: 25 }),
      );
    });
  });
});
