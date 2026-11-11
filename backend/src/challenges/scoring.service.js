import { randomUUID } from 'node:crypto';
import { Dependencies, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AdminMutationService } from '../admin-auth/admin-mutation.service.js';
import { DatabaseService } from '../database/database.service.js';
import { POINTS_PER_SUCCESS_DAY } from './challenges.constants.js';
import { ParticipationService } from './participation.service.js';
import { conflict, httpError } from '../common/errors/http-errors.js';
import { TODAY_SQL } from '../common/time/kst-sql.js';

const notFound = (
  code = 'challenge_not_found',
  message = '챌린지를 찾을 수 없음',
) => httpError(HttpStatus.NOT_FOUND, code, message);

/**
 * 일별 결과·순위·운영 조치
 * - 하루 성공 = 그 날짜(KST) 안에 제출된 수행의 현재 판정이 승인. 날이 끝났는데 성공이 없으면 판정 대기 제출이
 *   있을 때 pending, 없으면 failed. 판정 반영마다(승인 여부 무관) 그 참가의 모든 날 재평가
 * - 관리자가 제외한 날(excluded)은 재계산 대상 아님, 복구하면 다시 평가
 * - 점수 = 성공 일수 × 100, 순위는 DB 뷰(challenge_live_rankings)가 계산한다(진행 중에는 잠정값).
 */
@Injectable()
@Dependencies(DatabaseService, AdminMutationService, ParticipationService)
export class ScoringService {
  logger = new Logger(ScoringService.name);

  constructor(database, mutation, participation) {
    this.database = database;
    this.mutation = mutation;
    this.participation = participation;
  }

  /** 판정 반영 트랜잭션에서 호출, 챌린지 미션이 아니면 아무것도 하지 않음 */
  async onDecisionApplied(tx, { missionId }) {
    const { rows } = await tx.query(
      'SELECT participation_id FROM challenge_daily_missions WHERE mission_id = $1',
      [missionId],
    );
    if (rows[0])
      await this.recalculateParticipation(tx, rows[0].participation_id);
  }

  /** 한 참가의 취소·제외되지 않은 모든 날을 원본(수행 회차·판정)에서 다시 평가, 바뀐 날 수 반환 */
  async recalculateParticipation(tx, participationId) {
    const { rows: days } = await tx.query(
      `SELECT id, mission_id, challenge_date::text AS date, status,
              qualifying_record_id, qualifying_result_id,
              challenge_date < ${TODAY_SQL} AS day_over
         FROM challenge_daily_missions
        WHERE participation_id = $1 AND status NOT IN ('cancelled', 'excluded')
        ORDER BY challenge_date`,
      [participationId],
    );
    const verdicts = await this.evaluateDays(tx, days);
    let changed = 0;
    for (const day of days) {
      const next = verdicts.get(day.id);
      const same =
        next.status === day.status &&
        (next.record ?? null) === (day.qualifying_record_id ?? null) &&
        (next.result ?? null) === (day.qualifying_result_id ?? null);
      if (same) continue;
      await tx.query(
        `UPDATE challenge_daily_missions
            SET status = $2, qualifying_record_id = $3, qualifying_result_id = $4,
                judged_at = now(), updated_at = now()
          WHERE id = $1`,
        [day.id, next.status, next.record ?? null, next.result ?? null],
      );
      changed += 1;
    }
    return changed;
  }

  /**
   * 여러 날을 쿼리 2번으로 평가 (일별 행 id → 결과)
   * 성공: 그날(KST) 제출 중 현재 판정이 승인인 가장 이른 회차 / 대기: 날이 끝났고 판정 대기 제출 존재
   */
  async evaluateDays(tx, days) {
    const ids = days.map((day) => day.id);
    const { rows: winners } = await tx.query(
      `SELECT DISTINCT ON (d.id) d.id AS day_id, r.id AS record_id, v.id AS result_id
         FROM challenge_daily_missions d
         JOIN mission_records r ON r.mission_id = d.mission_id
          AND (r.submitted_at AT TIME ZONE 'Asia/Seoul')::date = d.challenge_date
         JOIN verification_results v ON v.record_id = r.id
          AND v.is_current AND v.decision = 'approved'
        WHERE d.id = ANY($1::uuid[])
        ORDER BY d.id, r.submitted_at, r.id`,
      [ids],
    );
    const { rows: waiting } = await tx.query(
      `SELECT DISTINCT d.id AS day_id
         FROM challenge_daily_missions d
         JOIN mission_records r ON r.mission_id = d.mission_id
          AND (r.submitted_at AT TIME ZONE 'Asia/Seoul')::date = d.challenge_date
          AND r.status IN ('submitted', 'review_required')
        WHERE d.id = ANY($1::uuid[])`,
      [ids],
    );
    const won = new Map(winners.map((row) => [row.day_id, row]));
    const pending = new Set(waiting.map((row) => row.day_id));
    return new Map(
      days.map((day) => {
        const winner = won.get(day.id);
        if (winner) {
          return [
            day.id,
            {
              status: 'success',
              record: winner.record_id,
              result: winner.result_id,
            },
          ];
        }
        if (!day.day_over || pending.has(day.id)) {
          return [day.id, { status: 'pending' }];
        }
        return [day.id, { status: 'failed' }];
      }),
    );
  }

