import { randomUUID } from 'node:crypto';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';
import { DatabaseService } from '../database/database.service.js';
import { ExperienceService } from '../experience-pets/experience.service.js';
import { PointsService } from '../points/points.service.js';

/** trigger → 평가할 조건 유형. 'revoked'는 조건과 무관하게 활성 획득 전체를 재검사 */
const TRIGGER_CONDITIONS = {
  goal_completed: ['first_goal_completed'],
  mission_approved: [
    'approved_mission_count',
    'category_approved_mission_count',
  ],
  streak_milestone: ['streak_milestone'],
  challenge_completed: ['challenge_completed'],
};

const SOURCE_TYPE_BY_CONDITION = {
  first_goal_completed: 'goal',
  approved_mission_count: 'mission',
  category_approved_mission_count: 'mission',
  streak_milestone: 'streak',
  challenge_completed: 'challenge',
};

/** 포인트·XP를 지급하지 않는 조건(스트릭·챌린지는 각자 묶음이 소유, 정책 11) */
const SHARED_REWARD_CONDITIONS = new Set([
  'streak_milestone',
  'challenge_completed',
]);

const num = (value) => Number(value);

/**
 * 업적 조건 평가·지급·회수·복구 (3-A-3)
 * 포인트·XP 지급은 PointsService·ExperienceService에 같은 트랜잭션으로 위임
 * (docs/backend/03-reward-services-design.md)
 */
@Injectable()
@Dependencies(DatabaseService, PointsService, ExperienceService)
export class AchievementsService {
  constructor(database, points, experience) {
    this.database = database;
    this.points = points;
    this.experience = experience;
  }

  /**
   * trigger에 해당하는 조건 유형만 평가한다. 'revoked'면 사용자의 활성 획득 전체를
   * 다시 검사해 조건이 무너진 것을 회수. 공개된 현재 버전만 새 달성 대상
   */
  async evaluate(tx, { userId, trigger }) {
    if (trigger === 'revoked') return this.recheckActive(tx, userId);

    const conditionTypes = TRIGGER_CONDITIONS[trigger];
    if (!conditionTypes) {
      throw new RangeError(`지원하지 않는 trigger: ${trigger}`);
    }

    const candidates = await this.publicCandidates(tx, conditionTypes);
    const results = [];
    for (const candidate of candidates) {
      const existing = await this.findGrant(
        tx,
        userId,
        candidate.achievementId,
        true,
      );
      if (existing?.status === 'active') continue;

      const source = await this.checkQualification(tx, userId, candidate);
      if (!source) continue;

      if (existing) {
        await this.reinstateOne(tx, userId, existing, candidate);
        results.push({
          achievementId: candidate.achievementId,
          outcome: 'reinstated',
        });
      } else {
        const userAchievementId = await this.grantOne(
          tx,
          userId,
          candidate,
          source,
        );
        results.push({
          achievementId: candidate.achievementId,
          outcome: 'earned',
          userAchievementId,
        });
      }
    }
    return results;
  }

  /** 사용자의 활성 획득을 전부 잠그고 원본 조건을 다시 확인, 무너졌으면 회수 */
  async recheckActive(tx, userId) {
    const { rows } = await tx.query(
      `SELECT ua.id, ua.achievement_id, ua.source_id,
              av.condition_type, av.target_count, av.category_id
         FROM user_achievements ua
         JOIN achievement_versions av ON av.id = ua.achievement_version_id
        WHERE ua.user_id = $1 AND ua.status = 'active' FOR UPDATE`,
      [userId],
    );

    const results = [];
    for (const row of rows) {
      const stillQualifies = await this.recheckOne(tx, userId, row);
      if (!stillQualifies) {
        await this.revokeOne(tx, userId, row);
        results.push({ achievementId: row.achievement_id, outcome: 'revoked' });
      }
    }
    return results;
  }

