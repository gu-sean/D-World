import { randomUUID } from 'node:crypto';
import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { AchievementsService } from '../achievements/achievements.service.js';
import { DatabaseService } from '../database/database.service.js';
import { ExperienceService } from '../experience-pets/experience.service.js';
import { PointsService } from '../points/points.service.js';
import { MILESTONES, UNRESOLVED_LOOKBACK_DAYS } from './streak.constants.js';
import { TODAY_SQL } from '../common/time/kst-sql.js';

/**
 * 스트릭 (정책 09, 스키마 005)
 * - 하루 성공: 그날 예정 미션 중 하나가 승인·완료이고 수행이 예정일(KST) 안에 제출됨
 * - 예정일이 끝난 뒤에는 판정 대기 제출이 있으면 pending, 없으면 failed. 예정 미션이 없는 날은 행이 없다(rest).
 * - 연속 일수·최장·마일스톤 자격은 streak_days 행에서 매번 다시 계산한다(원본은 행, states는 요약).
 * 판정 반영과 같은 트랜잭션에서 호출, 잠금 순서: 지갑 → 사용자별 스트릭 잠금 → 월간 사용량
 */
@Injectable()
@Dependencies(
  DatabaseService,
  PointsService,
  AchievementsService,
  ExperienceService,
)
export class StreakService {
  logger = new Logger(StreakService.name);

  constructor(database, points, achievements, experience) {
    this.experience = experience;
    this.database = database;
    this.points = points;
    this.achievements = achievements;
  }

  /** 판정이 반영될 때마다(승인 여부가 안 바뀌어도 pending·근거 판정이 달라질 수 있음) 그 예정일을 다시 평가 */
  async onDecisionApplied(tx, { userId, scheduledDate }) {
    await this.recalculate(tx, userId, { dates: [scheduledDate] });
  }

  /**
   * 한 날짜의 상태를 원본(미션·수행 회차·판정)에서 판단해 streak_days에 반영, 바뀌었으면 true
   */
  async evaluateDay(tx, userId, date, today) {
    const { rows: scheduled } = await tx.query(
      `SELECT 1 FROM missions
        WHERE user_id = $1 AND scheduled_date = $2 AND status <> 'cancelled'
          AND source_type <> 'challenge' LIMIT 1`,
      [userId, date],
    );
    const { rows: existingRows } = await tx.query(
      `SELECT status, qualifying_mission_id, qualifying_record_id, qualifying_result_id
         FROM streak_days WHERE user_id = $1 AND streak_date = $2`,
      [userId, date],
    );
    const existing = existingRows[0];

    let next = null; // { status, mission, record, result }
    if (scheduled.length > 0) {
      const { rows: winners } = await tx.query(
        `SELECT m.id AS mission_id, r.id AS record_id, v.id AS result_id
           FROM missions m
           JOIN mission_records r ON r.mission_id = m.id
           JOIN verification_results v ON v.record_id = r.id
          WHERE m.user_id = $1 AND m.scheduled_date = $2 AND m.status = 'completed'
            AND m.source_type <> 'challenge'
            AND (r.submitted_at AT TIME ZONE 'Asia/Seoul')::date = $2
            AND v.is_current AND v.decision = 'approved'
          ORDER BY r.submitted_at, r.id LIMIT 1`,
        [userId, date],
      );
      if (winners[0]) {
        next = {
          status: 'success',
          mission: winners[0].mission_id,
          record: winners[0].record_id,
          result: winners[0].result_id,
        };
      } else if (date < today) {
        const { rows: waiting } = await tx.query(
          `SELECT 1 FROM mission_records r
             JOIN missions m ON m.id = r.mission_id
            WHERE m.user_id = $1 AND m.scheduled_date = $2 AND m.status <> 'cancelled'
              AND m.source_type <> 'challenge' AND r.status IN ('submitted', 'review_required')
              AND (r.submitted_at AT TIME ZONE 'Asia/Seoul')::date = $2 LIMIT 1`,
          [userId, date],
        );
        next = { status: waiting[0] ? 'pending' : 'failed' };
      }
    }

    if (!next) {
      // 예정 미션이 없거나(rest) 아직 끝나지 않은 날 → 행 없음. 마일스톤이 가리키는 날은 지울 수 없어 pending으로 둠
      if (!existing) return false;
      const { rows: referenced } = await tx.query(
        `SELECT 1 FROM streak_milestone_awards
          WHERE user_id = $1 AND first_achieved_date = $2 LIMIT 1`,
        [userId, date],
      );
      if (referenced[0]) {
        if (existing.status === 'pending') return false;
        next = { status: 'pending' };
      } else {
        await tx.query(
          'DELETE FROM streak_days WHERE user_id = $1 AND streak_date = $2',
          [userId, date],
        );
        return true;
      }
    }

    const same =
      existing &&
      existing.status === next.status &&
      (existing.qualifying_mission_id ?? null) === (next.mission ?? null) &&
      (existing.qualifying_record_id ?? null) === (next.record ?? null) &&
      (existing.qualifying_result_id ?? null) === (next.result ?? null);
    if (same) return false;

    await tx.query(
      `INSERT INTO streak_days
              (user_id, streak_date, status, qualifying_mission_id,
               qualifying_record_id, qualifying_result_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, streak_date) DO UPDATE
          SET status = EXCLUDED.status,
              qualifying_mission_id = EXCLUDED.qualifying_mission_id,
              qualifying_record_id = EXCLUDED.qualifying_record_id,
              qualifying_result_id = EXCLUDED.qualifying_result_id,
              updated_at = now()`,
      [
        userId,
        date,
        next.status,
        next.mission ?? null,
        next.record ?? null,
        next.result ?? null,
      ],
    );
    return true;
  }

