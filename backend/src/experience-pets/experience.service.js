import { randomUUID } from 'node:crypto';
import { Dependencies, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';
import { DatabaseService } from '../database/database.service.js';
import {
  computeLevel,
  computeStage,
  findOriginalTransaction,
  firstLevelUpXp,
  insertExperienceTransaction,
  lockPet,
  lockUserExperience,
} from './experience-ledger.js';

const SOURCE_TYPES = new Set(['mission', 'achievement', 'streak', 'challenge']);

function assertXp(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name}는 0 이상의 정수여야 함: ${value}`);
  }
}

const num = (value) => Number(value);

/** 적립 거래 키는 근거 id로 충분, 번복·복구는 같은 근거가 여러 번 반복될 수 있어 resultId까지 포함 */
function ledgerKey(kind, awardId, recipient, resultId) {
  return kind === 'award'
    ? `xp:award:${awardId}:${recipient}`
    : `xp:${kind}:${awardId}:${resultId}:${recipient}`;
}

/**
 * 사용자·펫 XP 원장, 보류 XP, 레벨·진화 공통 서비스
 * 변경 메서드는 호출자가 연 트랜잭션(tx)을 받고, 같은 호출을 반복해도 한 번만 반영
 * 잠금 순서: 지급 대상(experience_awards) → user_experience → user_pets (03-reward-services-design.md)
 */
@Injectable()
@Dependencies(DatabaseService)
export class ExperienceService {
  logger = new Logger(ExperienceService.name);

  constructor(database) {
    this.database = database;
  }

  /**
   * XP 지급. recipient가 없으면 기본 펫 XP는 pending_pet_experience에 보류(보너스 없음)
   * recipient: { petId, stageNo, bonusBasisPoints } — 호출자가 수행 시작 때 고정한 값
   * 보너스는 미션 지급에만 적용(업적·스트릭은 0으로 강제)
   */
  async awardExperience(
    tx,
    { userId, sourceType, sourceId, userXp, basePetXp, recipient = null },
  ) {
    if (!SOURCE_TYPES.has(sourceType)) {
      throw new RangeError(`지원하지 않는 소스: ${sourceType}`);
    }
    assertXp(userXp, 'userXp');
    assertXp(basePetXp, 'basePetXp');

    const existing = await this.findAward(
      tx,
      userId,
      sourceType,
      sourceId,
      true,
    );
    if (existing) return this.existingResult(existing, userXp, basePetXp);

    const onMissingPolicy = () => {
      throw new AppException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'experience_policy_missing',
        '활성 사용자 레벨 정책이 없음',
      );
    };
    await lockUserExperience(tx, userId, () => {
      this.logger.error(`사용자 레벨 정책 없음: ${userId}`);
      return onMissingPolicy();
    });
    // 같은 사용자의 동시 요청은 user_experience 잠금에서 직렬화되므로 잠근 뒤 한 번 더 확인
    const raced = await this.findAward(tx, userId, sourceType, sourceId, false);
    if (raced) return this.existingResult(raced, userXp, basePetXp);

    const bonusBasisPoints =
      sourceType === 'mission' ? (recipient?.bonusBasisPoints ?? 0) : 0;
    if (
      !Number.isInteger(bonusBasisPoints) ||
      bonusBasisPoints < 0 ||
      bonusBasisPoints > 2000
    ) {
      throw new RangeError(
        `bonusBasisPoints는 0~2000 정수여야 함: ${bonusBasisPoints}`,
      );
    }
    const bonusPetXp = recipient
      ? Math.floor((basePetXp * bonusBasisPoints) / 10000)
      : 0;

    let speciesVersionId = null;
    if (recipient) {
      const pet = await lockPet(tx, recipient.petId);
      if (!pet || pet.userId !== userId) {
        throw new AppException(
          HttpStatus.NOT_FOUND,
          'pet_not_found',
          '수령 펫을 찾을 수 없음',
        );
      }
      speciesVersionId = pet.speciesVersionId;
    }

    const awardId = randomUUID();
    await tx.query(
      `INSERT INTO experience_awards
              (id, user_id, source_type, source_id, recipient_pet_id,
               base_user_xp, base_pet_xp, bonus_pet_xp, pet_species_version_id,
               pet_stage_no, bonus_basis_points, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active')`,
      [
        awardId,
        userId,
        sourceType,
        sourceId,
        recipient?.petId ?? null,
        userXp,
        basePetXp,
        bonusPetXp,
        speciesVersionId,
        recipient?.stageNo ?? null,
        bonusBasisPoints,
      ],
    );

    let userApplied = 0;
    if (userXp > 0) {
      userApplied = await this.applyUserDelta(tx, {
        awardId,
        userId,
        delta: userXp,
        kind: 'award',
      });
    }

    let petApplied = 0;
    if (recipient) {
      const petDelta = basePetXp + bonusPetXp;
      if (petDelta > 0) {
        petApplied = await this.applyPetDelta(tx, {
          awardId,
          petId: recipient.petId,
          delta: petDelta,
          kind: 'award',
        });
      }
    } else {
      await tx.query(
        `INSERT INTO pending_pet_experience (experience_award_id, user_id, base_pet_xp, status)
         VALUES ($1, $2, $3, 'pending')`,
        [awardId, userId, basePetXp],
      );
    }

    return {
      outcome: 'created',
      awardId,
      userXp: userApplied,
      petXp: recipient ? petApplied : 0,
      pendingPetXp: recipient ? 0 : basePetXp,
    };
  }

  /** 판정 번복 등으로 지급 회수, resultId는 번복을 일으킨 판정 결과 id(멱등 키에 사용) */
  async revokeExperience(tx, { awardId, resultId }) {
    const award = await this.lockAward(tx, awardId);
    if (award.status === 'revoked') return { outcome: 'already_applied' };

    let userReversed = 0;
    if (num(award.base_user_xp) > 0) {
      userReversed = await this.applyUserDelta(tx, {
        awardId,
        userId: award.user_id,
        delta: -num(award.base_user_xp),
        kind: 'reversal',
        resultId,
      });
    }

    let petReversed = 0;
    if (award.recipient_pet_id) {
      const petDelta = -(num(award.base_pet_xp) + num(award.bonus_pet_xp));
      if (petDelta < 0) {
        petReversed = await this.applyPetDelta(tx, {
          awardId,
          petId: award.recipient_pet_id,
          delta: petDelta,
          kind: 'reversal',
          resultId,
        });
      }
    } else {
      await tx.query(
        `UPDATE pending_pet_experience SET status = 'cancelled'
          WHERE experience_award_id = $1 AND status = 'pending'`,
        [awardId],
      );
    }

    await this.setAwardStatus(tx, awardId, 'revoked');
    return { outcome: 'revoked', userXp: userReversed, petXp: petReversed };
  }

  /** 재승인 등으로 원 수령자·원 금액을 복구(현재 정책으로 재계산하지 않음) */
  async reinstateExperience(tx, { awardId, resultId }) {
    const award = await this.lockAward(tx, awardId);
    if (award.status === 'active') return { outcome: 'already_applied' };

    let userReturned = 0;
    if (num(award.base_user_xp) > 0) {
      userReturned = await this.applyUserDelta(tx, {
        awardId,
        userId: award.user_id,
        delta: num(award.base_user_xp),
        kind: 'reinstatement',
        resultId,
      });
    }

    let petReturned = 0;
    if (award.recipient_pet_id) {
      const petDelta = num(award.base_pet_xp) + num(award.bonus_pet_xp);
      if (petDelta > 0) {
        petReturned = await this.applyPetDelta(tx, {
          awardId,
          petId: award.recipient_pet_id,
          delta: petDelta,
          kind: 'reinstatement',
          resultId,
        });
      }
    } else {
      await tx.query(
        `UPDATE pending_pet_experience SET status = 'pending'
          WHERE experience_award_id = $1 AND status = 'cancelled'`,
        [awardId],
      );
    }

    await this.setAwardStatus(tx, awardId, 'active');
    return { outcome: 'reinstated', userXp: userReturned, petXp: petReturned };
  }

  /**
   * 대표 펫 최초 선택 시 보류 XP 일괄 배정(오래된 순), 버프 없음, 소급 없음
   * 이미 배정된 XP는 이동하지 않음(이 메서드가 다루는 대상은 status='pending'뿐)
   */
  async assignPendingExperience(tx, { userId, petId }) {
    const pet = await lockPet(tx, petId);
    if (!pet || pet.userId !== userId) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'pet_not_found',
        '펫을 찾을 수 없음',
      );
    }

    const { rows: pendings } = await tx.query(
      `SELECT experience_award_id, base_pet_xp FROM pending_pet_experience
        WHERE user_id = $1 AND status = 'pending'
        ORDER BY created_at, experience_award_id FOR UPDATE`,
      [userId],
    );

    const items = [];
    for (const row of pendings) {
      const awardId = row.experience_award_id;
      const basePetXp = num(row.base_pet_xp);

      await tx.query(
        `UPDATE experience_awards
            SET recipient_pet_id = $2, pet_species_version_id = $3, pet_stage_no = $4
          WHERE id = $1`,
        [awardId, petId, pet.speciesVersionId, pet.stageNo],
      );
      await tx.query(
        `UPDATE pending_pet_experience
            SET status = 'assigned', assigned_pet_id = $2, assigned_at = now()
          WHERE experience_award_id = $1`,
        [awardId, petId],
      );

      let applied = 0;
      if (basePetXp > 0) {
        applied = await this.applyPetDelta(tx, {
          awardId,
          petId,
          delta: basePetXp,
          kind: 'award',
        });
      }
      items.push({ awardId, petXp: applied });
    }

    return { outcome: 'assigned', items };
  }

  /**
   * 관리자 정정: 특정 지급이 원래 전달해야 했던 금액 중 아직 반영되지 않은 몫만 보충
   * 근거 없는 임의 차감은 만들지 않음(정책 13 "근거 없는 차감은 불가")
   */
  async adminCorrect(tx, { adminId, awardId, reason }) {
    if (typeof reason !== 'string' || reason.trim() === '') {
      throw new RangeError('사유가 필요함');
    }
    const award = await this.lockAward(tx, awardId);
    if (award.status !== 'active') {
      throw new AppException(
        HttpStatus.CONFLICT,
        'reward_conflict',
        '회수된 지급은 정정할 수 없음, 먼저 복구할 것',
      );
    }

    const userExpected = num(award.base_user_xp);
    const userAppliedSoFar = await this.appliedAmount(tx, awardId, 'user');
    const userMissing = userExpected - userAppliedSoFar;
    let userCorrected = 0;
    if (userMissing > 0) {
      userCorrected = await this.applyUserDelta(tx, {
        awardId,
        userId: award.user_id,
        delta: userMissing,
        kind: 'admin_adjustment',
        resultId: `admin:${randomUUID()}`,
        adminId,
        reason,
      });
    }

    let petCorrected = 0;
    if (award.recipient_pet_id) {
      const petExpected = num(award.base_pet_xp) + num(award.bonus_pet_xp);
      const petAppliedSoFar = await this.appliedAmount(tx, awardId, 'pet');
      const petMissing = petExpected - petAppliedSoFar;
      if (petMissing > 0) {
        petCorrected = await this.applyPetDelta(tx, {
          awardId,
          petId: award.recipient_pet_id,
          delta: petMissing,
          kind: 'admin_adjustment',
          resultId: `admin:${randomUUID()}`,
          adminId,
          reason,
        });
      }
    }

    return { outcome: 'corrected', userXp: userCorrected, petXp: petCorrected };
  }

  /** 지급액 중 현재까지 원장에 실제로 반영된 합계(+면 지급, -면 회수) */
  async appliedAmount(db, awardId, recipientKind) {
    const { rows } = await db.query(
      `SELECT coalesce(sum(xp_delta), 0) AS total FROM experience_transactions
        WHERE experience_award_id = $1 AND recipient_kind = $2`,
      [awardId, recipientKind],
    );
    return num(rows[0].total);
  }

  /** 사용자 XP 계정에 delta만큼 반영(0 미만으로 내려가지 않음), 실제 반영액 반환 */
  async applyUserDelta(
    tx,
    { awardId, userId, delta, kind, resultId, adminId, reason },
  ) {
    const { rows } = await tx.query(
      `SELECT level_policy_version_id, total_xp FROM user_experience
        WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    const current = num(rows[0].total_xp);
    const newTotal = Math.max(0, current + delta);
    const applied = newTotal - current;
    if (applied === 0) return 0;

    const newLevel = await computeLevel(
      tx,
      'user_level_thresholds',
      rows[0].level_policy_version_id,
      newTotal,
    );
    await tx.query(
      `UPDATE user_experience SET total_xp = $2, level_no = $3, updated_at = now()
        WHERE user_id = $1`,
      [userId, newTotal, newLevel],
    );

    const originalTransactionId =
      kind === 'reversal' || kind === 'reinstatement'
        ? await findOriginalTransaction(tx, {
            experienceAwardId: awardId,
            recipientKind: 'user',
            kind: kind === 'reversal' ? 'award' : 'reversal',
          })
        : null;

    await insertExperienceTransaction(tx, {
      userId,
      recipientKind: 'user',
      experienceAwardId: awardId,
      xpDelta: applied,
      balanceAfter: newTotal,
      kind,
      originalTransactionId,
      key: ledgerKey(kind, awardId, 'user', resultId),
      adminId,
      reason,
    });
    return applied;
  }

  /** 펫 XP 계정에 delta만큼 반영(0 미만으로 내려가지 않음), 단계 변화는 이력으로 남김 */
  async applyPetDelta(
    tx,
    { awardId, petId, delta, kind, resultId, adminId, reason },
  ) {
    const pet = await lockPet(tx, petId);
    const newTotal = Math.max(0, pet.totalXp + delta);
    const applied = newTotal - pet.totalXp;
    if (applied === 0) return 0;

    const newLevel = await computeLevel(
      tx,
      'pet_level_thresholds',
      pet.levelPolicyVersionId,
      newTotal,
    );
    const newStage = await computeStage(tx, pet, newTotal);
    await tx.query(
      `UPDATE user_pets SET total_xp = $2, level_no = $3, stage_no = $4, updated_at = now()
        WHERE id = $1`,
      [petId, newTotal, newLevel, newStage],
    );

    const originalTransactionId =
      kind === 'reversal' || kind === 'reinstatement'
        ? await findOriginalTransaction(tx, {
            experienceAwardId: awardId,
            recipientKind: 'pet',
            kind: kind === 'reversal' ? 'award' : 'reversal',
          })
        : null;

    await insertExperienceTransaction(tx, {
      userId: pet.userId,
      recipientKind: 'pet',
      userPetId: petId,
      experienceAwardId: awardId,
      xpDelta: applied,
      balanceAfter: newTotal,
      kind,
      originalTransactionId,
      key: ledgerKey(kind, awardId, 'pet', resultId),
      adminId,
      reason,
    });

    if (newStage !== pet.stageNo) {
      const reason_ =
        kind === 'award'
          ? 'growth'
          : kind === 'reversal'
            ? 'reversal'
            : 'reinstatement';
      await this.recordEvolutionEvents(
        tx,
        petId,
        pet.stageNo,
        newStage,
        newTotal,
        reason_,
      );
    }
    return applied;
  }

  /**
   * 한 번의 변화로 임곗값을 여러 개 넘으면 단계마다 이력을 순서대로 남김
   * occurred_at은 clock_timestamp()로 명시(같은 트랜잭션의 now()는 고정값이라 순서 구분이 안 됨)
   */
  async recordEvolutionEvents(
    tx,
    petId,
    fromStage,
    toStage,
    totalXpAfter,
    reason,
  ) {
    const step = toStage > fromStage ? 1 : -1;
    for (let stage = fromStage; stage !== toStage; stage += step) {
      await tx.query(
        `INSERT INTO pet_evolution_events
                (id, user_pet_id, from_stage_no, to_stage_no, total_xp_after, reason, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, clock_timestamp())`,
        [randomUUID(), petId, stage, stage + step, totalXpAfter, reason],
      );
    }
  }

  async findAward(db, userId, sourceType, sourceId, lock) {
    const { rows } = await db.query(
      `SELECT id, status, base_user_xp, base_pet_xp, bonus_pet_xp, recipient_pet_id
         FROM experience_awards
        WHERE user_id = $1 AND source_type = $2 AND source_id = $3
        ${lock ? 'FOR UPDATE' : ''}`,
      [userId, sourceType, sourceId],
    );
    return rows[0] ?? null;
  }

  /**
   * 소스(사용자+유형+근거 id)로 지급 행 id만 조회
   * 호출자(업적·챌린지 등)가 자기 테이블에 awardId를 따로 저장하지 않고도
   * 회수·복구 시 revokeExperience/reinstateExperience에 넘길 id를 찾을 수 있게 함
   * XP를 지급한 적이 없으면(기본 펫 XP·사용자 XP 모두 0이라 recipient 없이도 호출 안 한 경우) null
   */
  async findAwardId(db, userId, sourceType, sourceId) {
    const award = await this.findAward(db, userId, sourceType, sourceId, false);
    return award?.id ?? null;
  }

  async lockAward(tx, awardId) {
    const { rows } = await tx.query(
      `SELECT id, user_id, status, base_user_xp, base_pet_xp, bonus_pet_xp, recipient_pet_id
         FROM experience_awards WHERE id = $1 FOR UPDATE`,
      [awardId],
    );
    if (!rows[0]) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'award_not_found',
        '지급 기록이 없음',
      );
    }
    return rows[0];
  }

  async setAwardStatus(tx, awardId, status) {
    await tx.query(
      'UPDATE experience_awards SET status = $2, updated_at = now() WHERE id = $1',
      [awardId, status],
    );
  }

  existingResult(award, userXp, basePetXp) {
    if (
      num(award.base_user_xp) !== userXp ||
      num(award.base_pet_xp) !== basePetXp
    ) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'reward_conflict',
        '이미 다른 금액으로 지급된 보상',
      );
    }
    return {
      outcome: 'already_applied',
      awardId: award.id,
      userXp: num(award.base_user_xp),
      petXp: num(award.base_pet_xp) + num(award.bonus_pet_xp),
      status: award.status,
    };
  }

  /** 누적 XP, 레벨, 다음 레벨까지, 대표 펫의 XP·단계. 보류 펫 XP 합계는 별도 */
  async getExperience(db, userId) {
    const { rows: uRows } = await db.query(
      `SELECT total_xp, level_no, level_policy_version_id
         FROM user_experience WHERE user_id = $1`,
      [userId],
    );
    const user = uRows[0];

    let nextLevelXp = null;
    if (user) {
      const { rows } = await db.query(
        `SELECT min_total_xp FROM user_level_thresholds
          WHERE policy_version_id = $1 AND level_no = $2`,
        [user.level_policy_version_id, Number(user.level_no) + 1],
      );
      nextLevelXp = rows[0] ? num(rows[0].min_total_xp) : null;
    } else {
      // 첫 XP를 얻기 전: 행이 없어도 다음 레벨 기준을 알려 준다(null이면 최고 레벨로 읽힘)
      nextLevelXp = await firstLevelUpXp(db);
    }

    const [{ rows: pending }, { rows: repRows }] = await Promise.all([
      db.query(
        `SELECT coalesce(sum(base_pet_xp), 0) AS pending FROM pending_pet_experience
          WHERE user_id = $1 AND status = 'pending'`,
        [userId],
      ),
      db.query(
        `SELECT p.id, p.total_xp, p.level_no, p.stage_no
           FROM profiles pr JOIN user_pets p ON p.id = pr.representative_pet_id
          WHERE pr.user_id = $1`,
        [userId],
      ),
    ]);

    return {
      totalXp: user ? num(user.total_xp) : 0,
      levelNo: user ? user.level_no : 1,
      nextLevelXp,
      pendingPetXp: num(pending[0].pending),
      representativePet: repRows[0]
        ? {
            petId: repRows[0].id,
            totalXp: num(repRows[0].total_xp),
            levelNo: repRows[0].level_no,
            stageNo: repRows[0].stage_no,
          }
        : null,
    };
  }
}
