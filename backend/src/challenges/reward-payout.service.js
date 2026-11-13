import { newId } from '../common/ids.js';
import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { AchievementsService } from '../achievements/achievements.service.js';
import { AdminMutationService } from '../admin-auth/admin-mutation.service.js';
import { conflict, notFound } from '../common/errors/http-errors.js';
import { DatabaseService } from '../database/database.service.js';
import { ExperienceService } from '../experience-pets/experience.service.js';
import { PointsService } from '../points/points.service.js';

const RETRY_BASE_MS = 60_000;
const RETRY_MAX_MS = 6 * 60 * 60_000;

/**
 * 챌린지 보상 지급·회수·복구
 * - 확정된 정산의 완주자별 별도 트랜잭션, 실패는 기록 후 지수 백오프 재시도
 * - 정정 정산 확정 시 자격 상실자 회수(reconcileGrants), 재충족자는 지급 시 복구
 * 잠금 순서: 지갑 → 월간 사용량 → XP/펫 → 업적
 */
@Injectable()
@Dependencies(
  DatabaseService,
  AdminMutationService,
  PointsService,
  ExperienceService,
  AchievementsService,
)
export class RewardPayoutService {
  logger = new Logger(RewardPayoutService.name);

  constructor(database, mutation, points, experience, achievements) {
    this.database = database;
    this.mutation = mutation;
    this.points = points;
    this.experience = experience;
    this.achievements = achievements;
  }

  /** 정정 정산: 자격을 잃은 완주자의 활성 지급을 회수(포인트·XP·배지) */
  async reconcileGrants(tx, entries) {
    let revoked = 0;
    for (const entry of entries) {
      if (entry.outcome === 'completed' || entry.grantStatus !== 'active')
        continue;
      const { rows } = await tx.query(
        `SELECT id, user_id FROM challenge_reward_grants WHERE participation_id = $1`,
        [entry.participationId],
      );
      const grant = rows[0];
      await tx.query(
        `UPDATE challenge_reward_grants SET status = 'revoked', updated_at = now() WHERE id = $1`,
        [grant.id],
      );
      await this.points.revokeAutoPoints(tx, {
        userId: grant.user_id,
        sourceType: 'challenge',
        sourceId: grant.id,
        resultId: newId(),
      });
      const awardId = await this.experience.findAwardId(
        tx,
        grant.user_id,
        'challenge',
        grant.id,
      );
      if (awardId) {
        await this.experience.revokeExperience(tx, {
          awardId,
          resultId: newId(),
        });
      }
      await this.achievements.evaluate(tx, {
        userId: grant.user_id,
        trigger: 'revoked',
      });
      revoked += 1;
    }
    return { revoked };
  }

  // ───────── 지급 ─────────

  /** 확정된 정산의 미지급 완주자 지급(재시도 시각이 된 실패 건 포함). 항상 오류를 삼키고 건수를 반환 */
  async payRun(runId, { force = false } = {}) {
    const { rows } = await this.database.query(
      `SELECT e.participation_id
         FROM challenge_settlement_entries e
         JOIN challenge_settlement_runs r ON r.id = e.run_id
         LEFT JOIN challenge_reward_payment_attempts a
           ON a.run_id = e.run_id AND a.participation_id = e.participation_id
        WHERE e.run_id = $1 AND r.status = 'confirmed' AND e.outcome = 'completed'
          AND (e.payment_status = 'pending'
               OR (e.payment_status = 'failed'
                   AND ($2::boolean OR a.next_retry_at IS NULL OR a.next_retry_at <= now())))
        ORDER BY e.participation_id`,
      [runId, force],
    );
    const summary = { paid: 0, failed: 0, skipped: 0 };
    for (const { participation_id: participationId } of rows) {
      const outcome = await this.payOne(runId, participationId);
      summary[outcome] += 1;
    }
    return summary;
  }

  /**
   * 지금 지급할 건이 있는 확정 정산(미지급, 또는 재시도 시각이 된 실패), 오래 확정된 것부터
   * 재시도 대기 중인 실패만 남은 정산은 고르지 않아, 그런 정산이 쌓여도 새 정산이 밀리지 않음
   */
  async dueRunIds(limit) {
    const { rows } = await this.database.query(
      `SELECT e.run_id
         FROM challenge_settlement_entries e
         JOIN challenge_settlement_runs r ON r.id = e.run_id
         LEFT JOIN challenge_reward_payment_attempts a
           ON a.run_id = e.run_id AND a.participation_id = e.participation_id
        WHERE r.status = 'confirmed' AND e.outcome = 'completed'
          AND (e.payment_status = 'pending'
               OR (e.payment_status = 'failed'
                   AND (a.next_retry_at IS NULL OR a.next_retry_at <= now())))
        GROUP BY e.run_id, r.confirmed_at
        ORDER BY r.confirmed_at, e.run_id
        LIMIT $1`,
      [limit],
    );
    return rows.map((row) => row.run_id);
  }