  async recheckOne(db, userId, row) {
    if (row.condition_type === 'first_goal_completed') {
      const { rows } = await db.query(
        `SELECT status FROM goals WHERE id = $1 AND user_id = $2`,
        [row.source_id, userId],
      );
      return rows[0]?.status === 'completed';
    }
    if (
      row.condition_type === 'approved_mission_count' ||
      row.condition_type === 'category_approved_mission_count'
    ) {
      const count = await this.qualifyingMissionCount(
        db,
        userId,
        row.category_id,
      );
      return count >= row.target_count;
    }
    if (row.condition_type === 'streak_milestone') {
      const { rows } = await db.query(
        `SELECT status FROM streak_milestone_awards WHERE id = $1 AND user_id = $2`,
        [row.source_id, userId],
      );
      return rows[0]?.status === 'active';
    }
    // challenge_completed
    const { rows } = await db.query(
      `SELECT status FROM challenge_reward_grants WHERE id = $1 AND user_id = $2`,
      [row.source_id, userId],
    );
    return rows[0]?.status === 'active';
  }

  /** 공개 업적 중 현재(지금 이 시각 기준 가장 최근 발효) 버전이 해당 조건 유형인 것들 */
  async publicCandidates(db, conditionTypes) {
    const { rows } = await db.query(
      `SELECT ad.id AS achievement_id, cur.id AS version_id, cur.condition_type,
              cur.target_count, cur.category_id, cur.reward_points,
              cur.reward_user_xp, cur.reward_pet_xp, cur.badge_image_id
         FROM achievement_definitions ad
         JOIN LATERAL (
           SELECT * FROM achievement_versions v
            WHERE v.achievement_id = ad.id AND v.effective_at <= now()
            ORDER BY v.effective_at DESC, v.version_no DESC LIMIT 1
         ) cur ON true
        WHERE ad.status = 'public' AND cur.condition_type = ANY($1::text[])`,
      [conditionTypes],
    );
    return rows.map((r) => ({
      achievementId: r.achievement_id,
      versionId: r.version_id,
      conditionType: r.condition_type,
      targetCount: r.target_count,
      categoryId: r.category_id,
      rewardPoints: num(r.reward_points),
      rewardUserXp: num(r.reward_user_xp),
      rewardPetXp: num(r.reward_pet_xp),
      badgeImageId: r.badge_image_id,
    }));
  }

  /** 조건을 충족하면 { sourceId, firstAchievedAt }, 아니면 null */
  async checkQualification(db, userId, candidate) {
    if (candidate.conditionType === 'first_goal_completed') {
      const { rows } = await db.query(
        `SELECT id, completed_at FROM goals
          WHERE user_id = $1 AND status = 'completed'
          ORDER BY completed_at ASC LIMIT 1`,
        [userId],
      );
      if (!rows[0]) return null;
      return { sourceId: rows[0].id, firstAchievedAt: rows[0].completed_at };
    }

    if (
      candidate.conditionType === 'approved_mission_count' ||
      candidate.conditionType === 'category_approved_mission_count'
    ) {
      const { rows } = await db.query(
        `SELECT m.id, vr.decided_at FROM missions m
           JOIN mission_records mr ON mr.mission_id = m.id
           JOIN verification_results vr ON vr.record_id = mr.id
          WHERE m.user_id = $1 AND m.status = 'completed'
            AND m.source_type <> 'challenge'
            AND ($2::uuid IS NULL OR m.category_id = $2)
            AND vr.decision = 'approved' AND vr.is_current
          ORDER BY vr.decided_at ASC LIMIT $3`,
        [userId, candidate.categoryId, candidate.targetCount],
      );
      if (rows.length < candidate.targetCount) return null;
      const last = rows[rows.length - 1];
      return { sourceId: last.id, firstAchievedAt: last.decided_at };
    }

    if (candidate.conditionType === 'streak_milestone') {
      const { rows } = await db.query(
        `SELECT id, created_at FROM streak_milestone_awards
          WHERE user_id = $1 AND target_success_days = $2 AND status = 'active'`,
        [userId, candidate.targetCount],
      );
      if (!rows[0]) return null;
      return { sourceId: rows[0].id, firstAchievedAt: rows[0].created_at };
    }

    // challenge_completed: 이 업적 버전을 배지로 쓰는 챌린지의 활성 지급 행
    const { rows } = await db.query(
      `SELECT crg.id, crg.granted_at FROM challenge_reward_grants crg
         JOIN challenge_reward_packages crp ON crp.challenge_id = crg.challenge_id
        WHERE crg.user_id = $1 AND crg.status = 'active'
          AND crp.badge_achievement_version_id = $2`,
      [userId, candidate.versionId],
    );
    if (!rows[0]) return null;
    return { sourceId: rows[0].id, firstAchievedAt: rows[0].granted_at };
  }

