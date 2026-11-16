import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AppException } from '../common/errors/app-exception.js';
import { newId } from '../common/ids.js';
import { computeLevel, computeStage } from './experience-ledger.js';

/**
 * 펫 경험치 지갑 (db/migrations/022_pet_feeding.sql)
 *   - 미션 보상 펫 XP는 펫에게 바로 가지 않고 지갑에 쌓인다 (하루 첫 미션만 30)
 *   - 사용자가 "경험치 주기"를 누르면 지갑에서 10씩 빼서 키우는 펫에게 준다
 *   - 알 → 아기: 알을 고른 뒤 완료한 세부 미션 3개, 아기 → 성체: 먹인 경험치 450
 */
export const MISSION_PET_XP = 30;
export const FEED_XP = 10;
export const HATCH_MISSIONS = 3;
export const ADULT_XP = 450;

const num = (value) => Number(value);

/** 지금 한국 날짜 'YYYY-MM-DD' */
export function kstToday(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
}

@Injectable()
@Dependencies(DatabaseService)
export class PetXpService {
  constructor(database) {
    this.database = database;
  }

  /** 지갑 행 잠금(없으면 0으로 만든 뒤 잠금) */
  async lockWallet(tx, userId) {
    await tx.query(
      `INSERT INTO pet_xp_wallets (user_id, balance) VALUES ($1, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
    const { rows } = await tx.query(
      'SELECT balance FROM pet_xp_wallets WHERE user_id = $1 FOR UPDATE',
      [userId],
    );
    return num(rows[0].balance);
  }

  async move(
    tx,
    userId,
    balance,
    {
      kind,
      delta,
      sourceType = null,
      sourceId = null,
      petId = null,
      rewardDate = null,
    },
  ) {
    const after = balance + delta;
    await tx.query(
      `INSERT INTO pet_xp_wallet_transactions
              (id, user_id, kind, xp_delta, balance_after, source_type, source_id, user_pet_id, reward_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        newId(),
        userId,
        kind,
        delta,
        after,
        sourceType,
        sourceId,
        petId,
        rewardDate,
      ],
    );
    await tx.query(
      'UPDATE pet_xp_wallets SET balance = $2, updated_at = now() WHERE user_id = $1',
      [userId, after],
    );
    return after;
  }

  /** 앱에 보여 줄 지갑 상태 */
  async getWallet(db, userId) {
    const today = kstToday();
    const { rows } = await db.query(
      `SELECT COALESCE((SELECT balance FROM pet_xp_wallets WHERE user_id = $1), 0) AS balance,
              EXISTS (SELECT 1 FROM pet_xp_wallet_transactions
                       WHERE user_id = $1 AND kind = 'mission' AND reward_date = $2) AS earned_today`,
      [userId, today],
    );
    return {
      balance: num(rows[0].balance),
      earnedToday: rows[0].earned_today,
      missionPetXp: MISSION_PET_XP,
      feedXp: FEED_XP,
    };
  }

  /** 미션 완료 보상: 오늘(KST) 처음이면 30 적립, 아니면 0 */
  async creditMission(tx, { userId, missionId }) {
    const balance = await this.lockWallet(tx, userId);
    const today = kstToday();
    const { rows } = await tx.query(
      `SELECT 1 FROM pet_xp_wallet_transactions
        WHERE user_id = $1 AND ((kind = 'mission' AND reward_date = $2)
           OR (kind IN ('mission', 'reward') AND source_type = 'mission' AND source_id = $3))`,
      [userId, today, missionId],
    );
    if (rows[0]) return 0;
    await this.move(tx, userId, balance, {
      kind: 'mission',
      delta: MISSION_PET_XP,
      sourceType: 'mission',
      sourceId: missionId,
      rewardDate: today,
    });
    return MISSION_PET_XP;
  }

  /** 업적·챌린지 등 다른 보상의 펫 XP (하루 한도 없음) */
  async creditReward(tx, { userId, sourceType, sourceId, amount }) {
    if (!(amount > 0)) return 0;
    const balance = await this.lockWallet(tx, userId);
    const { rows } = await tx.query(
      `SELECT 1 FROM pet_xp_wallet_transactions
        WHERE user_id = $1 AND kind IN ('mission', 'reward') AND source_type = $2 AND source_id = $3`,
      [userId, sourceType, sourceId],
    );
    if (rows[0]) return 0;
    await this.move(tx, userId, balance, {
      kind: 'reward',
      delta: amount,
      sourceType,
      sourceId,
    });
    return amount;
  }

  /**
   * 보상 취소(승인 번복 등): 그 출처로 적립한 만큼 회수. 이미 먹였으면 남은 만큼만.
   * @returns {Promise<number>} 회수한 양(양수)
   */
  async reverseSource(tx, { userId, sourceType, sourceId }) {
    const balance = await this.lockWallet(tx, userId);
    const { rows } = await tx.query(
      `SELECT COALESCE(sum(xp_delta), 0) AS credited FROM pet_xp_wallet_transactions
        WHERE user_id = $1 AND source_type = $2 AND source_id = $3
          AND kind IN ('mission', 'reward', 'reversal')`,
      [userId, sourceType, sourceId],
    );
    const take = Math.min(num(rows[0].credited), balance);
    if (take <= 0) return 0;
    await this.move(tx, userId, balance, {
      kind: 'reversal',
      delta: -take,
      sourceType,
      sourceId,
    });
    return take;
  }