  /** 작업: 확정된 정산의 지급 대상 건 */
  async payDue({ limit = 20 } = {}) {
    const total = { paid: 0, failed: 0, skipped: 0 };
    for (const runId of await this.dueRunIds(limit)) {
      const result = await this.payRun(runId);
      for (const key of Object.keys(total)) total[key] += result[key];
    }
    return total;
  }

  /** 한 참가자 지급: 자기 트랜잭션, 실패하면 롤백하고 별도 트랜잭션에서 실패·재시도 상태를 기록 */
  async payOne(runId, participationId) {
    try {
      const outcome = await this.database.withTransaction((tx) =>
        this.payEntry(tx, runId, participationId),
      );
      return outcome;
    } catch (error) {
      this.logger.error(
        `챌린지 보상 지급 실패 run=${runId} participation=${participationId}: ${error.message}`,
      );
      // 실패 기록마저 실패해도 다른 참가자 지급은 이어가야 함
      try {
        await this.recordFailure(runId, participationId, error);
      } catch (recordError) {
        this.logger.error(
          `챌린지 보상 실패 기록 실패 run=${runId} participation=${participationId}: ${recordError.message}`,
        );
      }
      return 'failed';
    }
  }

  async recordFailure(runId, participationId, error) {
    await this.database.withTransaction(async (tx) => {
      await tx.query(
        `UPDATE challenge_settlement_entries SET payment_status = 'failed'
          WHERE run_id = $1 AND participation_id = $2 AND payment_status <> 'paid'`,
        [runId, participationId],
      );
      await tx.query(
        `INSERT INTO challenge_reward_payment_attempts
                (run_id, participation_id, attempt_count, last_error, last_attempt_at, next_retry_at)
         VALUES ($1,$2,1,$3,now(), now() + make_interval(secs => $4::float8))
         ON CONFLICT (run_id, participation_id) DO UPDATE
            SET attempt_count = challenge_reward_payment_attempts.attempt_count + 1,
                last_error = EXCLUDED.last_error, last_attempt_at = now(),
                -- 실수형으로 계산 후 상한 적용: 정수로 2^n을 먼저 만들면 26회째부터 integer out of range
                next_retry_at = now() + make_interval(secs => LEAST(
                    $5::float8,
                    $4::float8 * power(2::float8, LEAST(challenge_reward_payment_attempts.attempt_count, 30)))),
                updated_at = now()`,
        [
          runId,
          participationId,
          String(error.message).slice(0, 500),
          RETRY_BASE_MS / 1000,
          RETRY_MAX_MS / 1000,
        ],
      );
    });
  }

  async payEntry(tx, runId, participationId) {
    const { rows: entries } = await tx.query(
      `SELECT e.*, r.status AS run_status, p.user_id
         FROM challenge_settlement_entries e
         JOIN challenge_settlement_runs r ON r.id = e.run_id
         JOIN challenge_participations p ON p.id = e.participation_id
        WHERE e.run_id = $1 AND e.participation_id = $2
        FOR UPDATE OF e SKIP LOCKED`,
      [runId, participationId],
    );
    const entry = entries[0];
    if (
      !entry ||
      entry.run_status !== 'confirmed' ||
      entry.outcome !== 'completed' ||
      entry.payment_status === 'paid'
    ) {
      return 'skipped';
    }
    const userId = entry.user_id;
    // 잠금 순서: 지갑이 먼저(포인트·스트릭과 같은 순서)
    await this.points.lockUserWallet(tx, userId);

    const { rows: grants } = await tx.query(
      `SELECT id, status, paid_points FROM challenge_reward_grants
        WHERE participation_id = $1 FOR UPDATE`,
      [participationId],
    );
    let grant = grants[0];
    if (!grant) {
      grant = await this.createGrant(tx, entry, userId);
    } else if (grant.status === 'revoked') {
      await this.reinstateGrant(tx, grant, userId);
    }

    await tx.query(
      `UPDATE challenge_settlement_entries
          SET paid_points = $3, payment_status = 'paid'
        WHERE run_id = $1 AND participation_id = $2`,
      [runId, participationId, grant.paid_points],
    );
    await tx.query(
      `DELETE FROM challenge_reward_payment_attempts WHERE run_id = $1 AND participation_id = $2`,
      [runId, participationId],
    );
    return 'paid';
  }

