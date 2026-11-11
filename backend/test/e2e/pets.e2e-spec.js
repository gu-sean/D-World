import { createTestApp } from '../support/app.js';
import { testNickname } from '../support/users.js';
import { randomInt, randomUUID } from 'node:crypto';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { ExperienceService } from '../../src/experience-pets/experience.service.js';

// DATABASE_URL이 있을 때만 실행, 마이그레이션 적용 필요
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999); // 반복 실행해도 고유 값이 겹치지 않게

describe.skipIf(!databaseUrl)('펫 선택·이름·대표 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let experience;
  let adminId;
  let counter = 0;

  const tx = (fn) => db.withTransaction(fn);
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const next = () => `${RUN}${counter++}`;

  /** FK·트리거를 끄고 소유 도메인 행을 최소로 만듦 (해금 근거 데이터용) */
  const insertBypassingTriggers = (sql, params) =>
    tx(async (t) => {
      await t.query('SET LOCAL session_replication_role = replica');
      await t.query(sql, params);
    });

  async function createUser() {
    const id = randomUUID();
    await db.query('INSERT INTO users (id) VALUES ($1)', [id]);
    await db.query('INSERT INTO profiles (user_id, nickname) VALUES ($1, $2)', [
      id,
      testNickname(),
    ]);
    const sessions = app.get(SessionsService);
    const session = await tx((t) => sessions.create(t, 'user', id));
    const token = await app
      .get(AccessTokenService)
      .issue('user', id, session.sessionId);
    return { id, token };
  }

  async function createCategory() {
    const id = randomUUID();
    const tag = next();
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [id, `pc${tag}`, `펫카테고리${tag}`],
    );
    return id;
  }

  /** 3단계를 갖춘 공개 종류 하나, unlock으로 해금 조건 지정 */
  async function createSpecies({ unlock = {}, categoryId } = {}) {
    const tag = next();
    const category = categoryId ?? (await createCategory());
    const speciesId = randomUUID();
    const versionId = randomUUID();
    const imageId = randomUUID();
    await db.query(
      `INSERT INTO pet_species (id, code, name, status, created_by_admin_id)
       VALUES ($1, $2, $3, 'public', $4)`,
      [speciesId, `sp${tag}`, `종류${tag}`, adminId],
    );
    await db.query(
      `INSERT INTO pet_species_versions
              (id, species_id, version_no, name, description, category_id,
               unlock_condition_type, unlock_target_count, unlock_category_id,
               unlock_achievement_id, hatch_mission_count, effective_at,
               created_by_admin_id)
       VALUES ($1,$2,1,$3,'설명',$4,$5,$6,$7,$8,0, now() - interval '1 day', $9)`,
      [
        versionId,
        speciesId,
        `종류${tag}`,
        category,
        unlock.type ?? 'none',
        unlock.target ?? null,
        unlock.categoryId ?? null,
        unlock.achievementId ?? null,
        adminId,
      ],
    );
    await db.query(
      `INSERT INTO pet_stage_images
              (id, species_id, r2_object_key, mime_type, size_bytes, uploaded_at, created_by_admin_id)
       VALUES ($1,$2,$3,'image/png',10,now(),$4)`,
      [imageId, speciesId, `pet/${tag}.png`, adminId],
    );
    for (const [stage, code, xp] of [
      [1, 'egg', 0],
      [2, 'baby', 100],
      [3, 'adult', 300],
    ]) {
      await db.query(
        `INSERT INTO pet_stage_versions
                (species_version_id, species_id, stage_no, stage_code, min_total_xp,
                 bonus_basis_points, image_id)
         VALUES ($1,$2,$3,$4,$5,0,$6)`,
        [versionId, speciesId, stage, code, xp, imageId],
      );
    }
    return { speciesId, versionId, categoryId: category };
  }

  /** 완료·승인 판정까지 갖춘 미션 (해금 조건 "승인 미션 누적"용) */
  async function createApprovedMission(userId, categoryId) {
    const ids = {
      difficulty: randomUUID(),
      mission: randomUUID(),
      record: randomUUID(),
      criteria: randomUUID(),
      result: randomUUID(),
    };
    const tag = next();
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order) VALUES ($1,$2,$3,1)`,
      [ids.difficulty, `pd${tag}`, `펫난이도${tag}`],
    );
    await db.query(
      `INSERT INTO missions
              (id, user_id, source_type, title, category_id, difficulty_id,
               verification_method, scheduled_date, reward_points)
       VALUES ($1,$2,'user','걷기',$3,$4,'sensor',CURRENT_DATE,0)`,
      [ids.mission, userId, categoryId, ids.difficulty],
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
       VALUES ($1,$2,'sensor',$3,'{}'::jsonb, now() - interval '1 day', $4)`,
      [ids.criteria, categoryId, randomInt(1, 1_000_000_000), adminId],
    );
    await db.query(
      `INSERT INTO verification_results
              (id, record_id, result_no, source, decision, criteria_version_id, engine_version)
       VALUES ($1,$2,1,'ai','approved',$3,'model-v1')`,
      [ids.result, ids.record, ids.criteria],
    );
    await db.query(`UPDATE missions SET status = 'completed' WHERE id = $1`, [
      ids.mission,
    ]);
  }

  /** 대표 펫이 없을 때 지급되어 보류된 펫 XP를 만듦 */
  async function createPendingPetXp(userId, petXp) {
    const policyId = randomUUID();
    const sourceId = randomUUID();
    const days = [7, 30, 100][counter++ % 3];
    await db.query(
      `INSERT INTO streak_milestone_policy_versions
              (id, target_success_days, version_no, points, user_xp, pet_xp,
               effective_at, created_by_admin_id)
       VALUES ($1,$2,$3,0,0,$4, now() - interval '1 day', $5)`,
      [policyId, days, RUN * 1000 + counter, petXp, adminId],
    );
    await insertBypassingTriggers(
      `INSERT INTO streak_milestone_awards
              (id, user_id, target_success_days, policy_version_id,
               awarded_points, paid_points, first_achieved_date, status)
       VALUES ($1,$2,$4,$3,0,0,CURRENT_DATE,'active')`,
      [sourceId, userId, policyId, days],
    );
    await tx((t) =>
      experience.awardExperience(t, {
        userId,
        sourceType: 'streak',
        sourceId,
        userXp: 0,
        basePetXp: petXp,
      }),
    );
  }

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    experience = app.get(ExperienceService);

    adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash)
       VALUES ($1, $2, $3, 'x')`,
      [adminId, `pe_${RUN}`, `${adminId}@example.com`],
    );

    // 사용자 레벨 정책: 보류 XP 지급(awardExperience)이 사용자 XP 계정을 만들 때 필요 (다른 스위트의 정책이 있으면 그쪽이 우선하도록 오래된 시행일)
    const userPolicyId = randomUUID();
    await db.query(
      `INSERT INTO user_level_policy_versions (id, version_no, effective_at, created_by_admin_id)
       VALUES ($1, $2, now() - interval '30 days', $3)`,
      [userPolicyId, randomInt(1_000_000, 1_000_000_000), adminId],
    );
    for (const [level, xp] of [
      [1, 0],
      [2, 100],
    ]) {
      await db.query(
        `INSERT INTO user_level_thresholds (policy_version_id, level_no, min_total_xp)
         VALUES ($1, $2, $3)`,
        [userPolicyId, level, xp],
      );
    }

    // 펫 레벨 정책: 1=0, 2=40, 3=120, 4=400 (가장 최근 유효 정책이 되도록 현재 시각 기준)
    const policyId = randomUUID();
    await db.query(
      `INSERT INTO pet_level_policy_versions (id, version_no, effective_at, created_by_admin_id)
       VALUES ($1, $2, now() - interval '1 second', $3)`,
      [policyId, randomInt(1_000_000, 1_000_000_000), adminId],
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('종류 목록', () => {
    it('공개된 종류와 해금 조건, 단계 정보를 보여 주고 인증이 필요', async () => {
      const user = await createUser();
      const { speciesId } = await createSpecies();
      await http.get('/api/v1/pets/species').expect(401);

      const res = await http
        .get('/api/v1/pets/species')
        .set(auth(user.token))
        .expect(200);
      const species = res.body.find((s) => s.speciesId === speciesId);
      expect(species).toMatchObject({
        description: '설명',
        hatchMissionCount: 0,
        ownedPetId: null,
        unlock: { type: 'none', met: true },
      });
      expect(species.stages.map((s) => s.stageCode)).toEqual([
        'egg',
        'baby',
        'adult',
      ]);
      expect(species.stages.map((s) => s.minTotalXp)).toEqual([0, 100, 300]);
    });

    it('초안·숨김 종류나 단계가 덜 갖춰진 종류는 보이지 않음', async () => {
      const user = await createUser();
      const draft = await createSpecies();
      await db.query(`UPDATE pet_species SET status = 'hidden' WHERE id = $1`, [
        draft.speciesId,
      ]);
      const res = await http
        .get('/api/v1/pets/species')
        .set(auth(user.token))
        .expect(200);
      expect(res.body.some((s) => s.speciesId === draft.speciesId)).toBe(false);
    });
  });

  describe('알 선택', () => {
    it('해금 조건이 없는 종류는 바로 선택, 알 상태·0 XP로 시작하고 버전이 고정됨', async () => {
      const user = await createUser();
      const { speciesId, versionId } = await createSpecies();
      const res = await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId, nickname: '몽실이' })
        .expect(201);
      expect(res.body).toMatchObject({
        speciesId,
        nickname: '몽실이',
        totalXp: 0,
        levelNo: 1,
        stageNo: 1,
        stageCode: 'egg',
        nextStageXp: 100,
        nextLevelXp: 40,
        representative: false,
        assignedPending: [],
      });
      const { rows } = await db.query(
        'SELECT species_version_id FROM user_pets WHERE id = $1',
        [res.body.id],
      );
      expect(rows[0].species_version_id).toBe(versionId);

      const list = await http
        .get('/api/v1/me/pets')
        .set(auth(user.token))
        .expect(200);
      expect(list.body.map((p) => p.id)).toEqual([res.body.id]);
      const species = await http
        .get('/api/v1/pets/species')
        .set(auth(user.token))
        .expect(200);
      expect(
        species.body.find((s) => s.speciesId === speciesId).ownedPetId,
      ).toBe(res.body.id);
    });

    it('종류당 한 마리, 이름은 사용자 안에서 대소문자 무시로 고유', async () => {
      const user = await createUser();
      const a = await createSpecies();
      const b = await createSpecies();
      await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId: a.speciesId, nickname: 'Momo' })
        .expect(201);

      const owned = await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId: a.speciesId, nickname: 'Other' })
        .expect(409);
      expect(owned.body.error.code).toBe('PET_ALREADY_OWNED');

      const taken = await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId: b.speciesId, nickname: 'mOmO' })
        .expect(409);
      expect(taken.body.error.code).toBe('PET_NICKNAME_TAKEN');

      // 다른 사용자는 같은 이름·같은 종류를 쓸 수 있음
      const other = await createUser();
      await http
        .post('/api/v1/me/pets')
        .set(auth(other.token))
        .send({ speciesId: a.speciesId, nickname: 'Momo' })
        .expect(201);
    });

    it('이름 형식(한글·영문 2~10자)과 없는 종류를 거절', async () => {
      const user = await createUser();
      const { speciesId } = await createSpecies();
      for (const nickname of [
        '가',
        '가나다라마바사아자차카',
        '몽실1',
        '몽 실',
      ]) {
        await http
          .post('/api/v1/me/pets')
          .set(auth(user.token))
          .send({ speciesId, nickname })
          .expect(400);
      }
      const missing = await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId: randomUUID(), nickname: '몽실이' })
        .expect(404);
      expect(missing.body.error.code).toBe('SPECIES_NOT_FOUND');
    });

    it('승인 미션 누적 해금: 부족하면 422와 진행도, 채우면 선택 가능', async () => {
      const user = await createUser();
      const category = await createCategory();
      const { speciesId } = await createSpecies({
        unlock: { type: 'approved_mission_count', target: 2 },
      });
      await createApprovedMission(user.id, category);

      const locked = await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId, nickname: '몽실이' })
        .expect(403);
      expect(locked.body.error.code).toBe('PET_SPECIES_LOCKED');
      expect(locked.body.error.details.unlock).toMatchObject({
        type: 'approved_mission_count',
        targetCount: 2,
        current: 1,
        met: false,
      });
      const listed = await http
        .get('/api/v1/pets/species')
        .set(auth(user.token))
        .expect(200);
      expect(
        listed.body.find((s) => s.speciesId === speciesId).unlock.current,
      ).toBe(1);

      await createApprovedMission(user.id, category);
      await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId, nickname: '몽실이' })
        .expect(201);
    });

    it('카테고리별 승인 미션 누적 해금은 해당 카테고리만 셈', async () => {
      const user = await createUser();
      const target = await createCategory();
      const other = await createCategory();
      const { speciesId } = await createSpecies({
        unlock: {
          type: 'category_approved_mission_count',
          target: 1,
          categoryId: target,
        },
      });
      await createApprovedMission(user.id, other);
      await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId, nickname: '몽실이' })
        .expect(403);
      await createApprovedMission(user.id, target);
      await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId, nickname: '몽실이' })
        .expect(201);
    });

    it('스트릭 마일스톤 해금은 활성 달성만 인정', async () => {
      const user = await createUser();
      const { speciesId } = await createSpecies({
        unlock: { type: 'streak_milestone', target: 7 },
      });
      await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId, nickname: '몽실이' })
        .expect(403);

      const awardId = randomUUID();
      await insertBypassingTriggers(
        `INSERT INTO streak_milestone_awards
                (id, user_id, target_success_days, policy_version_id,
                 awarded_points, paid_points, first_achieved_date, status)
         VALUES ($1,$2,7,$3,0,0,CURRENT_DATE,'revoked')`,
        [awardId, user.id, randomUUID()],
      );
      await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId, nickname: '몽실이' })
        .expect(403);

      await insertBypassingTriggers(
        `UPDATE streak_milestone_awards SET status = 'active' WHERE id = $1`,
        [awardId],
      );
      await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId, nickname: '몽실이' })
        .expect(201);
    });

    it('업적 획득 해금', async () => {
      const user = await createUser();
      const definitionId = randomUUID();
      await db.query(
        `INSERT INTO achievement_definitions (id, code, status, created_by_admin_id)
         VALUES ($1, $2, 'public', $3)`,
        [definitionId, `pa_${next()}`, adminId],
      );
      const { speciesId } = await createSpecies({
        unlock: { type: 'achievement_earned', achievementId: definitionId },
      });
      await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId, nickname: '몽실이' })
        .expect(403);

      await insertBypassingTriggers(
        `INSERT INTO user_achievements
                (id, user_id, achievement_id, achievement_version_id, badge_image_id,
                 source_type, source_id, first_achieved_at, awarded_points, paid_points)
         VALUES ($1,$2,$3,$4,$5,'mission',$6,now(),0,0)`,
        [
          randomUUID(),
          user.id,
          definitionId,
          randomUUID(),
          randomUUID(),
          randomUUID(),
        ],
      );
      await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId, nickname: '몽실이' })
        .expect(201);
    });
  });

  describe('이름 변경', () => {
    it('이름을 바꾸고, 중복·형식 오류·남의 펫은 거절', async () => {
      const user = await createUser();
      const a = await createSpecies();
      const b = await createSpecies();
      const petA = (
        await http
          .post('/api/v1/me/pets')
          .set(auth(user.token))
          .send({ speciesId: a.speciesId, nickname: '하나' })
          .expect(201)
      ).body;
      await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId: b.speciesId, nickname: '둘째' })
        .expect(201);

      const renamed = await http
        .patch(`/api/v1/me/pets/${petA.id}`)
        .set(auth(user.token))
        .send({ nickname: '새이름' })
        .expect(200);
      expect(renamed.body.nickname).toBe('새이름');

      const dup = await http
        .patch(`/api/v1/me/pets/${petA.id}`)
        .set(auth(user.token))
        .send({ nickname: '둘째' })
        .expect(409);
      expect(dup.body.error.code).toBe('PET_NICKNAME_TAKEN');
      await http
        .patch(`/api/v1/me/pets/${petA.id}`)
        .set(auth(user.token))
        .send({ nickname: 'a' })
        .expect(400);
      await http
        .patch('/api/v1/me/pets/not-a-uuid')
        .set(auth(user.token))
        .send({ nickname: '새이름2' })
        .expect(400);

      const stranger = await createUser();
      const res = await http
        .patch(`/api/v1/me/pets/${petA.id}`)
        .set(auth(stranger.token))
        .send({ nickname: '남의펫' })
        .expect(404);
      expect(res.body.error.code).toBe('PET_NOT_FOUND');
    });
  });

  describe('대표 펫', () => {
    async function choose(user, nickname) {
      const { speciesId } = await createSpecies();
      return (
        await http
          .post('/api/v1/me/pets')
          .set(auth(user.token))
          .send({ speciesId, nickname })
          .expect(201)
      ).body;
    }

    it('대표를 설정·교체·해제, 알 상태 펫도 대표가 될 수 있음', async () => {
      const user = await createUser();
      const first = await choose(user, '첫째');
      const second = await choose(user, '둘째');

      const set = await http
        .put('/api/v1/me/pets/representative')
        .set(auth(user.token))
        .send({ petId: first.id })
        .expect(200);
      expect(set.body.pet).toMatchObject({
        id: first.id,
        representative: true,
        stageNo: 1,
      });

      await http
        .put('/api/v1/me/pets/representative')
        .set(auth(user.token))
        .send({ petId: second.id })
        .expect(200);
      const list = await http
        .get('/api/v1/me/pets')
        .set(auth(user.token))
        .expect(200);
      expect(
        Object.fromEntries(
          list.body.map((p) => [p.nickname, p.representative]),
        ),
      ).toEqual({
        첫째: false,
        둘째: true,
      });
      const exp = await http
        .get('/api/v1/me/experience')
        .set(auth(user.token))
        .expect(200);
      expect(exp.body.representativePet.petId).toBe(second.id);

      await http
        .delete('/api/v1/me/pets/representative')
        .set(auth(user.token))
        .expect(204);
      const after = await http
        .get('/api/v1/me/pets')
        .set(auth(user.token))
        .expect(200);
      expect(after.body.every((p) => !p.representative)).toBe(true);
    });

    it('남의 펫이나 없는 펫은 대표로 지정할 수 없음', async () => {
      const user = await createUser();
      const stranger = await createUser();
      const theirs = await choose(stranger, '남의펫');
      for (const petId of [theirs.id, randomUUID()]) {
        const res = await http
          .put('/api/v1/me/pets/representative')
          .set(auth(user.token))
          .send({ petId })
          .expect(404);
        expect(res.body.error.code).toBe('PET_NOT_FOUND');
      }
      await http
        .put('/api/v1/me/pets/representative')
        .set(auth(user.token))
        .send({ petId: 'x' })
        .expect(400);
    });

    it('대표 설정 시 보류 펫 XP를 한 번만 배정하고, 이후 교체해도 옮겨지지 않음', async () => {
      const user = await createUser();
      await createPendingPetXp(user.id, 20);
      await createPendingPetXp(user.id, 30);
      const first = await choose(user, '첫째');
      const second = await choose(user, '둘째');

      const set = await http
        .put('/api/v1/me/pets/representative')
        .set(auth(user.token))
        .send({ petId: first.id })
        .expect(200);
      expect(set.body.assignedPending).toHaveLength(2);
      expect(set.body.pet.totalXp).toBe(50);
      expect(set.body.pet.levelNo).toBe(2);

      // 같은 펫을 다시 지정하거나 다른 펫으로 바꿔도 이미 배정된 XP는 그대로
      const again = await http
        .put('/api/v1/me/pets/representative')
        .set(auth(user.token))
        .send({ petId: first.id })
        .expect(200);
      expect(again.body.assignedPending).toEqual([]);
      const swap = await http
        .put('/api/v1/me/pets/representative')
        .set(auth(user.token))
        .send({ petId: second.id })
        .expect(200);
      expect(swap.body.assignedPending).toEqual([]);
      expect(swap.body.pet.totalXp).toBe(0);
      const list = await http
        .get('/api/v1/me/pets')
        .set(auth(user.token))
        .expect(200);
      expect(list.body.find((p) => p.id === first.id).totalXp).toBe(50);
    });

    it('알을 고르면서 바로 대표로 지정하면 보류 XP도 함께 배정', async () => {
      const user = await createUser();
      await createPendingPetXp(user.id, 45);
      const { speciesId } = await createSpecies();
      const res = await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId, nickname: '몽실이', makeRepresentative: true })
        .expect(201);
      expect(res.body).toMatchObject({
        representative: true,
        totalXp: 45,
        levelNo: 2,
        stageNo: 1,
      });
      expect(res.body.assignedPending).toHaveLength(1);
    });

    it('선택이 실패하면 대표 설정과 보류 XP 배정도 함께 롤백', async () => {
      const user = await createUser();
      await createPendingPetXp(user.id, 20);
      const { speciesId } = await createSpecies();
      await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId, nickname: '몽실이' })
        .expect(201);

      // 같은 종류를 다시 고르는 요청은 중복으로 실패해야 하고 보류 XP는 그대로 남음
      await http
        .post('/api/v1/me/pets')
        .set(auth(user.token))
        .send({ speciesId, nickname: '다른이', makeRepresentative: true })
        .expect(409);
      const exp = await http
        .get('/api/v1/me/experience')
        .set(auth(user.token))
        .expect(200);
      expect(exp.body.pendingPetXp).toBe(20);
      expect(exp.body.representativePet).toBeNull();
    });
  });
});
