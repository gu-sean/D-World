import { newId } from '../common/ids.js';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from '../admin-auth/audit.service.js';
import { AdminIdempotencyService } from '../common/idempotency/admin-idempotency.service.js';
import { addDays } from '../common/time/kst.js';
import { DatabaseService } from '../database/database.service.js';
import { conflict, httpError } from '../common/errors/http-errors.js';
import { TODAY_SQL } from '../common/time/kst-sql.js';

const notFound = () =>
  httpError(
    HttpStatus.NOT_FOUND,
    'challenge_not_found',
    '챌린지를 찾을 수 없음',
  );

/**
 * 참가·포기와 일별 미션
 * - 참가하면 기간의 날짜마다 챌린지 전용 미션(source_type='challenge', 보상 0)과 challenge_daily_missions를
 *   한 트랜잭션에서 모두 생성. 수행·제출·판정은 기존 수행 회차 흐름 재사용
 * - 시작 전 포기는 미션을 지우고(재신청 가능), 시작 후 포기는 이력을 남기고 앞으로의 미션만 취소한다(재참가 불가).
 * 잠금 순서: 챌린지 → 참가 행 → 미션
 */
@Injectable()
@Dependencies(DatabaseService, AuditService, AdminIdempotencyService)
export class ParticipationService {
  constructor(database, audit, idempotency) {
    this.database = database;
    this.audit = audit;
    this.idempotency = idempotency;
  }

  async lockChallenge(tx, challengeId) {
    const { rows } = await tx.query(
      `SELECT id, title, category_id, difficulty_id, verification_method, exercise_code,
              target_value, target_unit, estimated_duration_seconds,
              start_date::text AS start_date, end_date::text AS end_date,
              publication_status, ${TODAY_SQL}::text AS today
         FROM challenges WHERE id = $1 FOR UPDATE`,
      [challengeId],
    );
    if (!rows[0]) throw notFound();
    return rows[0];
  }

  view(row) {
    return {
      id: row.id,
      challengeId: row.challenge_id,
      status: row.status,
      joinedAt: row.joined_at,
      withdrawnAt: row.withdrawn_at,
      completedAt: row.completed_at,
    };
  }

  // ───────── 참가 ─────────

  async join(userId, challengeId) {
    return this.database.withTransaction(async (tx) => {
      const challenge = await this.lockChallenge(tx, challengeId);
      if (challenge.publication_status !== 'public') throw notFound();
      if (challenge.today >= challenge.start_date) {
        throw conflict('enrollment_closed', '시작일 전까지만 참가할 수 있음', {
          startDate: challenge.start_date,
        });
      }

      const { rows: existing } = await tx.query(
        `SELECT * FROM challenge_participations
          WHERE challenge_id = $1 AND user_id = $2 FOR UPDATE`,
        [challengeId, userId],
      );
      let participation = existing[0];
      if (participation?.status === 'enrolled') return this.view(participation);
      if (participation && participation.status !== 'withdrawn') {
        throw conflict(
          'participation_final',
          '이미 끝난 참가 기록이 있어 다시 참가할 수 없음',
          { status: participation.status },
        );
      }

      try {
        if (participation) {
          await tx.query(
            `UPDATE challenge_participations
                SET status = 'enrolled', withdrawn_at = NULL, joined_at = now(), updated_at = now()
              WHERE id = $1`,
            [participation.id],
          );
        } else {
          participation = { id: newId() };
          await tx.query(
            `INSERT INTO challenge_participations (id, challenge_id, user_id) VALUES ($1,$2,$3)`,
            [participation.id, challengeId, userId],
          );
        }
      } catch (error) {
        if (error?.code === '23514' && /full/.test(error.message)) {
          throw conflict('challenge_full', '참가 인원이 가득 참');
        }
        if (error?.code === '23514' && /not open/.test(error.message)) {
          throw conflict(
            'challenge_not_open',
            '지금은 참가할 수 없는 챌린지(공개 전이거나 계정 상태 제한)',
          );
        }
        throw error;
      }

      await this.createDailyMissions(tx, userId, participation.id, challenge);
      const { rows } = await tx.query(
        'SELECT * FROM challenge_participations WHERE id = $1',
        [participation.id],
      );
      return this.view(rows[0]);
    });
  }