  async qualifyingMissionCount(db, userId, categoryId) {
    const { rows } = await db.query(
      `SELECT count(DISTINCT m.id) AS n FROM missions m
        WHERE m.user_id = $1 AND m.status = 'completed'
          AND m.source_type <> 'challenge'
          AND ($2::uuid IS NULL OR m.category_id = $2)
          AND EXISTS (
              SELECT 1 FROM mission_records mr
              JOIN verification_results vr ON vr.record_id = mr.id
              WHERE mr.mission_id = m.id AND vr.decision = 'approved' AND vr.is_current)`,
      [userId, categoryId],
    );
    return num(rows[0].n);
  }

  /** 신규 획득: 지급 행 삽입 → 포인트·XP(해당하면) → 이벤트. userAchievementId 반환 */
  async grantOne(tx, userId, candidate, source) {
    const id = randomUUID();
    const sourceType = SOURCE_TYPE_BY_CONDITION[candidate.conditionType];
    const shared = SHARED_REWARD_CONDITIONS.has(candidate.conditionType);
    // paid_points는 월 한도로 줄어들 수 있어 낙관적으로 넣고 필요하면 보정(마이그레이션 018)
    await tx.query(
      `INSERT INTO user_achievements
              (id, user_id, achievement_id, achievement_version_id, badge_image_id,
               status, source_type, source_id, first_achieved_at, awarded_at,
               awarded_points, paid_points)
       VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$8, now(), $9, $9)`,
      [
        id,
        userId,
        candidate.achievementId,
        candidate.versionId,
        candidate.badgeImageId,
        sourceType,
        source.sourceId,
        source.firstAchievedAt,
        candidate.rewardPoints,
      ],
    );

    if (!shared && candidate.rewardPoints > 0) {
      const res = await this.points.awardAutoPoints(tx, {
        userId,
        sourceType: 'achievement',
        sourceId: id,
        originalPoints: candidate.rewardPoints,
        key: `achievement:award:${id}`,
      });
      if (res.paidPoints !== candidate.rewardPoints) {
        await tx.query(
          'UPDATE user_achievements SET paid_points = $2 WHERE id = $1',
          [id, res.paidPoints],
        );
      }
    }
    if (!shared && (candidate.rewardUserXp > 0 || candidate.rewardPetXp > 0)) {
      const recipient = await this.representativePet(tx, userId);
      await this.experience.awardExperience(tx, {
        userId,
        sourceType: 'achievement',
        sourceId: id,
        userXp: candidate.rewardUserXp,
        basePetXp: candidate.rewardPetXp,
        recipient,
      });
    }

    await this.insertEvent(tx, {
      userAchievementId: id,
      userId,
      eventType: 'earned',
      sourceType,
      sourceId: source.sourceId,
      key: `achievement:earned:${id}`,
    });
    return id;
  }

