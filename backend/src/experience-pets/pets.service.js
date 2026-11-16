import { newId } from '../common/ids.js';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';
import { ADULT_XP, HATCH_MISSIONS } from './pet-xp.service.js';
import { rethrowConstraint } from '../common/errors/constraint.js';
import { DatabaseService } from '../database/database.service.js';
import { OBJECT_STORAGE } from '../media/storage/object-storage.js';
import { presignGetCached } from '../media/storage/presign-cache.js';
import { ExperienceService } from './experience.service.js';

const num = (value) => Number(value);

/** 앱에 주는 펫 이미지 주소(임시 URL) 유효 시간 */
const IMAGE_URL_TTL_SEC = 3600;

const notFound = (code, message) => () =>
  new AppException(HttpStatus.NOT_FOUND, code, message);
const conflict = (code, message) => () =>
  new AppException(HttpStatus.CONFLICT, code, message);

const speciesNotFound = notFound('species_not_found', '선택할 수 없는 펫 종류');
const petNotFound = notFound('pet_not_found', '펫을 찾을 수 없음');
const petOwned = conflict('pet_already_owned', '이미 보유한 종류의 펫');
const nicknameTaken = conflict('pet_nickname_taken', '이미 사용 중인 펫 이름');

/**
 * 펫 선택·이름·대표 설정
 * 종류 정보는 관리자가 버전으로 관리하고, 알을 선택할 때 그 시점의 최신 유효 버전을 펫에 고정
 * 해금 조건은 DB 트리거(guard_user_pet)가 최종 검증하며, 여기서는 사용자에게 보여 줄 진행도와 오류를 만듦
 */
@Injectable()
@Dependencies(DatabaseService, ExperienceService, OBJECT_STORAGE)
export class PetsService {
  constructor(database, experience, storage) {
    this.database = database;
    this.experience = experience;
    this.storage = storage;
  }

  /** GIF 키의 정지 썸네일(첫 장면 PNG): 같은 이름에 .still.png, GIF가 아니면 원본 그대로 */
  stillUrl(key) {
    if (!key) return null;
    return this.imageUrl(
      key.endsWith('.gif') ? key.replace(/\.gif$/, '.still.png') : key,
    );
  }

  /** 저장소 키 → 앱이 바로 읽을 수 있는 임시 URL, 키가 없으면 null */
  imageUrl(key) {
    if (!key) return null;
    return presignGetCached(this.storage, {
      key,
      expiresInSec: IMAGE_URL_TTL_SEC,
    });
  }

  /** 선택 가능한 종류(공개·3단계 완비)의 최신 유효 버전, speciesId를 주면 그 종류만 */
  async querySpecies(db, speciesId = null) {
    const { rows } = await db.query(
      `SELECT s.id AS species_id, s.code, v.id AS version_id, v.name, v.description,
              v.personality, v.world_text, v.category_id, gc.name AS category_name,
              v.unlock_condition_type, v.unlock_target_count, v.unlock_category_id,
              v.unlock_achievement_id, v.hatch_mission_count
         FROM pet_species s
         JOIN LATERAL (
           SELECT * FROM pet_species_versions pv
            WHERE pv.species_id = s.id AND pv.effective_at <= now()
            ORDER BY pv.effective_at DESC, pv.version_no DESC
            LIMIT 1
         ) v ON true
         LEFT JOIN goal_categories gc ON gc.id = v.category_id
        WHERE s.status = 'public'
          AND ($1::short_id IS NULL OR s.id = $1)
          AND (SELECT count(*) FROM pet_stage_versions sv
                WHERE sv.species_version_id = v.id) = 3
        ORDER BY s.code`,
      [speciesId],
    );
    return rows;
  }

  /** 해금 판단에 쓰는 사용자 활동: DB 트리거와 같은 기준(완료 미션 중 현재 승인 판정) */
  async unlockProgress(db, userId) {
    const [missions, streaks, achievements] = await Promise.all([
      db.query(
        `SELECT m.category_id, count(DISTINCT m.id) AS n
           FROM missions m
           JOIN mission_records mr ON mr.mission_id = m.id
           JOIN verification_results vr ON vr.record_id = mr.id
          WHERE m.user_id = $1 AND m.status = 'completed'
            AND vr.decision = 'approved' AND vr.is_current
          GROUP BY m.category_id`,
        [userId],
      ),
      db.query(
        `SELECT target_success_days FROM streak_milestone_awards
          WHERE user_id = $1 AND status = 'active'`,
        [userId],
      ),
      db.query(
        `SELECT achievement_id FROM user_achievements
          WHERE user_id = $1 AND status = 'active'`,
        [userId],
      ),
    ]);
    const byCategory = new Map(
      missions.rows.map((r) => [r.category_id, num(r.n)]),
    );
    return {
      byCategory,
      total: [...byCategory.values()].reduce((a, b) => a + b, 0),
      streakDays: new Set(streaks.rows.map((r) => r.target_success_days)),
      achievements: new Set(achievements.rows.map((r) => r.achievement_id)),
    };
  }