  async insertMission(tx, userId, challenge, date, dayNo) {
    const missionId = newId();
    await tx.query(
      `INSERT INTO missions
              (id, user_id, source_type, title, category_id, difficulty_id, target_value,
               target_unit, estimated_duration_seconds, verification_method, exercise_code,
               scheduled_date)
       VALUES ($1,$2,'challenge',$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        missionId,
        userId,
        `${challenge.title} ${dayNo}일차`.slice(0, 200),
        challenge.category_id,
        challenge.difficulty_id,
        challenge.target_value,
        challenge.target_unit,
        challenge.estimated_duration_seconds,
        challenge.verification_method,
        challenge.exercise_code,
        date,
      ],
    );
    return missionId;
  }

  /**
   * 기간(양 끝 포함) 날짜마다 미션·일별 행을 한 쌍씩 생성
   * 시작 전 포기 후 재신청이면 취소된 날은 새 미션으로 교체해 복구
   * (정산은 모든 참가의 일별 행이 기간 일수만큼 있어야 하므로 행은 지우지 않는다).
   */
  async createDailyMissions(tx, userId, participationId, challenge) {
    const { rows: existing } = await tx.query(
      `SELECT id, challenge_date::text AS date, status FROM challenge_daily_missions
        WHERE participation_id = $1`,
      [participationId],
    );
    const byDate = new Map(existing.map((row) => [row.date, row]));
    let dayNo = 1;
    for (
      let date = challenge.start_date;
      date <= challenge.end_date;
      date = addDays(date, 1)
    ) {
      const missionId = await this.insertMission(
        tx,
        userId,
        challenge,
        date,
        dayNo,
      );
      const row = byDate.get(date);
      if (!row) {
        await tx.query(
          `INSERT INTO challenge_daily_missions
                  (id, participation_id, challenge_id, user_id, challenge_date, mission_id)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [newId(), participationId, challenge.id, userId, date, missionId],
        );
      } else if (row.status === 'cancelled') {
        await tx.query(
          `UPDATE challenge_daily_missions
              SET mission_id = $2, status = 'pending', updated_at = now() WHERE id = $1`,
          [row.id, missionId],
        );
      } else {
        // 이력이 있는 날은 유지, 방금 만든 미션은 삭제
        await tx.query('DELETE FROM missions WHERE id = $1', [missionId]);
      }
      dayNo += 1;
    }
  }

  // ───────── 포기 ─────────

  async leave(userId, challengeId) {
    return this.database.withTransaction(async (tx) => {
      const challenge = await this.lockChallenge(tx, challengeId);
      const { rows } = await tx.query(
        `SELECT * FROM challenge_participations
          WHERE challenge_id = $1 AND user_id = $2 FOR UPDATE`,
        [challengeId, userId],
      );
      const participation = rows[0];
      if (!participation) throw notFound();
      if (participation.status === 'withdrawn') return this.view(participation);
      if (participation.status !== 'enrolled') {
        throw conflict(
          'participation_final',
          '이미 끝난 참가 기록은 포기할 수 없음',
          { status: participation.status },
        );
      }
      await this.withdraw(tx, participation, challenge);
      const { rows: after } = await tx.query(
        'SELECT * FROM challenge_participations WHERE id = $1',
        [participation.id],
      );
      return this.view(after[0]);
    });
  }

  /**
   * 참가 상태를 withdrawn으로 바꾸고 일별 미션 정리
   * 시작 전이면 모든 날의 미션을 취소(재신청 때 새 미션으로 되살림), 시작 후면 이력은 두고 오늘 이후의 손대지 않은 미션만 취소
   */
  async withdraw(
    tx,
    participation,
    challenge,
    reason = 'challenge_withdrawn',
    status = 'withdrawn',
  ) {
    const started = challenge.today >= challenge.start_date;
    await tx.query(
      `UPDATE challenge_participations
          SET status = $2::text,
              withdrawn_at = CASE WHEN $2::text = 'withdrawn' THEN now() END,
              updated_at = now()
        WHERE id = $1`,
      [participation.id, status],
    );
    // 시작한 기록(회차가 있는 미션)은 남기고, 손대지 않은 오늘 이후 미션만 취소
    const { rows } = await tx.query(
      `SELECT d.id AS daily_id, d.mission_id
         FROM challenge_daily_missions d
         JOIN missions m ON m.id = d.mission_id
        WHERE d.participation_id = $1
          AND ($2::boolean OR d.challenge_date >= ${TODAY_SQL})
          AND d.status = 'pending' AND m.status = 'scheduled'
          AND NOT EXISTS (SELECT 1 FROM mission_records r WHERE r.mission_id = m.id)`,
      [participation.id, !started],
    );
    if (rows.length === 0) return;
    await tx.query(
      `UPDATE missions SET status = 'cancelled', cancel_reason = $2, cancelled_at = now(),
              updated_at = now() WHERE id = ANY($1::short_id[])`,
      [rows.map((row) => row.mission_id), reason],
    );
    await tx.query(
      `UPDATE challenge_daily_missions SET status = 'cancelled', updated_at = now()
        WHERE id = ANY($1::short_id[])`,
      [rows.map((row) => row.daily_id)],
    );
  }

  // ───────── 조회 ─────────

  async getMine(userId, challengeId) {
    const { rows } = await this.database.query(
      `SELECT * FROM challenge_participations WHERE challenge_id = $1 AND user_id = $2`,
      [challengeId, userId],
    );
    if (!rows[0]) throw notFound();
    const { rows: days } = await this.database.query(
      `SELECT challenge_date::text AS date, mission_id, status
         FROM challenge_daily_missions WHERE participation_id = $1 ORDER BY challenge_date`,
      [rows[0].id],
    );
    const { rows: settled } = await this.database.query(
      `SELECT e.outcome, e.rank_no, e.score, e.promised_points, e.paid_points, e.user_xp,
              e.pet_xp, e.payment_status
         FROM challenge_settlement_entries e
         JOIN challenge_settlement_runs r ON r.id = e.run_id AND r.status = 'confirmed'
        WHERE e.participation_id = $1`,
      [rows[0].id],
    );
    return {
      ...this.view(rows[0]),
      settlement: settled[0]
        ? {
            outcome: settled[0].outcome,
            rank: settled[0].rank_no,
            score: settled[0].score,
            promisedPoints: settled[0].promised_points,
            paidPoints: settled[0].paid_points,
            userXp: settled[0].user_xp,
            petXp: settled[0].pet_xp,
            paymentStatus: settled[0].payment_status,
          }
        : null,
      days: days.map((d) => ({
        date: d.date,
        missionId: d.mission_id,
        status: d.status,
      })),
    };
  }

  async listMine(userId, { limit }) {
    const { rows } = await this.database.query(
      `SELECT cp.id, cp.challenge_id, cp.status, cp.joined_at, cp.withdrawn_at, cp.completed_at,
              c.title, c.start_date::text AS start_date, c.end_date::text AS end_date,
              c.required_success_days,
              (SELECT count(*) FROM challenge_daily_missions d
                WHERE d.participation_id = cp.id AND d.status = 'success')::int AS successful_days
         FROM challenge_participations cp
         JOIN challenges c ON c.id = cp.challenge_id
        WHERE cp.user_id = $1
        ORDER BY c.start_date DESC, cp.id LIMIT $2`,
      [userId, limit],
    );
    return {
      items: rows.map((row) => ({
        ...this.view(row),
        challenge: {
          title: row.title,
          startDate: row.start_date,
          endDate: row.end_date,
          requiredSuccessDays: row.required_success_days,
        },
        successfulDays: row.successful_days,
      })),
    };
  }

  // ───────── 관리자: 챌린지 취소 ─────────

  /**
   * 취소: 사유 기록, 모든 참가자 포기 처리(앞으로의 미션 정리), 보상 없음
   * 정산이 시작됐거나 끝난 챌린지는 취소 불가
   */
  cancel(adminId, challengeId, reason, key) {
    return this.idempotency.run(
      adminId,
      { key, operation: 'challenge.cancel', payload: { challengeId, reason } },
      async (tx) => {
        const challenge = await this.lockChallenge(tx, challengeId);
        if (
          !['draft', 'public', 'hidden'].includes(challenge.publication_status)
        ) {
          throw conflict('challenge_not_cancellable', '취소할 수 없는 상태', {
            status: challenge.publication_status,
          });
        }
        const { rows: settled } = await tx.query(
          'SELECT settlement_status FROM challenges WHERE id = $1',
          [challengeId],
        );
        if (settled[0].settlement_status !== 'not_started') {
          throw conflict(
            'challenge_settling',
            '정산이 시작된 챌린지는 취소할 수 없음',
          );
        }
        const { rows: enrolled } = await tx.query(
          `SELECT * FROM challenge_participations
            WHERE challenge_id = $1 AND status = 'enrolled' FOR UPDATE`,
          [challengeId],
        );
        for (const participation of enrolled) {
          await this.withdraw(
            tx,
            participation,
            challenge,
            'challenge_cancelled',
          );
        }
        await tx.query(
          `UPDATE challenges SET publication_status = 'cancelled', cancelled_at = now(),
                  updated_at = now() WHERE id = $1`,
          [challengeId],
        );
        await tx.query(
          `INSERT INTO challenge_rule_events (id, challenge_id, admin_id, event_type, reason)
           VALUES ($1,$2,$3,'cancelled',$4)`,
          [newId(), challengeId, adminId, reason],
        );
        await this.audit.record(tx, {
          adminId,
          action: 'challenge.update',
          result: 'success',
          reason,
          before: { status: challenge.publication_status },
          after: {
            status: 'cancelled',
            withdrawnParticipants: enrolled.length,
          },
        });
        return {
          id: challengeId,
          publicationStatus: 'cancelled',
          withdrawnParticipants: enrolled.length,
        };
      },
    );
  }
}