  /** 재충족: 같은 획득 행을 active로, 회수 때 되돌렸던 포인트·XP를 복구 */
  async reinstateOne(tx, userId, existing, candidate) {
    await tx.query(
      `UPDATE user_achievements SET status = 'active', updated_at = now() WHERE id = $1`,
      [existing.id],
    );

    const shared = SHARED_REWARD_CONDITIONS.has(candidate.conditionType);
    const resultId = randomUUID();
    if (!shared) {
      if (num(existing.awarded_points) > 0) {
        await this.points.reinstateAutoPoints(tx, {
          userId,
          sourceType: 'achievement',
          sourceId: existing.id,
          resultId,
        });
      }
      const awardId = await this.experience.findAwardId(
        tx,
        userId,
        'achievement',
        existing.id,
      );
      if (awardId) {
        await this.experience.reinstateExperience(tx, { awardId, resultId });
      }
    }

    await this.insertEvent(tx, {
      userAchievementId: existing.id,
      userId,
      eventType: 'reinstated',
      sourceType: SOURCE_TYPE_BY_CONDITION[candidate.conditionType],
      sourceId: existing.source_id,
      key: `achievement:reinstated:${existing.id}:${resultId}`,
    });
  }

  /** 조건이 무너진 활성 획득 회수: 상태 전환 → 포인트·XP 회수 → 대표 배지 해제(DB 트리거) */
  async revokeOne(tx, userId, row, reason = '조건 미충족') {
    await tx.query(
      `UPDATE user_achievements SET status = 'revoked', updated_at = now() WHERE id = $1`,
      [row.id],
    );

    const resultId = randomUUID();
    if (!SHARED_REWARD_CONDITIONS.has(row.condition_type)) {
      await this.points.revokeAutoPoints(tx, {
        userId,
        sourceType: 'achievement',
        sourceId: row.id,
        resultId,
      });
      const awardId = await this.experience.findAwardId(
        tx,
        userId,
        'achievement',
        row.id,
      );
      if (awardId) {
        await this.experience.revokeExperience(tx, { awardId, resultId });
      }
    }

    await this.insertEvent(tx, {
      userAchievementId: row.id,
      userId,
      eventType: 'revoked',
      sourceType: SOURCE_TYPE_BY_CONDITION[row.condition_type],
      sourceId: row.source_id,
      reason,
      key: `achievement:revoked:${row.id}:${resultId}`,
    });
  }