  /** 확정할 날이 있는 참가 id (settleDays 설명 참고) */
  async dueParticipationIds(limit) {
    const { rows } = await this.database.query(
      `SELECT d.participation_id
         FROM challenge_daily_missions d
        WHERE d.status = 'pending' AND d.challenge_date < ${TODAY_SQL}
          AND NOT EXISTS (
                SELECT 1 FROM mission_records r
                 WHERE r.mission_id = d.mission_id
                   AND (r.submitted_at AT TIME ZONE 'Asia/Seoul')::date = d.challenge_date
                   AND r.status IN ('submitted', 'review_required'))
        GROUP BY d.participation_id
        ORDER BY min(d.challenge_date), d.participation_id
        LIMIT $1`,
      [limit],
    );
    return rows.map((row) => row.participation_id);
  }

  /**
   * 작업: 날이 끝났는데 아직 pending인 일별 결과를 확정(자정 이후 failed·pending)
   * 그날 판정 대기 중인 제출이 있는 날은 고르지 않음: 작업이 다시 봐도 pending으로 남고,
   * 판정이 나면 onDecisionApplied가 다시 계산한다. 이런 날이 쌓여도 다른 참가가 밀리지 않도록
   * 오래된 날부터 고름
   */
  async settleDays({ limit = 200 } = {}) {
    const ids = await this.dueParticipationIds(limit);
    let participations = 0;
    let failed = 0;
    for (const id of ids) {
      // 한 참가의 실패가 나머지 참가 확정을 막지 않도록 건별로 격리
      try {
        await this.database.withTransaction((tx) =>
          this.recalculateParticipation(tx, id),
        );
        participations += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `챌린지 일별 확정 실패 participation=${id}: ${error.message}`,
        );
      }
    }
    return { participations, failed };
  }

  // ───────── 순위 ─────────

  /** 전체 순위(잠정). 상위 limit명과 내 순위, 포기·실격은 제외 */
  async ranking(userId, challengeId, { limit }) {
    const { rows: challenge } = await this.database.query(
      `SELECT settlement_status, publication_status FROM challenges WHERE id = $1`,
      [challengeId],
    );
    if (!challenge[0] || challenge[0].publication_status === 'draft')
      throw notFound();
    if (challenge[0].settlement_status === 'confirmed') {
      return this.finalRanking(userId, challengeId, limit);
    }
    const { rows } = await this.database.query(
      `SELECT user_id, display_name, successful_days, score, rank_no
         FROM challenge_live_rankings WHERE challenge_id = $1 ORDER BY rank_no`,
      [challengeId],
    );
    const view = (row) => ({
      rank: Number(row.rank_no),
      displayName: row.display_name,
      successfulDays: row.successful_days,
      score: row.score,
      isMe: row.user_id === userId,
    });
    const mine = rows.find((row) => row.user_id === userId);
    return {
      provisional: challenge[0].settlement_status !== 'confirmed',
      total: rows.length,
      items: rows.slice(0, limit).map(view),
      me: mine ? view(mine) : null,
    };
  }

  /** 확정된 정산의 공개 순위(탈퇴한 참가자는 익명 표시) */
  async finalRanking(userId, challengeId, limit) {
    const { rows } = await this.database.query(
      `SELECT f.rank_no, f.score, f.display_name, cp.user_id
         FROM challenge_final_rankings f
         JOIN challenge_settlement_runs r ON r.id = f.run_id AND r.status = 'confirmed'
         LEFT JOIN challenge_participations cp ON cp.id = f.participation_id
        WHERE r.challenge_id = $1 ORDER BY f.rank_no`,
      [challengeId],
    );
    const view = (row) => ({
      rank: row.rank_no,
      displayName: row.display_name,
      successfulDays: row.score / POINTS_PER_SUCCESS_DAY,
      score: row.score,
      isMe: row.user_id === userId,
    });
    const mine = rows.find((row) => row.user_id === userId);
    return {
      provisional: false,
      total: rows.length,
      items: rows.slice(0, limit).map(view),
      me: mine ? view(mine) : null,
    };
  }

  // ───────── 관리자 ─────────

  async listParticipants(challengeId) {
    const { rows: exists } = await this.database.query(
      'SELECT 1 FROM challenges WHERE id = $1',
      [challengeId],
    );
    if (!exists[0]) throw notFound();
    const { rows } = await this.database.query(
      `SELECT p.id, p.user_id, pf.nickname, p.status, p.joined_at,
              (SELECT count(*) FROM challenge_daily_missions d
                WHERE d.participation_id = p.id AND d.status = 'success')::int AS successful_days,
              (SELECT count(*) FROM challenge_daily_missions d
                WHERE d.participation_id = p.id AND d.status = 'pending'
                  AND d.challenge_date < ${TODAY_SQL})::int AS pending_days
         FROM challenge_participations p
         LEFT JOIN profiles pf ON pf.user_id = p.user_id
        WHERE p.challenge_id = $1 ORDER BY p.joined_at, p.id`,
      [challengeId],
    );
    return {
      items: rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        nickname: row.nickname,
        status: row.status,
        joinedAt: row.joined_at,
        successfulDays: row.successful_days,
        score: row.successful_days * POINTS_PER_SUCCESS_DAY,
        pendingDays: row.pending_days,
      })),
    };
  }

  /**
   * M60 순위: 점수·성공 일수 내림차순, 같으면 먼저 참가한 순서
   * 실격자는 순위에서 뺌. flags는 자동 감지 항목이 아직 없어 빈 배열
   */
  async getRankings(challengeId) {
    const { items } = await this.listParticipants(challengeId);
    const ranked = items
      .filter((item) => item.status !== 'disqualified')
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.successfulDays - a.successfulDays ||
          new Date(a.joinedAt) - new Date(b.joinedAt),
      );
    return {
      ranking: { challengeId, calculatedAt: new Date().toISOString() },
      entries: ranked.map((item, index) => ({
        participationId: item.id,
        userId: item.userId,
        nickname: item.nickname,
        rankNo: index + 1,
        score: item.score,
        successfulDays: item.successfulDays,
        flags: [],
      })),
    };
  }

  async getParticipantDays(challengeId, participationId) {
    const { rows } = await this.database.query(
      `SELECT d.id, d.challenge_date::text AS date, d.status, d.mission_id,
              d.qualifying_record_id, d.qualifying_result_id
         FROM challenge_daily_missions d
        WHERE d.challenge_id = $1 AND d.participation_id = $2 ORDER BY d.challenge_date`,
      [challengeId, participationId],
    );
    return {
      items: rows.map((row) => ({
        id: row.id,
        date: row.date,
        status: row.status,
        missionId: row.mission_id,
        qualifyingRecordId: row.qualifying_record_id,
        qualifyingResultId: row.qualifying_result_id,
      })),
    };
  }

  async lockParticipation(tx, challengeId, participationId) {
    const { rows: challenge } = await tx.query(
      `SELECT id, title, start_date::text AS start_date, ${TODAY_SQL}::text AS today,
              settlement_status
         FROM challenges WHERE id = $1 FOR UPDATE`,
      [challengeId],
    );
    if (!challenge[0]) throw notFound();
    const { rows } = await tx.query(
      `SELECT * FROM challenge_participations
        WHERE id = $1 AND challenge_id = $2 FOR UPDATE`,
      [participationId, challengeId],
    );
    if (!rows[0])
      throw notFound('participant_not_found', '참가 기록을 찾을 수 없음');
    return { challenge: challenge[0], participation: rows[0] };
  }

  /**
   * 실격: 참가를 disqualified(최종)로 바꿔 순위에서 빼고 앞으로의 미션을 취소, 사유 필수
   * DB 규칙상 실격·완주·실패 참가는 enrolled로 복귀 불가 → 복구 기능 없음
   */
  disqualify(adminId, challengeId, participationId, reason, key) {
    return this.mutation.run(adminId, {
      key,
      operation: 'challenge.moderate',
      payload: { challengeId, participationId, reason },
      reason,
      run: async (tx) => {
        const { challenge, participation } = await this.lockParticipation(
          tx,
          challengeId,
          participationId,
        );
        if (challenge.settlement_status === 'confirmed') {
          throw conflict(
            'challenge_settled',
            '정산이 확정된 챌린지임(정정 정산으로 처리)',
          );
        }
        if (participation.status !== 'enrolled') {
          throw conflict(
            'not_enrolled',
            '참가 중인 기록만 실격 처리할 수 있음',
            {
              status: participation.status,
            },
          );
        }
        await this.participation.withdraw(
          tx,
          participation,
          challenge,
          'challenge_disqualified',
          'disqualified',
        );
        await tx.query(
          `INSERT INTO challenge_moderation_actions (id, participation_id, admin_id, action, reason)
           VALUES ($1,$2,$3,'disqualify',$4)`,
          [randomUUID(), participationId, adminId, reason],
        );
        return {
          targetUserId: participation.user_id,
          before: { status: 'enrolled' },
          result: { participationId, status: 'disqualified' },
        };
      },
    });
  }

  /** 일자 제외: 근거와 사유를 남기고 그 날을 점수에서 뺀다(excluded). 판정 자체는 바꾸지 않음 */
  excludeDay(adminId, challengeId, participationId, dailyId, input, key) {
    return this.mutation.run(adminId, {
      key,
      operation: 'challenge.moderate',
      payload: { challengeId, participationId, dailyId, ...input },
      reason: input.reason,
      run: async (tx) => {
        const { challenge, participation } = await this.lockParticipation(
          tx,
          challengeId,
          participationId,
        );
        if (challenge.settlement_status === 'confirmed') {
          throw conflict(
            'challenge_settled',
            '정산이 확정된 챌린지임(정정 정산으로 처리)',
          );
        }
        const day = await this.lockDay(tx, participationId, dailyId);
        if (day.status === 'excluded') {
          return {
            targetUserId: participation.user_id,
            result: { dailyId, status: 'excluded' },
          };
        }
        if (day.status === 'cancelled') {
          throw conflict('day_cancelled', '취소된 날은 제외할 수 없음');
        }
        await tx.query(
          `UPDATE challenge_daily_missions
              SET status = 'excluded', qualifying_record_id = NULL, qualifying_result_id = NULL,
                  judged_at = now(), updated_at = now() WHERE id = $1`,
          [dailyId],
        );
        await tx.query(
          `INSERT INTO challenge_moderation_actions
                  (id, participation_id, daily_mission_id, admin_id, action, reason, evidence_result_id)
           VALUES ($1,$2,$3,$4,'exclude_day',$5,$6)`,
          [
            randomUUID(),
            participationId,
            dailyId,
            adminId,
            input.reason,
            input.evidenceResultId ?? day.qualifying_result_id ?? null,
          ],
        );
        return {
          targetUserId: participation.user_id,
          before: { status: day.status },
          result: { dailyId, status: 'excluded' },
        };
      },
    });
  }

  /** 제외 복구: 원본 판정으로 그 날을 다시 평가 */
  restoreDay(adminId, challengeId, participationId, dailyId, reason, key) {
    return this.mutation.run(adminId, {
      key,
      operation: 'challenge.moderate',
      payload: { challengeId, participationId, dailyId, reason },
      reason,
      run: async (tx) => {
        const { challenge, participation } = await this.lockParticipation(
          tx,
          challengeId,
          participationId,
        );
        if (challenge.settlement_status === 'confirmed') {
          throw conflict(
            'challenge_settled',
            '정산이 확정된 챌린지임(정정 정산으로 처리)',
          );
        }
        const day = await this.lockDay(tx, participationId, dailyId);
        if (day.status !== 'excluded') {
          throw conflict('day_not_excluded', '제외된 날만 복구할 수 있음', {
            status: day.status,
          });
        }
        await tx.query(
          `UPDATE challenge_daily_missions SET status = 'pending', judged_at = now(), updated_at = now()
            WHERE id = $1`,
          [dailyId],
        );
        await tx.query(
          `INSERT INTO challenge_moderation_actions
                  (id, participation_id, daily_mission_id, admin_id, action, reason)
           VALUES ($1,$2,$3,$4,'restore_day',$5)`,
          [randomUUID(), participationId, dailyId, adminId, reason],
        );
        await this.recalculateParticipation(tx, participationId);
        const { rows } = await tx.query(
          'SELECT status FROM challenge_daily_missions WHERE id = $1',
          [dailyId],
        );
        return {
          targetUserId: participation.user_id,
          before: { status: 'excluded' },
          result: { dailyId, status: rows[0].status },
        };
      },
    });
  }

  async lockDay(tx, participationId, dailyId) {
    const { rows } = await tx.query(
      `SELECT id, status, qualifying_result_id FROM challenge_daily_missions
        WHERE id = $1 AND participation_id = $2 FOR UPDATE`,
      [dailyId, participationId],
    );
    if (!rows[0]) throw notFound('day_not_found', '일별 기록을 찾을 수 없음');
    return rows[0];
  }
}