  /**
   * 회수했던 보상을 되살림(이의 신청 승인 등): 처음 적립한 양 - 지금 남은 순적립만큼 다시 넣는다
   * @returns {Promise<number>} 되살린 양
   */
  async restoreSource(tx, { userId, sourceType, sourceId }) {
    const balance = await this.lockWallet(tx, userId);
    const { rows } = await tx.query(
      `SELECT COALESCE(sum(xp_delta) FILTER (WHERE kind IN ('mission', 'reward')), 0) AS original,
              COALESCE(sum(xp_delta), 0) AS net
         FROM pet_xp_wallet_transactions
        WHERE user_id = $1 AND source_type = $2 AND source_id = $3
          AND kind IN ('mission', 'reward', 'reversal')`,
      [userId, sourceType, sourceId],
    );
    const give = num(rows[0].original) - num(rows[0].net);
    if (give <= 0) return 0;
    await this.move(tx, userId, balance, {
      kind: 'reversal',
      delta: give,
      sourceType,
      sourceId,
    });
    return give;
  }

  /** 펫 한 마리의 단계·레벨을 지금 기록에 맞게 다시 계산해 저장, 단계가 바뀌면 진화 기록 */
  async syncPet(tx, pet, totalXp = pet.totalXp) {
    const stageNo = await computeStage(
      tx,
      { userId: pet.userId, selectedAt: pet.selectedAt },
      totalXp,
    );
    const levelNo = await computeLevel(
      tx,
      'pet_level_thresholds',
      pet.levelPolicyVersionId,
      totalXp,
    );
    if (
      stageNo === pet.stageNo &&
      levelNo === pet.levelNo &&
      totalXp === pet.totalXp
    ) {
      return { stageNo, evolved: false };
    }
    await tx.query(
      `UPDATE user_pets SET total_xp = $2, level_no = $3, stage_no = $4, updated_at = now()
        WHERE id = $1`,
      [pet.id, totalXp, levelNo, stageNo],
    );
    // 단계 변화는 한 칸씩 기록 (알 → 아기 → 성체)
    const step = stageNo > pet.stageNo ? 1 : -1;
    for (let from = pet.stageNo; from !== stageNo; from += step) {
      await tx.query(
        `INSERT INTO pet_evolution_events (id, user_pet_id, from_stage_no, to_stage_no, total_xp_after, reason)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          newId(),
          pet.id,
          from,
          from + step,
          totalXp,
          step > 0 ? 'growth' : 'reversal',
        ],
      );
    }
    return { stageNo, evolved: stageNo > pet.stageNo };
  }

  /** 사용자의 모든 펫 단계를 다시 맞춤 (미션 완료·취소 뒤 부화 여부) */
  async syncAllPets(tx, userId) {
    const { rows } = await tx.query(
      `SELECT id, user_id, level_policy_version_id, selected_at, total_xp, level_no, stage_no
         FROM user_pets WHERE user_id = $1 ORDER BY id FOR UPDATE`,
      [userId],
    );
    const hatched = [];
    for (const r of rows) {
      const pet = {
        id: r.id,
        userId: r.user_id,
        levelPolicyVersionId: r.level_policy_version_id,
        selectedAt: r.selected_at,
        totalXp: num(r.total_xp),
        levelNo: r.level_no,
        stageNo: r.stage_no,
      };
      const result = await this.syncPet(tx, pet);
      if (result.evolved) hatched.push(r.id);
    }
    return hatched;
  }

  /**
   * 경험치 주기: 지갑에서 10을 빼서 펫에게. 아기 단계만 먹을 수 있다.
   * @returns {Promise<{petId: string, fedXp: number, totalXp: number, stageNo: number, evolved: boolean, balance: number}>}
   */
  async feed(userId, petId) {
    return this.database.withTransaction(async (tx) => {
      const balance = await this.lockWallet(tx, userId);
      const { rows } = await tx.query(
        `SELECT id, user_id, level_policy_version_id, selected_at, total_xp, level_no, stage_no
           FROM user_pets WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [petId, userId],
      );
      if (!rows[0]) {
        throw new AppException(
          HttpStatus.NOT_FOUND,
          'pet_not_found',
          '펫을 찾을 수 없음',
        );
      }
      const r = rows[0];
      const pet = {
        id: r.id,
        userId,
        levelPolicyVersionId: r.level_policy_version_id,
        selectedAt: r.selected_at,
        totalXp: num(r.total_xp),
        levelNo: r.level_no,
        stageNo: r.stage_no,
      };
      if (pet.stageNo === 1) {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'PET_EGG_CANNOT_EAT',
          `알은 아직 먹을 수 없어요. 세부 미션 ${HATCH_MISSIONS}개를 완료하면 부화해요.`,
        );
      }
      if (pet.stageNo === 3 || pet.totalXp >= ADULT_XP) {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'PET_FULLY_GROWN',
          '이미 다 자란 펫이에요.',
        );
      }
      if (balance < FEED_XP) {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'PET_XP_NOT_ENOUGH',
          '줄 수 있는 경험치가 부족해요. 미션을 완료하면 경험치를 받아요.',
        );
      }
      const fed = Math.min(FEED_XP, ADULT_XP - pet.totalXp);
      const after = await this.move(tx, userId, balance, {
        kind: 'feed',
        delta: -fed,
        petId,
      });
      const totalXp = pet.totalXp + fed;
      const { stageNo, evolved } = await this.syncPet(tx, pet, totalXp);
      return {
        petId,
        fedXp: fed,
        totalXp,
        requiredXp: ADULT_XP,
        stageNo,
        evolved,
        balance: after,
      };
    });
  }
}
