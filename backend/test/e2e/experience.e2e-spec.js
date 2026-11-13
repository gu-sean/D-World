import { configureApp } from '../../src/app.setup.js';
import { randomInt, randomUUID, randomBytes } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { ExperienceService } from '../../src/experience-pets/experience.service.js';
import { RecordsService } from '../../src/verification/records/records.service.js';

// DATABASE_URL이 있을 때만 실행, 마이그레이션 적용 필요(007·017 포함)
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999); // 반복 실행해도 고유 값이 겹치지 않게

describe.skipIf(!databaseUrl)('경험치·펫 (PostgreSQL)', () => {
  let app;
  let db;
  let experience;
  let adminId;

  // 공유 정책·종류 픽스처(불변 데이터라 전체 스위트에서 한 번만 생성)
  let userPolicyId;
  let petPolicyId;
  let speciesId;
  let speciesVersionId; // category_id = speciesCategoryId, hatch_mission_count = 0
  let speciesCategoryId;
  let species2Id; // 종류당 한 마리뿐이라 같은 사용자의 두 번째 펫용으로 둔 별도 종류
  let species2VersionId;
  const BABY_XP = 50;
  const ADULT_XP = 150;

  const tx = (fn) => db.withTransaction(fn);

  async function insertBypassingTriggers(sql, params) {
    await tx(async (t) => {
      await t.query('SET LOCAL session_replication_role = replica');
      await t.query(sql, params);
    });
  }

  let userTag = 0;
  // profiles.nickname은 테이블 전체에서 고유라 같은 DB를 쓰는 다른 e2e 파일과도 안 겹치게 파일별 접두사를 둠
  const userTagPrefix = randomInt(100, 999);

  async function createUser() {
    const id = randomUUID();
    userTag += 1;
    await db.query('INSERT INTO users (id) VALUES ($1)', [id]);
    await db.query('INSERT INTO profiles (user_id, nickname) VALUES ($1, $2)', [
      id,
      `유저${userTagPrefix}${userTag}`,
    ]);
    return id;
  }

  // 종류당 한 마리뿐이라 같은 사용자가 두 번째 펫을 가지려면 다른 종류가 필요
  // 닉네임도 사용자 범위 고유라 종류별로 다르게 둠
  async function createPet(
    userId,
    {
      totalXp = 0,
      levelNo = 1,
      stageNo = 1,
      speciesId: sId = speciesId,
      speciesVersionId: svId = speciesVersionId,
    } = {},
  ) {
    const id = randomUUID();
    const nickname = sId === speciesId ? '테스트펫' : '테스트펫둘';
    await insertBypassingTriggers(
      `INSERT INTO user_pets
              (id, user_id, species_id, species_version_id, level_policy_version_id,
               nickname, total_xp, level_no, stage_no, selected_at)
       VALUES ($1,$2,$3,$4,$5,$9,$6,$7,$8, now())`,
      [id, userId, sId, svId, petPolicyId, totalXp, levelNo, stageNo, nickname],
    );
    return id;
  }

  async function setRepresentative(userId, petId) {
    await db.query(
      'UPDATE profiles SET representative_pet_id = $2 WHERE user_id = $1',
      [userId, petId],
    );
  }

  async function createAchievementSource(userId, { userXp, petXp }) {
    const tag = randomBytes(6).toString('hex'); // 공유 DB에 쌓여도 충돌하지 않게 넓은 범위
    const ids = {
      def: randomUUID(),
      image: randomUUID(),
      version: randomUUID(),
      grant: randomUUID(),
    };
    await db.query(
      `INSERT INTO achievement_definitions (id, code, status, created_by_admin_id)
       VALUES ($1, $2, 'public', $3)`,
      [ids.def, `ach_${tag}`, adminId],
    );
    await db.query(
      `INSERT INTO achievement_badge_images
              (id, achievement_id, version_no, r2_object_key, mime_type, size_bytes,
               uploaded_at, created_by_admin_id)
       VALUES ($1,$2,1,$3,'image/png',10,now(),$4)`,
      [ids.image, ids.def, `badge/${tag}`, adminId],
    );
    await db.query(
      `INSERT INTO achievement_versions
              (id, achievement_id, version_no, title, description, rarity,
               condition_type, target_count, reward_points, reward_user_xp, reward_pet_xp,
               badge_image_id, effective_at, created_by_admin_id)
       VALUES ($1,$2,1,'업적','설명','common','approved_mission_count',1,0,$3,$4,$5,
               now() - interval '1 day',$6)`,
      [ids.version, ids.def, userXp, petXp, ids.image, adminId],
    );
    await insertBypassingTriggers(
      `INSERT INTO user_achievements
              (id, user_id, achievement_id, achievement_version_id, badge_image_id,
               status, source_type, source_id, first_achieved_at, awarded_points, paid_points)
       VALUES ($1,$2,$3,$4,$5,'active','mission',$6, now(), 0, 0)`,
      [ids.grant, userId, ids.def, ids.version, ids.image, randomUUID()],
    );
    return { sourceType: 'achievement', sourceId: ids.grant };
  }

  let streakVersionNo = RUN * 1000;
  const STREAK_DAYS = [7, 30, 100];

  // user_id당 target_success_days는 하나뿐이라(마일스톤은 한 번만 달성) 호출마다 돌려씀
  async function createStreakSource(userId, { userXp, petXp }) {
    const policyId = randomUUID();
    const awardIdRow = randomUUID();
    const days = STREAK_DAYS[streakVersionNo % STREAK_DAYS.length];
    streakVersionNo += 1;
    await db.query(
      `INSERT INTO streak_milestone_policy_versions
              (id, target_success_days, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$5,$6,0,$2,$3, now() - interval '1 day', $4)`,
      [policyId, userXp, petXp, adminId, days, streakVersionNo],
    );
    await insertBypassingTriggers(
      `INSERT INTO streak_milestone_awards
              (id, user_id, target_success_days, policy_version_id,
               awarded_points, paid_points, first_achieved_date, status)
       VALUES ($1,$2,$4,$3,0,0,CURRENT_DATE,'active')`,
      [awardIdRow, userId, policyId, days],
    );
    return { sourceType: 'streak', sourceId: awardIdRow };
  }

  /** 승인된 판정까지 갖춘 미션, representative 펫이 있으면 자동으로 스냅샷에 반영됨 */
  async function createMissionSource(
    userId,
    { userXp, petXp, categoryId } = {},
  ) {
    const tag = randomBytes(6).toString('hex'); // 공유 DB에 쌓여도 충돌하지 않게 넓은 범위
    const ids = {
      category: categoryId ?? randomUUID(),
      difficulty: randomUUID(),
      rate: randomUUID(),
      mission: randomUUID(),
      record: randomUUID(),
      criteria: randomUUID(),
      result: randomUUID(),
    };
    if (!categoryId) {
      await db.query(
        `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
        [ids.category, `c${tag}`, `카테고리${tag}`],
      );
    }
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [ids.difficulty, `d${tag}`, `난이도${tag}`],
    );
    await db.query(
      `INSERT INTO mission_reward_rate_versions
              (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,$3,1,0,$4,$5, now() - interval '1 day', $6)`,
      [ids.rate, ids.category, ids.difficulty, userXp, petXp, adminId],
    );
    await db.query(
      `INSERT INTO missions
              (id, user_id, source_type, title, category_id, difficulty_id,
               verification_method, scheduled_date,
               reward_points, reward_rate_version_id, reward_user_xp, reward_pet_xp)
       VALUES ($1,$2,'user','걷기',$3,$4,'sensor',CURRENT_DATE,0,$5,$6,$7)`,
      [
        ids.mission,
        userId,
        ids.category,
        ids.difficulty,
        ids.rate,
        userXp,
        petXp,
      ],
    );
    await db.query(
      `INSERT INTO mission_records
              (id, mission_id, user_id, attempt_no, submission_no, status, evidence_kind, submitted_at)
       VALUES ($1,$2,$3,1,1,'submitted','sensor_summary', now())`,
      [ids.record, ids.mission, userId],
    );
    await db.query(
      `INSERT INTO verification_criteria_versions
              (id, category_id, verification_method, version_no, rules_json, effective_at, created_by_admin_id)
       VALUES ($1,$2,'sensor',
               (SELECT COALESCE(max(version_no), 0) + 1 FROM verification_criteria_versions
                 WHERE category_id = $2 AND verification_method = 'sensor'),
               '{}'::jsonb, now() - interval '1 day', $3)`,
      [ids.criteria, ids.category, adminId],
    );
    await db.query(
      `INSERT INTO verification_results
              (id, record_id, result_no, source, decision, criteria_version_id, engine_version)
       VALUES ($1,$2,1,'ai','approved',$3,'model-v1')`,
      [ids.result, ids.record, ids.criteria],
    );
    // mission_records는 미션이 열려 있어야 생성 가능, 판정이 끝난 뒤 완료로 전환
    await db.query(`UPDATE missions SET status = 'completed' WHERE id = $1`, [
      ids.mission,
    ]);
    const { rows: snapRows } = await db.query(
      `SELECT reward_pet_id, reward_pet_stage_no, reward_pet_bonus_basis_points
         FROM mission_records WHERE id = $1`,
      [ids.record],
    );
    return {
      sourceType: 'mission',
      sourceId: ids.mission,
      categoryId: ids.category,
      snapshot: snapRows[0],
    };
  }

  const award = (userId, source, { userXp, petXp, recipient } = {}) =>
    tx((t) =>
      experience.awardExperience(t, {
        userId,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        userXp,
        basePetXp: petXp,
        recipient,
      }),
    );
  const revoke = (awardId, resultId = randomUUID()) =>
    tx((t) => experience.revokeExperience(t, { awardId, resultId }));
  const reinstate = (awardId, resultId = randomUUID()) =>
    tx((t) => experience.reinstateExperience(t, { awardId, resultId }));
  const assign = (userId, petId) =>
    tx((t) => experience.assignPendingExperience(t, { userId, petId }));
  const correct = (awardId, reason = '정정') =>
    tx((t) => experience.adminCorrect(t, { adminId, awardId, reason }));

  const userExp = async (userId) => {
    const { rows } = await db.query(
      `SELECT total_xp::int AS total_xp, level_no FROM user_experience WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ?? null;
  };
  const petState = async (petId) => {
    const { rows } = await db.query(
      `SELECT total_xp::int AS total_xp, level_no, stage_no FROM user_pets WHERE id = $1`,
      [petId],
    );
    return rows[0];
  };
  const evolutionEvents = async (petId) => {
    const { rows } = await db.query(
      `SELECT from_stage_no, to_stage_no, reason FROM pet_evolution_events
        WHERE user_pet_id = $1 ORDER BY occurred_at`,
      [petId],
    );
    return rows;
  };
  const pendingStatus = async (awardId) => {
    const { rows } = await db.query(
      `SELECT status FROM pending_pet_experience WHERE experience_award_id = $1`,
      [awardId],
    );
    return rows[0]?.status;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({
          totalHits: 1,
          timeToExpire: 0,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DatabaseService);
    experience = app.get(ExperienceService);

    adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash)
       VALUES ($1, $2, $3, 'x')`,
      [adminId, `pa_${randomInt(100_000, 999_999)}`, `${adminId}@example.com`],
    );

    // 사용자 레벨 정책: 1=0, 2=100, 3=300, 4=1000
    // version_no는 전역 고유라 같은 테스트 DB에서 여러 e2e 파일이 동시에 도는 경우를 대비해 무작위로 둠
    userPolicyId = randomUUID();
    await db.query(
      `INSERT INTO user_level_policy_versions (id, version_no, effective_at, created_by_admin_id)
       VALUES ($1, $3, now() - interval '1 day', $2)`,
      [userPolicyId, adminId, randomInt(1, 1_000_000_000)],
    );
    for (const [level, xp] of [
      [1, 0],
      [2, 100],
      [3, 300],
      [4, 1000],
    ]) {
      await db.query(
        `INSERT INTO user_level_thresholds (policy_version_id, level_no, min_total_xp)
         VALUES ($1, $2, $3)`,
        [userPolicyId, level, xp],
      );
    }

    // 펫 레벨 정책: 1=0, 2=40, 3=120, 4=400
    petPolicyId = randomUUID();
    await db.query(
      `INSERT INTO pet_level_policy_versions (id, version_no, effective_at, created_by_admin_id)
       VALUES ($1, $3, now() - interval '1 day', $2)`,
      [petPolicyId, adminId, randomInt(1, 1_000_000_000)],
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
        [petPolicyId, level, xp],
      );
    }

    // 펫 종류: 해금 조건 없음, 부화 필요 미션 0(이 스위트에서는 미션 수 조건을 다루지 않음)
    speciesId = randomUUID();
    speciesCategoryId = randomUUID();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,'pc${RUN}','펫카테고리${RUN}',1)`,
      [speciesCategoryId],
    );
    await db.query(
      `INSERT INTO pet_species (id, code, name, status, created_by_admin_id)
       VALUES ($1,'dr${RUN}','드라고${RUN}','public',$2)`,
      [speciesId, adminId],
    );
    speciesVersionId = randomUUID();
    await db.query(
      `INSERT INTO pet_species_versions
              (id, species_id, version_no, name, category_id, unlock_condition_type,
               hatch_mission_count, effective_at, created_by_admin_id)
       VALUES ($1,$2,1,'드라고',$3,'none',0, now() - interval '1 day', $4)`,
      [speciesVersionId, speciesId, speciesCategoryId, adminId],
    );
    const imageId = randomUUID();
    await db.query(
      `INSERT INTO pet_stage_images
              (id, species_id, r2_object_key, mime_type, size_bytes, uploaded_at, created_by_admin_id)
       VALUES ($1,$2,'pet/stage${RUN}.png','image/png',10,now(),$3)`,
      [imageId, speciesId, adminId],
    );
    // bonus_basis_points=333(3.33%)로 모든 단계에 버프를 둬서 미션 보너스 floor 계산을 검증
    for (const [stage, code, xp] of [
      [1, 'egg', 0],
      [2, 'baby', BABY_XP],
      [3, 'adult', ADULT_XP],
    ]) {
      await db.query(
        `INSERT INTO pet_stage_versions
                (species_version_id, species_id, stage_no, stage_code, min_total_xp,
                 bonus_basis_points, image_id)
         VALUES ($1,$2,$3,$4,$5,333,$6)`,
        [speciesVersionId, speciesId, stage, code, xp, imageId],
      );
    }

    // 종류당 한 마리뿐이라 같은 사용자의 두 번째 펫 테스트용으로 별도 종류 하나 더
    species2Id = randomUUID();
    await db.query(
      `INSERT INTO pet_species (id, code, name, status, created_by_admin_id)
       VALUES ($1,'dt${RUN}','드라고2${RUN}','public',$2)`,
      [species2Id, adminId],
    );
    species2VersionId = randomUUID();
    await db.query(
      `INSERT INTO pet_species_versions
              (id, species_id, version_no, name, category_id, unlock_condition_type,
               hatch_mission_count, effective_at, created_by_admin_id)
       VALUES ($1,$2,1,'드라고2',$3,'none',0, now() - interval '1 day', $4)`,
      [species2VersionId, species2Id, speciesCategoryId, adminId],
    );
    const image2Id = randomUUID();
    await db.query(
      `INSERT INTO pet_stage_images
              (id, species_id, r2_object_key, mime_type, size_bytes, uploaded_at, created_by_admin_id)
       VALUES ($1,$2,'pet/stage2${RUN}.png','image/png',10,now(),$3)`,
      [image2Id, species2Id, adminId],
    );
    for (const [stage, code, xp] of [
      [1, 'egg', 0],
      [2, 'baby', BABY_XP],
      [3, 'adult', ADULT_XP],
    ]) {
      await db.query(
        `INSERT INTO pet_stage_versions
                (species_version_id, species_id, stage_no, stage_code, min_total_xp,
                 bonus_basis_points, image_id)
         VALUES ($1,$2,$3,$4,$5,0,$6)`,
        [species2VersionId, species2Id, stage, code, xp, image2Id],
      );
    }
  });

  afterAll(async () => {
    // 이 스위트가 만든 공개 업적이 남으면 이후 스위트의 보상·평가에 섞이므로 숨김 처리
    await db.query(
      `UPDATE achievement_definitions SET status = 'hidden' WHERE created_by_admin_id = $1`,
      [adminId],
    );
    await app.close();
  });

  describe('지급', () => {
    it('대표 펫이 없으면 사용자 XP는 즉시 반영, 펫 XP는 보류', async () => {
      const user = await createUser();
      const source = await createStreakSource(user, { userXp: 10, petXp: 20 });

      const res = await award(user, source, { userXp: 10, petXp: 20 });
      expect(res).toMatchObject({
        outcome: 'created',
        userXp: 10,
        petXp: 0,
        pendingPetXp: 20,
      });
      expect(await userExp(user)).toEqual({ total_xp: 10, level_no: 1 });
      expect(await pendingStatus(res.awardId)).toBe('pending');

      const again = await award(user, source, { userXp: 10, petXp: 20 });
      expect(again.outcome).toBe('already_applied');
    });

    it('같은 소스를 다른 금액으로 지급하려 하면 409', async () => {
      const user = await createUser();
      const source = await createStreakSource(user, { userXp: 10, petXp: 0 });
      await award(user, source, { userXp: 10, petXp: 0 });
      await expect(
        award(user, source, { userXp: 99, petXp: 0 }),
      ).rejects.toMatchObject({
        status: 409,
      });
    });

    it('대표 펫이 있으면 펫 XP도 즉시 반영, 업적·스트릭은 버프 없음', async () => {
      const user = await createUser();
      const pet = await createPet(user);
      const source = await createAchievementSource(user, {
        userXp: 5,
        petXp: 30,
      });

      const res = await award(user, source, {
        userXp: 5,
        petXp: 30,
        recipient: { petId: pet, stageNo: 1, bonusBasisPoints: 500 }, // 미션 외에는 서비스가 0으로 강제
      });
      expect(res).toMatchObject({ userXp: 5, petXp: 30 });
      // 펫 레벨2 임곗값은 40, 30XP는 아직 레벨1
      expect(await petState(pet)).toEqual({
        total_xp: 30,
        level_no: 1,
        stage_no: 1,
      });
    });

    it('미션 보상은 스냅샷에서 버프 계산(floor), 대표 펫·스냅샷 불일치는 거절', async () => {
      const user = await createUser();
      const pet = await createPet(user);
      await setRepresentative(user, pet);
      const source = await createMissionSource(user, {
        userXp: 7,
        petXp: 1000,
        categoryId: speciesCategoryId, // 카테고리 일치해야 버프 적용
      });

      const res = await award(user, source, {
        userXp: 7,
        petXp: 1000,
        recipient: {
          petId: pet,
          stageNo: source.snapshot.reward_pet_stage_no,
          bonusBasisPoints: source.snapshot.reward_pet_bonus_basis_points,
        },
      });
      // floor(1000 * 333 / 10000) = 33
      expect(res.petXp).toBe(1033);
      expect((await petState(pet)).total_xp).toBe(1033);

      // 종류당 한 마리뿐이라 두 번째 펫은 다른 종류로 만듦(스냅샷 불일치 확인용, 실제 자격과는 무관)
      const other = await createPet(user, {
        speciesId: species2Id,
        speciesVersionId: species2VersionId,
      });
      const mismatched = await createMissionSource(user, {
        userXp: 1,
        petXp: 1,
      });
      await expect(
        award(user, mismatched, {
          userXp: 1,
          petXp: 1,
          recipient: { petId: other, stageNo: 1, bonusBasisPoints: 0 },
        }),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('0 XP 지급도 행을 남기고 거래는 만들지 않음', async () => {
      const user = await createUser();
      const source = await createStreakSource(user, { userXp: 0, petXp: 0 });
      const res = await award(user, source, { userXp: 0, petXp: 0 });
      expect(res).toMatchObject({ userXp: 0, petXp: 0, pendingPetXp: 0 });
      const { rowCount } = await db.query(
        'SELECT 1 FROM experience_transactions WHERE experience_award_id = $1',
        [res.awardId],
      );
      expect(rowCount).toBe(0);
    });

    it('레벨 임곗값을 여러 개 넘으면 한 번에 최종 레벨로', async () => {
      const user = await createUser();
      const source = await createStreakSource(user, { userXp: 1000, petXp: 0 });
      await award(user, source, { userXp: 1000, petXp: 0 });
      expect(await userExp(user)).toEqual({ total_xp: 1000, level_no: 4 });
    });

    it('펫 단계를 한 번에 여러 개 넘으면 이력을 순서대로 남김', async () => {
      const user = await createUser();
      const pet = await createPet(user);
      const source = await createAchievementSource(user, {
        userXp: 0,
        petXp: ADULT_XP + 10,
      });
      await award(user, source, {
        userXp: 0,
        petXp: ADULT_XP + 10,
        recipient: { petId: pet, stageNo: 1, bonusBasisPoints: 0 },
      });
      expect((await petState(pet)).stage_no).toBe(3);
      expect(await evolutionEvents(pet)).toEqual([
        { from_stage_no: 1, to_stage_no: 2, reason: 'growth' },
        { from_stage_no: 2, to_stage_no: 3, reason: 'growth' },
      ]);
    });

    it('이전 기록(metrics.rewards 없음)의 보상 복원: 어느 지급이 펫을 진화시켰는지 정확히 구분', async () => {
      // 진화 이력의 occurred_at은 clock_timestamp()라 트랜잭션 시각과 다르다.
      // 복원은 "지급 직후 펫의 누적 XP"로 그 지급이 만든 진화만 찾아야 한다
      const user = await createUser();
      const pet = await createPet(user);
      await setRepresentative(user, pet);
      const records = app.get(RecordsService);
      const recipientOf = (source) => ({
        petId: pet,
        stageNo: source.snapshot.reward_pet_stage_no,
        bonusBasisPoints: source.snapshot.reward_pet_bonus_basis_points,
      });

      // 1) 작은 지급: 진화 없음
      const small = await createMissionSource(user, {
        userXp: 1,
        petXp: 1,
        categoryId: speciesCategoryId,
      });
      await award(user, small, {
        userXp: 1,
        petXp: 1,
        recipient: recipientOf(small),
      });
      // 2) 큰 지급: 1단계에서 3단계까지 진화
      const big = await createMissionSource(user, {
        userXp: 1,
        petXp: ADULT_XP + 10,
        categoryId: speciesCategoryId,
      });
      await award(user, big, {
        userXp: 1,
        petXp: ADULT_XP + 10,
        recipient: recipientOf(big),
      });
      expect((await petState(pet)).stage_no).toBe(3);

      const first = await records.grantedRewards(db, user, small.sourceId);
      const second = await records.grantedRewards(db, user, big.sourceId);
      expect(first.petEvolved).toBe(false);
      expect(second.petEvolved).toBe(true);
    });
  });

  describe('회수·복구', () => {
    it('회수하면 펫 단계가 내려가고 이력이 남음, 반복 호출은 무시', async () => {
      const user = await createUser();
      const pet = await createPet(user);
      const source = await createStreakSource(user, {
        userXp: 10,
        petXp: ADULT_XP + 10,
      });
      const created = await award(user, source, {
        userXp: 10,
        petXp: ADULT_XP + 10,
        recipient: { petId: pet, stageNo: 1, bonusBasisPoints: 0 },
      });

      const res = await revoke(created.awardId);
      expect(res).toMatchObject({
        outcome: 'revoked',
        userXp: -10,
        petXp: -(ADULT_XP + 10),
      });
      expect(await userExp(user)).toEqual({ total_xp: 0, level_no: 1 });
      expect(await petState(pet)).toEqual({
        total_xp: 0,
        level_no: 1,
        stage_no: 1,
      });
      expect(await evolutionEvents(pet)).toEqual([
        { from_stage_no: 1, to_stage_no: 2, reason: 'growth' },
        { from_stage_no: 2, to_stage_no: 3, reason: 'growth' },
        { from_stage_no: 3, to_stage_no: 2, reason: 'reversal' },
        { from_stage_no: 2, to_stage_no: 1, reason: 'reversal' },
      ]);
      expect((await revoke(created.awardId)).outcome).toBe('already_applied');
    });

    it('복구하면 원 금액을 그대로 되돌림', async () => {
      const user = await createUser();
      const pet = await createPet(user);
      const source = await createStreakSource(user, { userXp: 10, petXp: 30 });
      const created = await award(user, source, {
        userXp: 10,
        petXp: 30,
        recipient: { petId: pet, stageNo: 1, bonusBasisPoints: 0 },
      });
      await revoke(created.awardId);

      const res = await reinstate(created.awardId);
      expect(res).toMatchObject({
        outcome: 'reinstated',
        userXp: 10,
        petXp: 30,
      });
      expect(await userExp(user)).toEqual({ total_xp: 10, level_no: 1 });
      expect(await petState(pet)).toMatchObject({ total_xp: 30 });
      expect((await reinstate(created.awardId)).outcome).toBe(
        'already_applied',
      );
    });

    it('보류 중 지급의 회수·복구는 pending_pet_experience 상태만 바꿈', async () => {
      const user = await createUser();
      const source = await createStreakSource(user, { userXp: 5, petXp: 15 });
      const created = await award(user, source, { userXp: 5, petXp: 15 });

      await revoke(created.awardId);
      expect(await pendingStatus(created.awardId)).toBe('cancelled');
      expect(await userExp(user)).toEqual({ total_xp: 0, level_no: 1 });

      await reinstate(created.awardId);
      expect(await pendingStatus(created.awardId)).toBe('pending');
      expect(await userExp(user)).toEqual({ total_xp: 5, level_no: 1 });
    });

    it('지급 기록이 없는 awardId 회수는 404', async () => {
      await expect(revoke(randomUUID())).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('보류 XP 배정', () => {
    it('대표 펫 선택 시 보류 XP를 오래된 순으로 일괄 배정', async () => {
      const user = await createUser();
      const sourceA = await createStreakSource(user, { userXp: 0, petXp: 20 });
      const a = await award(user, sourceA, { userXp: 0, petXp: 20 });
      const sourceB = await createAchievementSource(user, {
        userXp: 0,
        petXp: 30,
      });
      const b = await award(user, sourceB, { userXp: 0, petXp: 30 });

      const pet = await createPet(user);
      const res = await assign(user, pet);
      expect(res.items.map((i) => i.awardId).sort()).toEqual(
        [a.awardId, b.awardId].sort(),
      );
      expect((await petState(pet)).total_xp).toBe(50);
      expect(await pendingStatus(a.awardId)).toBe('assigned');
      expect(await pendingStatus(b.awardId)).toBe('assigned');

      // 이미 배정된 보류는 다시 배정되지 않음
      const again = await assign(user, pet);
      expect(again.items).toEqual([]);
      expect((await petState(pet)).total_xp).toBe(50);
    });
  });

  describe('관리자 정정', () => {
    it('누락된 펫 몫만 보충', async () => {
      const user = await createUser();
      const pet = await createPet(user);
      const source = await createAchievementSource(user, {
        userXp: 0,
        petXp: 40,
      });
      const created = await award(user, source, {
        userXp: 0,
        petXp: 40,
        recipient: { petId: pet, stageNo: 1, bonusBasisPoints: 0 },
      });

      // 누락 상황을 흉내: 펫 쪽 반영분을 트리거 밖에서 되돌림
      await insertBypassingTriggers(
        'UPDATE user_pets SET total_xp = 0, level_no = 1, stage_no = 1 WHERE id = $1',
        [pet],
      );
      await insertBypassingTriggers(
        'DELETE FROM experience_transactions WHERE experience_award_id = $1 AND recipient_kind = $2',
        [created.awardId, 'pet'],
      );
      expect((await petState(pet)).total_xp).toBe(0);

      const res = await correct(created.awardId, '누락 보충');
      expect(res).toMatchObject({ userXp: 0, petXp: 40 });
      expect((await petState(pet)).total_xp).toBe(40);
      const { rows } = await db.query(
        `SELECT created_by_admin_id, reason FROM experience_transactions
          WHERE experience_award_id = $1 AND kind = 'admin_adjustment'`,
        [created.awardId],
      );
      expect(rows).toEqual([
        { created_by_admin_id: adminId, reason: '누락 보충' },
      ]);

      // 이미 정상 반영된 경우 추가 반영 없음
      expect((await correct(created.awardId, '한번더')).petXp).toBe(0);
    });

    it('회수된 지급은 정정할 수 없음, 사유 없으면 거절', async () => {
      const user = await createUser();
      const source = await createStreakSource(user, { userXp: 10, petXp: 0 });
      const created = await award(user, source, { userXp: 10, petXp: 0 });
      await revoke(created.awardId);
      await expect(correct(created.awardId, '사유')).rejects.toMatchObject({
        status: 409,
      });

      const source2 = await createStreakSource(user, { userXp: 10, petXp: 0 });
      const created2 = await award(user, source2, { userXp: 10, petXp: 0 });
      await expect(correct(created2.awardId, ' ')).rejects.toThrow(RangeError);
    });
  });

  describe('조회 API', () => {
    async function login(userId) {
      const sessions = app.get(SessionsService);
      const tokens = app.get(AccessTokenService);
      const session = await tx((t) => sessions.create(t, 'user', userId));
      return tokens.issue('user', userId, session.sessionId);
    }

    it('첫 XP를 얻기 전(경험치 행 없음)에도 다음 레벨 기준을 줌: null이면 앱이 최고 레벨로 읽음', async () => {
      const user = await createUser();
      const token = await login(user);

      const experience = await request(app.getHttpServer())
        .get('/api/v1/me/experience')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(experience.body).toMatchObject({ totalXp: 0, levelNo: 1 });
      expect(experience.body.nextLevelXp).toBeGreaterThan(0);

      // 마이 화면이 읽는 GET /me도 같은 값
      const me = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(me.body).toMatchObject({ totalXp: 0, levelNo: 1 });
      expect(me.body.nextLevelXp).toBe(experience.body.nextLevelXp);
    });

    it('누적 XP·레벨·다음 레벨까지·대표 펫·보류 펫 XP', async () => {
      const user = await createUser();
      const pet = await createPet(user);
      await setRepresentative(user, pet);
      const source = await createAchievementSource(user, {
        userXp: 10,
        petXp: 20,
      });
      await award(user, source, {
        userXp: 10,
        petXp: 20,
        recipient: { petId: pet, stageNo: 1, bonusBasisPoints: 0 },
      });
      const pendingSource = await createStreakSource(user, {
        userXp: 0,
        petXp: 99,
      });
      await award(user, pendingSource, { userXp: 0, petXp: 99 });

      const token = await login(user);
      const res = await request(app.getHttpServer())
        .get('/api/v1/me/experience')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toMatchObject({
        totalXp: 10,
        levelNo: 1,
        nextLevelXp: 100,
        pendingPetXp: 99,
        representativePet: { petId: pet, totalXp: 20, levelNo: 1, stageNo: 1 },
      });
      await request(app.getHttpServer())
        .get('/api/v1/me/experience')
        .expect(401);
    });
  });
});