  async createGrant(tx, entry, userId) {
    const paid = await this.points.previewAutoPaid(tx, {
      userId,
      originalPoints: entry.promised_points,
    });
    const { rows: pets } = await tx.query(
      `SELECT up.id, up.stage_no FROM profiles pr
         JOIN user_pets up ON up.id = pr.representative_pet_id
        WHERE pr.user_id = $1`,
      [userId],
    );
    const pet = pets[0] ?? null;
    // 지급 행의 실제 지급액이 정산 항목과 같아야 하므로 먼저 반영
    await tx.query(
      `UPDATE challenge_settlement_entries SET paid_points = $3
        WHERE run_id = $1 AND participation_id = $2`,
      [entry.run_id, entry.participation_id, paid],
    );
    const grantId = newId();
    await tx.query(
      `INSERT INTO challenge_reward_grants
              (id, participation_id, challenge_id, user_id, first_settlement_run_id,
               promised_points, paid_points, user_xp, pet_xp, recipient_pet_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')`,
      [
        grantId,
        entry.participation_id,
        entry.challenge_id,
        userId,
        entry.run_id,
        entry.promised_points,
        paid,
        entry.user_xp,
        entry.pet_xp,
        pet?.id ?? null,
      ],
    );
    if (entry.promised_points > 0) {
      await this.points.awardAutoPoints(tx, {
        userId,
        sourceType: 'challenge',
        sourceId: grantId,
        originalPoints: entry.promised_points,
        key: `challenge:award:${grantId}`,
      });
    }
    if (entry.user_xp > 0 || entry.pet_xp > 0) {
      await this.experience.awardExperience(tx, {
        userId,
        sourceType: 'challenge',
        sourceId: grantId,
        userXp: entry.user_xp,
        basePetXp: entry.pet_xp,
        recipient: pet
          ? { petId: pet.id, stageNo: pet.stage_no, bonusBasisPoints: 0 }
          : null,
      });
    }
    await this.grantBadge(tx, entry.challenge_id, userId, grantId);
    return { id: grantId, status: 'active', paid_points: paid };
  }

  /** 한정 배지: 이 챌린지의 배지 업적 버전이 공개 업적의 현재 버전이면 획득 기록과 지급 행을 연결 */
  async grantBadge(tx, challengeId, userId, grantId) {
    const { rows: pkg } = await tx.query(
      'SELECT badge_achievement_version_id FROM challenge_reward_packages WHERE challenge_id = $1',
      [challengeId],
    );
    if (!pkg[0]?.badge_achievement_version_id) return;
    await this.achievements.evaluate(tx, {
      userId,
      trigger: 'challenge_completed',
    });
    const { rows } = await tx.query(
      `SELECT id FROM user_achievements
        WHERE user_id = $1 AND source_type = 'challenge' AND source_id = $2`,
      [userId, grantId],
    );
    if (rows[0]) {
      await tx.query(
        `UPDATE challenge_reward_grants SET badge_grant_id = $2, updated_at = now() WHERE id = $1`,
        [grantId, rows[0].id],
      );
    }
  }

  async reinstateGrant(tx, grant, userId) {
    await tx.query(
      `UPDATE challenge_reward_grants SET status = 'active', updated_at = now() WHERE id = $1`,
      [grant.id],
    );
    await this.points.reinstateAutoPoints(tx, {
      userId,
      sourceType: 'challenge',
      sourceId: grant.id,
      resultId: newId(),
    });
    const awardId = await this.experience.findAwardId(
      tx,
      userId,
      'challenge',
      grant.id,
    );
    if (awardId) {
      await this.experience.reinstateExperience(tx, {
        awardId,
        resultId: newId(),
      });
    }
    await this.achievements.evaluate(tx, {
      userId,
      trigger: 'challenge_completed',
    });
  }

  /** 관리자 재시도: 실패한 건을 재시도 시각과 상관없이 바로 지급 */
  retryPayments(adminId, challengeId, runId, key, reason) {
    return this.mutation
      .run(adminId, {
        key,
        reason,
        operation: 'settlement.retry',
        payload: { challengeId, runId },
        run: async (tx) => {
          const { rows } = await tx.query(
            `SELECT status FROM challenge_settlement_runs WHERE id = $1 AND challenge_id = $2`,
            [runId, challengeId],
          );
          if (!rows[0])
            throw notFound('settlement_not_found', '정산을 찾을 수 없음');
          if (rows[0].status !== 'confirmed') {
            throw conflict(
              'settlement_not_confirmed',
              '확정된 정산만 지급할 수 있음',
              {
                status: rows[0].status,
              },
            );
          }
          return { result: { runId } };
        },
      })
      .then(async (result) => ({
        ...result,
        payments: await this.payRun(runId, { force: true }),
      }));
  }
}