  /** 날짜 순 행에서 현재·최장 연속 일수와 마일스톤 최초 달성일을 계산 */
  summarize(rows) {
    let runSuccess = 0;
    let runPending = 0;
    let longest = 0;
    let lastSuccess = null;
    const achieved = {};
    for (const row of rows) {
      if (row.status === 'failed') {
        runSuccess = 0;
        runPending = 0;
      } else if (row.status === 'pending') {
        runPending += 1;
      } else {
        runSuccess += 1;
        lastSuccess = row.streak_date;
        longest = Math.max(longest, runSuccess);
        if (
          runPending === 0 &&
          MILESTONES.includes(runSuccess) &&
          achieved[runSuccess] === undefined
        ) {
          achieved[runSuccess] = row.streak_date;
        }
      }
    }
    return {
      current: runSuccess,
      longest,
      lastSuccess,
      hasPending: runPending > 0,
      achieved,
    };
  }

  /**
   * 사용자의 스트릭을 다시 계산: 끝났는데 행이 없는 지난 날 확정 → 요약 갱신 → 마일스톤 지급·회수·복구
   * dates: 반드시 다시 평가할 예정일(판정이 반영된 날)
   */
  async recalculate(tx, userId, { dates = [] } = {}) {
    await this.points.lockUserWallet(tx, userId);
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `streak:${userId}`,
    ]);
    const {
      rows: [{ today }],
    } = await tx.query(`SELECT ${TODAY_SQL}::text AS today`);

    const { rows: unresolved } = await tx.query(
      `SELECT DISTINCT m.scheduled_date::text AS d
         FROM missions m
         LEFT JOIN streak_days s
           ON s.user_id = m.user_id AND s.streak_date = m.scheduled_date
        WHERE m.user_id = $1 AND m.status <> 'cancelled' AND m.source_type <> 'challenge'
          AND m.scheduled_date < $2
          AND (s.user_id IS NULL OR s.status = 'pending')`,
      [userId, today],
    );
    const toEvaluate = new Set([...unresolved.map((r) => r.d), ...dates]);
    for (const date of [...toEvaluate].sort()) {
      if (date > today) continue;
      await this.evaluateDay(tx, userId, date, today);
    }

    const { rows } = await tx.query(
      `SELECT streak_date::text AS streak_date, status
         FROM streak_days WHERE user_id = $1 ORDER BY streak_date`,
      [userId],
    );
    const summary = this.summarize(rows);
    await tx.query(
      `INSERT INTO streak_states
              (user_id, current_success_days, longest_success_days, last_success_date,
               has_pending_days, last_recalculated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (user_id) DO UPDATE
          SET current_success_days = EXCLUDED.current_success_days,
              longest_success_days = EXCLUDED.longest_success_days,
              last_success_date = EXCLUDED.last_success_date,
              has_pending_days = EXCLUDED.has_pending_days,
              last_recalculated_at = now()`,
      [
        userId,
        summary.current,
        summary.longest,
        summary.lastSuccess,
        summary.hasPending,
      ],
    );
    await this.reconcileMilestones(tx, userId, summary.achieved);
    return summary;
  }

  /** 달성한 마일스톤은 지급(처음)·복구(회수됐던 것), 조건이 사라진 지급은 회수 */
  async reconcileMilestones(tx, userId, achieved) {
    let revoked = false;
    let granted = false;
    const { rows: awards } = await tx.query(
      `SELECT id, status, target_success_days FROM streak_milestone_awards
        WHERE user_id = $1 AND target_success_days = ANY($2::int[])`,
      [userId, MILESTONES],
    );
    const awardOf = new Map(awards.map((a) => [a.target_success_days, a]));
    for (const target of MILESTONES) {
      const award = awardOf.get(target);
      const date = achieved[target];

      if (date !== undefined) {
        if (!award) {
          granted = (await this.grant(tx, userId, target, date)) || granted;
        } else if (award.status === 'revoked') {
          await tx.query(
            `UPDATE streak_milestone_awards SET status = 'active', updated_at = now() WHERE id = $1`,
            [award.id],
          );
          await this.points.reinstateAutoPoints(tx, {
            userId,
            sourceType: 'streak',
            sourceId: award.id,
            resultId: randomUUID(),
          });
          await this.reinstateExperience(tx, userId, award.id);
          granted = true;
        }
      } else if (award?.status === 'active') {
        await tx.query(
          `UPDATE streak_milestone_awards SET status = 'revoked', updated_at = now() WHERE id = $1`,
          [award.id],
        );
        await this.points.revokeAutoPoints(tx, {
          userId,
          sourceType: 'streak',
          sourceId: award.id,
          resultId: randomUUID(),
        });
        await this.revokeExperience(tx, userId, award.id);
        revoked = true;
      }
    }
    // 같은 조건의 업적은 스트릭 마일스톤과 보상을 공유(포인트는 업적 쪽에서 지급하지 않음)
    if (revoked) {
      await this.achievements.evaluate(tx, { userId, trigger: 'revoked' });
    }
    if (granted) {
      await this.achievements.evaluate(tx, {
        userId,
        trigger: 'streak_milestone',
      });
    }
  }

  /** 달성일 기준으로 시행 중이던 금액 버전을 고정해 지급, 설정된 버전이 없으면 지급하지 않음(소급 안 함) */
  async grant(tx, userId, target, date) {
    const { rows } = await tx.query(
      `SELECT id, points, user_xp, pet_xp FROM streak_milestone_policy_versions
        WHERE target_success_days = $1
          AND effective_at <= now()
          AND (effective_at AT TIME ZONE 'Asia/Seoul')::date <= $2
        ORDER BY effective_at DESC, version_no DESC LIMIT 1`,
      [target, date],
    );
    const policy = rows[0];
    if (!policy) return false;

    const original = Number(policy.points);
    const paid = await this.points.previewAutoPaid(tx, {
      userId,
      originalPoints: original,
    });
    const id = randomUUID();
    await tx.query(
      `INSERT INTO streak_milestone_awards
              (id, user_id, target_success_days, policy_version_id,
               awarded_points, paid_points, first_achieved_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
      [id, userId, target, policy.id, original, paid, date],
    );
    if (original > 0) {
      await this.points.awardAutoPoints(tx, {
        userId,
        sourceType: 'streak',
        sourceId: id,
        originalPoints: original,
        key: `streak:award:${userId}:${target}`,
      });
    }
    const userXp = Number(policy.user_xp);
    const petXp = Number(policy.pet_xp);
    if (userXp > 0 || petXp > 0) {
      // 펫 보너스는 미션 지급에만 적용, 대표 펫이 없으면 펫 XP는 보류
      await this.experience.awardExperience(tx, {
        userId,
        sourceType: 'streak',
        sourceId: id,
        userXp,
        basePetXp: petXp,
        recipient: await this.achievements.representativePet(tx, userId),
      });
    }
    return true;
  }

  async revokeExperience(tx, userId, awardRowId) {
    const awardId = await this.experience.findAwardId(
      tx,
      userId,
      'streak',
      awardRowId,
    );
    if (awardId) {
      await this.experience.revokeExperience(tx, {
        awardId,
        resultId: randomUUID(),
      });
    }
  }

  async reinstateExperience(tx, userId, awardRowId) {
    const awardId = await this.experience.findAwardId(
      tx,
      userId,
      'streak',
      awardRowId,
    );
    if (awardId) {
      await this.experience.reinstateExperience(tx, {
        awardId,
        resultId: randomUUID(),
      });
    }
  }

  /** 끝난 날짜가 아직 확정되지 않은 사용자(자정 이후 작업 대상), 오래된 이력 전체 스캔을 피하려 최근 일수만 봄 */
  async usersWithUnresolvedDays(limit = 100) {
    const { rows } = await this.database.query(
      `SELECT DISTINCT m.user_id
         FROM missions m
         LEFT JOIN streak_days s
           ON s.user_id = m.user_id AND s.streak_date = m.scheduled_date
        WHERE m.status <> 'cancelled' AND m.source_type <> 'challenge'
          AND m.scheduled_date < ${TODAY_SQL}
          AND m.scheduled_date >= ${TODAY_SQL} - $2::int
          AND s.user_id IS NULL
        LIMIT $1`,
      [limit, UNRESOLVED_LOOKBACK_DAYS],
    );
    return rows.map((row) => row.user_id);
  }

  /** 작업: 지난 날 확정(failed·pending·success)과 그에 따른 마일스톤 처리 */
  async settleDays({ limit = 100 } = {}) {
    const users = await this.usersWithUnresolvedDays(limit);
    let settled = 0;
    let failed = 0;
    for (const userId of users) {
      // 한 사용자의 실패가 나머지 사용자 확정을 막지 않도록 건별로 격리
      try {
        await this.database.withTransaction((tx) =>
          this.recalculate(tx, userId),
        );
        settled += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(`스트릭 확정 실패 user=${userId}: ${error.message}`);
      }
    }
    return { settled, failed };
  }

  // ───────── 조회 ─────────

  async getSummary(userId) {
    const [state, awards, policies] = await Promise.all([
      this.database.query(
        `SELECT current_success_days, longest_success_days, last_success_date::text AS last_success_date,
                has_pending_days
           FROM streak_states WHERE user_id = $1`,
        [userId],
      ),
      this.database.query(
        `SELECT target_success_days, status, awarded_points, paid_points,
                first_achieved_date::text AS first_achieved_date
           FROM streak_milestone_awards WHERE user_id = $1`,
        [userId],
      ),
      this.database.query(
        `SELECT DISTINCT ON (target_success_days) target_success_days, points
           FROM streak_milestone_policy_versions
          WHERE effective_at <= now()
          ORDER BY target_success_days, effective_at DESC, version_no DESC`,
      ),
    ]);
    const row = state.rows[0];
    const recent = await this.recentStatuses(userId);
    const byTarget = new Map(
      awards.rows.map((a) => [a.target_success_days, a]),
    );
    const pointsByTarget = new Map(
      policies.rows.map((p) => [p.target_success_days, Number(p.points)]),
    );
    return {
      currentSuccessDays: row?.current_success_days ?? 0,
      longestSuccessDays: row?.longest_success_days ?? 0,
      lastSuccessDate: row?.last_success_date ?? null,
      hasPendingDays: row?.has_pending_days ?? false,
      // 모바일 클라이언트(08 StreakStatus) 키
      bestSuccessDays: row?.longest_success_days ?? 0,
      todayStatus: recent.todayStatus,
      recentDays: recent.days,
      nextMilestone:
        MILESTONES.filter((target) => target > (row?.current_success_days ?? 0))
          .map((target) => ({
            targetSuccessDays: target,
            points: pointsByTarget.get(target) ?? 0,
            userXp: null,
            petXp: null,
          }))
          .at(0) ?? null,
      milestones: MILESTONES.map((target) => {
        const award = byTarget.get(target);
        return {
          targetDays: target,
          status: award ? award.status : 'locked',
          rewardPoints: award
            ? Number(award.awarded_points)
            : (pointsByTarget.get(target) ?? null),
          paidPoints: award ? Number(award.paid_points) : null,
          firstAchievedDate: award?.first_achieved_date ?? null,
        };
      }),
    };
  }

  /**
   * 최근 7일(오늘 포함)의 날짜별 상태.
   * 기록이 없는 날은 가입일(KST) 이전이면 none(가입 전이라 판정 대상이 아님), 오늘이면 pending, 그 밖은 failed
   */
  async recentStatuses(userId) {
    const { rows } = await this.database.query(
      `SELECT d::date::text AS date,
              coalesce(s.status, CASE
                WHEN d::date < (u.created_at AT TIME ZONE 'Asia/Seoul')::date THEN 'none'
                WHEN d::date = ${TODAY_SQL} THEN 'pending'
                ELSE 'failed' END) AS status
         FROM generate_series(${TODAY_SQL} - 6, ${TODAY_SQL}, interval '1 day') d
         CROSS JOIN users u
         LEFT JOIN streak_days s ON s.user_id = $1 AND s.streak_date = d::date
        WHERE u.id = $1
        ORDER BY d`,
      [userId],
    );
    return {
      days: rows.map((r) => ({ date: r.date, status: r.status })),
      todayStatus: rows.at(-1)?.status ?? 'pending',
    };
  }

  async listDays(userId, { from, to }) {
    const { rows } = await this.database.query(
      `SELECT streak_date::text AS date, status, qualifying_mission_id
         FROM streak_days
        WHERE user_id = $1 AND streak_date BETWEEN $2 AND $3
        ORDER BY streak_date`,
      [userId, from, to],
    );
    return {
      items: rows.map((row) => ({
        date: row.date,
        status: row.status,
        missionId: row.qualifying_mission_id,
      })),
    };
  }
}
