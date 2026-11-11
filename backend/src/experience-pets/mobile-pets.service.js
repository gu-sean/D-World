import { Dependencies, Injectable } from '@nestjs/common';
import { notFound } from '../common/errors/http-errors.js';
import { DatabaseService } from '../database/database.service.js';
import { PetsService } from './pets.service.js';

/** 해금 조건 유형: DB 값 → 모바일 unlockConditionType */
const UNLOCK_TYPES = {
  approved_mission_count: 'approved_mission_count',
  category_approved_mission_count: 'category_approved_mission_count',
  streak_milestone: 'streak_milestone',
  achievement_earned: 'achievement',
};

/** 모바일 클라이언트 펫 조회 (08 A81~A83·A85, 07 PetSpecies·PetEvolution) */
@Injectable()
@Dependencies(DatabaseService, PetsService)
export class MobilePetsService {
  constructor(database, pets) {
    this.database = database;
    this.pets = pets;
  }

  toSpecies(view, categoryCodes) {
    return {
      id: view.speciesId,
      code: view.code,
      name: view.name,
      description: view.description,
      personality: view.personality,
      worldText: view.worldText,
      categoryCode: categoryCodes.get(view.category.id) ?? null,
      unlockConditionType: UNLOCK_TYPES[view.unlock.type] ?? 'always',
      unlockTargetCount: view.unlock.targetCount ?? null,
      unlocked: view.unlock.met,
      owned: view.ownedPetId !== null,
      hatchMissionCount: view.hatchMissionCount,
      stages: view.stages.map((stage) => ({
        stageNo: stage.stageNo,
        stageCode: stage.stageCode,
        minTotalXp: stage.minTotalXp,
        bonusRate: stage.bonusBasisPoints / 10_000,
        imageUrl: null,
      })),
    };
  }

  async categoryCodes() {
    const { rows } = await this.database.query(
      'SELECT id, code FROM goal_categories',
    );
    return new Map(rows.map((r) => [r.id, r.code]));
  }

  async listSpecies(userId, { categoryId } = {}) {
    const [views, codes] = await Promise.all([
      this.pets.listSpecies(userId),
      this.categoryCodes(),
    ]);
    return views
      .filter((view) => !categoryId || view.category.id === categoryId)
      .map((view) => this.toSpecies(view, codes));
  }

  async speciesDetail(userId, speciesId) {
    const found = (await this.listSpecies(userId)).find(
      (species) => species.id === speciesId,
    );
    if (!found) throw notFound('species_not_found', '펫 종류를 찾을 수 없음');
    return found;
  }

  /** A83: 설정한 Pet 하나 */
  async setRepresentative(userId, petId) {
    const { pet } = await this.pets.setRepresentative(userId, petId);
    return pet;
  }

  /** A85: 내 펫의 단계 변화 기록, after 이후 오래된 순 (클라이언트가 받은 occurredAt은 밀리초까지라 같은 정밀도로 비교) */
  async evolutionEvents(userId, petId, after) {
    await this.pets.getPet(this.database, userId, petId);
    const { rows } = await this.database.query(
      `SELECT e.id, e.user_pet_id, e.occurred_at,
              f.stage_code AS from_code, f.bonus_basis_points AS from_bonus,
              t.stage_code AS to_code, t.bonus_basis_points AS to_bonus,
              ARRAY(SELECT d.text_content FROM pet_stage_dialogues d
                     WHERE d.species_version_id = p.species_version_id
                       AND d.stage_no = e.to_stage_no
                     ORDER BY d.display_order, d.dialogue_no LIMIT 3) AS dialogues
         FROM pet_evolution_events e
         JOIN user_pets p ON p.id = e.user_pet_id
         JOIN pet_stage_versions f
           ON f.species_version_id = p.species_version_id AND f.stage_no = e.from_stage_no
         JOIN pet_stage_versions t
           ON t.species_version_id = p.species_version_id AND t.stage_no = e.to_stage_no
        WHERE p.id = $1 AND p.user_id = $2
          AND ($3::timestamptz IS NULL
               OR date_trunc('milliseconds', e.occurred_at) > $3::timestamptz)
        ORDER BY e.occurred_at, e.id`,
      [petId, userId, after ?? null],
    );
    return rows.map((row) => ({
      id: row.id,
      petId: row.user_pet_id,
      fromStageCode: row.from_code,
      toStageCode: row.to_code,
      bonusRateBefore: row.from_bonus / 10_000,
      bonusRateAfter: row.to_bonus / 10_000,
      newDialogues: row.dialogues ?? [],
      occurredAt: row.occurred_at,
    }));
  }
}