  evaluateUnlock(version, progress) {
    const type = version.unlock_condition_type;
    const target = version.unlock_target_count;
    const base = {
      type,
      targetCount: target,
      categoryId: version.unlock_category_id,
      achievementId: version.unlock_achievement_id,
    };
    switch (type) {
      case 'approved_mission_count':
        return {
          ...base,
          current: progress.total,
          met: progress.total >= target,
        };
      // 펫 분야를 없앴으므로(022) 분야 조건도 전체 완료 미션 수로 센다
      case 'category_approved_mission_count':
        return {
          ...base,
          categoryId: null,
          type: 'approved_mission_count',
          current: progress.total,
          met: progress.total >= target,
        };
      case 'streak_milestone': {
        const met = progress.streakDays.has(target);
        return { ...base, current: met ? 1 : 0, met };
      }
      case 'achievement_earned': {
        const met = progress.achievements.has(version.unlock_achievement_id);
        return { ...base, current: met ? 1 : 0, met };
      }
      default:
        return { ...base, current: 0, met: true };
    }
  }

  /** 선택 가능한 종류 목록: 해금 진행도, 이미 보유 여부 포함 */
  async listSpecies(userId) {
    const db = this.database;
    const species = await this.querySpecies(db);
    if (species.length === 0) return [];

    const [progress, stages, owned] = await Promise.all([
      this.unlockProgress(db, userId),
      db.query(
        `SELECT sv.species_version_id, sv.stage_no, sv.stage_code, sv.min_total_xp,
                sv.bonus_basis_points, i.r2_object_key AS image_key
           FROM pet_stage_versions sv
           LEFT JOIN pet_stage_images i ON i.id = sv.image_id
          WHERE sv.species_version_id = ANY($1::short_id[])
          ORDER BY sv.species_version_id, sv.stage_no`,
        [species.map((s) => s.version_id)],
      ),
      db.query('SELECT species_id, id FROM user_pets WHERE user_id = $1', [
        userId,
      ]),
    ]);
    const ownedBySpecies = new Map(owned.rows.map((r) => [r.species_id, r.id]));
    const imageUrls = new Map(
      await Promise.all(
        stages.rows.map(async (r) => [
          `${r.species_version_id}:${r.stage_no}`,
          await this.imageUrl(r.image_key),
        ]),
      ),
    );

    const stillUrls = new Map(
      await Promise.all(
        stages.rows.map(async (r) => [
          `${r.species_version_id}:${r.stage_no}`,
          await this.stillUrl(r.image_key),
        ]),
      ),
    );

    return species.map((s) => {
      const ownedPetId = ownedBySpecies.get(s.species_id) ?? null;
      // 키워 본 적 없는 종류는 무엇인지 모르게: 이름·설명·아기·성체 그림을 숨기고 알만 보여 준다
      const hidden = !ownedPetId;
      return {
        speciesId: s.species_id,
        code: hidden ? null : s.code,
        name: hidden ? '???' : s.name,
        description: hidden ? null : s.description,
        personality: hidden ? null : s.personality,
        worldText: hidden ? null : s.world_text,
        hidden,
        category: null,
        hatchMissionCount: HATCH_MISSIONS,
        unlock: this.evaluateUnlock(s, progress),
        ownedPetId,
        stages: stages.rows
          .filter((r) => r.species_version_id === s.version_id)
          .map((r) => {
            const show = !hidden || r.stage_no === 1;
            return {
              stageNo: r.stage_no,
              stageCode: r.stage_code,
              minTotalXp: r.stage_no === 3 ? ADULT_XP : 0,
              bonusBasisPoints: 0,
              imageUrl: show
                ? (imageUrls.get(`${r.species_version_id}:${r.stage_no}`) ??
                  null)
                : null,
              stillUrl: show
                ? (stillUrls.get(`${r.species_version_id}:${r.stage_no}`) ??
                  null)
                : null,
            };
          }),
      };
    });
  }