  async insertEvent(
    tx,
    {
      userAchievementId,
      userId,
      eventType,
      sourceType,
      sourceId,
      reason = null,
      key,
    },
  ) {
    await tx.query(
      `INSERT INTO user_achievement_events
              (id, user_achievement_id, user_id, event_type, source_type, source_id,
               reason, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        randomUUID(),
        userAchievementId,
        userId,
        eventType,
        sourceType,
        sourceId,
        reason,
        key,
      ],
    );
  }

  /** 업적 XP 수령 펫: 달성 처리 시점의 대표 펫(버프 없음), 없으면 null */
  async representativePet(db, userId) {
    const { rows } = await db.query(
      `SELECT up.id, up.stage_no FROM profiles pr
         JOIN user_pets up ON up.id = pr.representative_pet_id
        WHERE pr.user_id = $1`,
      [userId],
    );
    if (!rows[0]) return null;
    return {
      petId: rows[0].id,
      stageNo: rows[0].stage_no,
      bonusBasisPoints: 0,
    };
  }

  async findGrant(db, userId, achievementId, lock) {
    const { rows } = await db.query(
      `SELECT id, status, source_id, awarded_points, paid_points
         FROM user_achievements WHERE user_id = $1 AND achievement_id = $2
        ${lock ? 'FOR UPDATE' : ''}`,
      [userId, achievementId],
    );
    return rows[0] ?? null;
  }

  /**
   * 새 업적 공개 시 공개 이전 활동도 포함해 일괄 평가(신규 획득만, 회수된 건은 손대지 않음)
   * 사용자 id 순 배치, 고유 키(user_id, achievement_id)와 원장 멱등 키로 중복 실행에 안전
   */
  async backfill(tx, { achievementId, afterUserId = null, limit = 100 }) {
    const found = await this.oneCandidate(tx, achievementId);
    if (!found) return { processed: 0, earned: 0, lastUserId: afterUserId };

    const { rows: users } = await tx.query(
      `SELECT id FROM users WHERE ($1::uuid IS NULL OR id > $1) ORDER BY id LIMIT $2`,
      [afterUserId, limit],
    );

    let earned = 0;
    for (const u of users) {
      const existing = await this.findGrant(tx, u.id, achievementId, true);
      if (existing) continue;
      const source = await this.checkQualification(tx, u.id, found);
      if (source) {
        await this.grantOne(tx, u.id, found, source);
        earned += 1;
      }
    }
    return {
      processed: users.length,
      earned,
      lastUserId: users.at(-1)?.id ?? afterUserId,
    };
  }

  async oneCandidate(db, achievementId) {
    const { rows } = await db.query(
      `SELECT ad.id AS achievement_id, cur.id AS version_id, cur.condition_type,
              cur.target_count, cur.category_id, cur.reward_points,
              cur.reward_user_xp, cur.reward_pet_xp, cur.badge_image_id
         FROM achievement_definitions ad
         JOIN LATERAL (
           SELECT * FROM achievement_versions v
            WHERE v.achievement_id = ad.id AND v.effective_at <= now()
            ORDER BY v.effective_at DESC, v.version_no DESC LIMIT 1
         ) cur ON true
        WHERE ad.status = 'public' AND ad.id = $1`,
      [achievementId],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      achievementId: r.achievement_id,
      versionId: r.version_id,
      conditionType: r.condition_type,
      targetCount: r.target_count,
      categoryId: r.category_id,
      rewardPoints: num(r.reward_points),
      rewardUserXp: num(r.reward_user_xp),
      rewardPetXp: num(r.reward_pet_xp),
      badgeImageId: r.badge_image_id,
    };
  }

  /** 획득·진행도 목록 */
  async list(db, userId) {
    const { rows } = await db.query(
      `SELECT ua.id, ua.achievement_id, ad.code, av.title, av.description,
              av.rarity, ua.status, ua.awarded_at, ua.awarded_points, ua.paid_points
         FROM user_achievements ua
         JOIN achievement_definitions ad ON ad.id = ua.achievement_id
         JOIN achievement_versions av ON av.id = ua.achievement_version_id
        WHERE ua.user_id = $1
        ORDER BY ua.awarded_at DESC`,
      [userId],
    );
    return rows.map((r) => ({
      userAchievementId: r.id,
      achievementId: r.achievement_id,
      code: r.code,
      title: r.title,
      description: r.description,
      rarity: r.rarity,
      status: r.status,
      awardedAt: r.awarded_at,
      awardedPoints: num(r.awarded_points),
      paidPoints: num(r.paid_points),
    }));
  }

  /** 단일 업적 진행도(미달성이면 현재/목표, 조건 유형에 따라 의미가 다름) */
  async getProgress(db, userId, achievementId) {
    const existing = await this.findGrant(db, userId, achievementId, false);
    const candidate = await this.oneCandidate(db, achievementId);
    if (!candidate) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'achievement_not_found',
        '공개된 업적이 아님',
      );
    }
    if (existing) {
      return {
        achievementId,
        status: existing.status,
        current: candidate.targetCount,
        target: candidate.targetCount,
      };
    }
    let current = 0;
    if (
      candidate.conditionType === 'approved_mission_count' ||
      candidate.conditionType === 'category_approved_mission_count'
    ) {
      current = await this.qualifyingMissionCount(
        db,
        userId,
        candidate.categoryId,
      );
    } else {
      const source = await this.checkQualification(db, userId, candidate);
      current = source ? candidate.targetCount : 0;
    }
    return {
      achievementId,
      status: 'none',
      current: Math.min(current, candidate.targetCount),
      target: candidate.targetCount,
    };
  }

  /** 대표 배지 설정·해제. 소유·활성 검증은 DB 트리거(guard_representative_badge) */
  async setRepresentative(db, userId, userAchievementId) {
    await db.query(
      'UPDATE profiles SET representative_achievement_id = $2 WHERE user_id = $1',
      [userId, userAchievementId],
    );
    return { representativeAchievementId: userAchievementId };
  }
}