  /**
   * 알 선택: 종류당 한 마리, 해금 조건을 충족해야 함
   * makeRepresentative이면 같은 트랜잭션에서 대표로 설정하고 보류 XP를 배정
   */
  async choosePet(userId, { speciesId, nickname, makeRepresentative = false }) {
    try {
      return await this.database.withTransaction(async (tx) => {
        // 같은 사용자의 동시 선택을 직렬화(고유 제약이 최종 방어선)
        await tx.query('SELECT 1 FROM profiles WHERE user_id = $1 FOR UPDATE', [
          userId,
        ]);

        const [species] = await this.querySpecies(tx, speciesId);
        if (!species) throw speciesNotFound();

        const unlock = this.evaluateUnlock(
          species,
          await this.unlockProgress(tx, userId),
        );
        if (!unlock.met) {
          throw new AppException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'pet_locked',
            '아직 해금되지 않은 펫',
            { details: { unlock } },
          );
        }

        const { rows: policies } = await tx.query(
          `SELECT id FROM pet_level_policy_versions
            WHERE effective_at <= now()
            ORDER BY effective_at DESC, version_no DESC LIMIT 1`,
        );
        if (!policies[0]) {
          // 서비스 시작 전 운영 설정 누락
          throw new Error('활성 펫 레벨 정책이 없음');
        }

        const petId = newId();
        await tx.query(
          `INSERT INTO user_pets
                  (id, user_id, species_id, species_version_id,
                   level_policy_version_id, nickname)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            petId,
            userId,
            speciesId,
            species.version_id,
            policies[0].id,
            nickname,
          ],
        );

        // A84: 대표 펫이 없으면 이 펫을 대표로 정하고 보류 XP를 지급
        let representative = makeRepresentative;
        if (!representative) {
          const { rows: profile } = await tx.query(
            'SELECT representative_pet_id FROM profiles WHERE user_id = $1',
            [userId],
          );
          representative = profile[0]?.representative_pet_id == null;
        }
        let assigned = [];
        if (representative) {
          assigned = await this.setRepresentativeIn(tx, userId, petId);
        }
        return {
          ...(await this.getPet(tx, userId, petId)),
          assignedPending: assigned,
        };
      });
    } catch (error) {
      rethrowConstraint(error, {
        user_pets_user_id_species_id_key: petOwned,
        user_pets_nickname_ci_uq: nicknameTaken,
      });
    }
  }

  /** 보유 펫 목록 */
  async listPets(userId) {
    return this.queryPets(this.database, userId);
  }

  async getPet(db, userId, petId) {
    const [pet] = await this.queryPets(db, userId, petId);
    if (!pet) throw petNotFound();
    return pet;
  }

  async queryPets(db, userId, petId = null) {
    const { rows } = await db.query(
      `SELECT p.id, p.species_id, s.code, v.name AS species_name, p.nickname,
              p.total_xp, p.level_no, p.stage_no, p.selected_at,
              v.hatch_mission_count, sv.stage_code, sv.bonus_basis_points,
              si.r2_object_key AS image_key,
              ARRAY(SELECT d.text_content FROM pet_stage_dialogues d
                     WHERE d.species_version_id = p.species_version_id
                       AND d.stage_no = p.stage_no
                     ORDER BY d.display_order, d.dialogue_no LIMIT 5) AS dialogues,
              (p.id = pr.representative_pet_id) AS representative,
              (SELECT n.min_total_xp FROM pet_stage_versions n
                WHERE n.species_version_id = p.species_version_id
                  AND n.stage_no = p.stage_no + 1) AS next_stage_xp,
              (SELECT t.min_total_xp FROM pet_level_thresholds t
                WHERE t.policy_version_id = p.level_policy_version_id
                  AND t.level_no = p.level_no + 1) AS next_level_xp,
              (SELECT count(DISTINCT m.id)
                 FROM missions m
                 JOIN mission_records mr ON mr.mission_id = m.id
                 JOIN verification_results vr ON vr.record_id = mr.id
                WHERE m.user_id = p.user_id
                  AND m.status = 'completed' AND mr.started_at >= p.selected_at
                  AND vr.decision = 'approved' AND vr.is_current) AS hatch_progress
         FROM user_pets p
         JOIN pet_species s ON s.id = p.species_id
         JOIN pet_species_versions v ON v.id = p.species_version_id
         JOIN pet_stage_versions sv
           ON sv.species_version_id = p.species_version_id AND sv.stage_no = p.stage_no
         LEFT JOIN pet_stage_images si ON si.id = sv.image_id
         LEFT JOIN profiles pr ON pr.user_id = p.user_id
        WHERE p.user_id = $1 AND ($2::short_id IS NULL OR p.id = $2)
        ORDER BY p.selected_at, p.id`,
      [userId, petId],
    );
    const imageUrls = await Promise.all(
      rows.map((r) => this.imageUrl(r.image_key)),
    );
    const stillUrls = await Promise.all(
      rows.map((r) => this.stillUrl(r.image_key)),
    );
    return rows.map((r, index) => ({
      id: r.id,
      speciesId: r.species_id,
      speciesCode: r.code,
      speciesName: r.species_name,
      nickname: r.nickname,
      totalXp: num(r.total_xp),
      levelNo: r.level_no,
      nextLevelXp: r.next_level_xp === null ? null : num(r.next_level_xp),
      stageNo: r.stage_no,
      stageCode: r.stage_code,
      nextStageXp: r.stage_no === 2 ? ADULT_XP : null,
      hatch: {
        required: HATCH_MISSIONS,
        progress: Math.min(num(r.hatch_progress), HATCH_MISSIONS),
      },
      // 022 성장 규칙: 알은 세부 미션 3개로 부화, 아기는 먹인 경험치 450으로 성체
      growth: {
        hatchRequired: HATCH_MISSIONS,
        hatchDone: Math.min(num(r.hatch_progress), HATCH_MISSIONS),
        xp: Math.min(num(r.total_xp), ADULT_XP),
        adultXp: ADULT_XP,
        canEat: r.stage_no === 2,
      },
      representative: Boolean(r.representative),
      selectedAt: r.selected_at,
      // 모바일 클라이언트(07 Pet) 키
      bonusRate: 0,
      isRepresentative: Boolean(r.representative),
      imageUrl: imageUrls[index],
      stillUrl: stillUrls[index],
      // 07 DTO 사전 Pet 키: 알 단계일 때만 부화 진행, 대사는 하나
      hatchProgress:
        r.stage_no === 1
          ? {
              required: HATCH_MISSIONS,
              done: Math.min(num(r.hatch_progress), HATCH_MISSIONS),
            }
          : null,
      dialogue: (r.dialogues ?? [])[0] ?? null,
      dialogues: r.dialogues ?? [],
      hatchedAt: r.selected_at,
    }));
  }

  async renamePet(userId, petId, nickname) {
    try {
      const { rowCount } = await this.database.query(
        `UPDATE user_pets SET nickname = $3, updated_at = now()
          WHERE id = $1 AND user_id = $2`,
        [petId, userId, nickname],
      );
      if (rowCount === 0) throw petNotFound();
    } catch (error) {
      rethrowConstraint(error, { user_pets_nickname_ci_uq: nicknameTaken });
    }
    return this.getPet(this.database, userId, petId);
  }

  /** 대표 펫 설정, 대표가 없던 동안 보류된 펫 XP는 이때 한 번 배정 */
  async setRepresentative(userId, petId) {
    const assigned = await this.database.withTransaction((tx) =>
      this.setRepresentativeIn(tx, userId, petId),
    );
    return {
      pet: await this.getPet(this.database, userId, petId),
      assignedPending: assigned,
    };
  }

  async setRepresentativeIn(tx, userId, petId) {
    const { rowCount: hasProfile } = await tx.query(
      'SELECT 1 FROM profiles WHERE user_id = $1 FOR UPDATE',
      [userId],
    );
    if (hasProfile === 0) throw notFound('not_found', '계정을 찾을 수 없음')();

    const { rowCount: owns } = await tx.query(
      'SELECT 1 FROM user_pets WHERE id = $1 AND user_id = $2',
      [petId, userId],
    );
    if (owns === 0) throw petNotFound();

    await tx.query(
      'UPDATE profiles SET representative_pet_id = $2, updated_at = now() WHERE user_id = $1',
      [userId, petId],
    );
    const { items } = await this.experience.assignPendingExperience(tx, {
      userId,
      petId,
    });
    return items;
  }

  /** 대표 해제, 이미 받은 XP는 그대로이고 이후 시작하는 미션부터 펫 XP가 보류됨 */
  async clearRepresentative(userId) {
    await this.database.query(
      'UPDATE profiles SET representative_pet_id = NULL, updated_at = now() WHERE user_id = $1',
      [userId],
    );
  }
}
