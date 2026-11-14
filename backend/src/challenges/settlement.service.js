import { newId } from '../common/ids.js';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AdminMutationService } from '../admin-auth/admin-mutation.service.js';
import { DatabaseService } from '../database/database.service.js';
import { RewardPayoutService } from './reward-payout.service.js';
import { conflict, httpError } from '../common/errors/http-errors.js';
import { TODAY_SQL } from '../common/time/kst-sql.js';

const notFound = (
  code = 'challenge_not_found',
  message = '챌린지를 찾을 수 없음',
) => httpError(HttpStatus.NOT_FOUND, code, message);

/**
 * 정산 초안·확정
 * 1) 초안: 종료 다음 날부터 참가자별 성공 일수·완주·순위·보상을 계산해 draft로 저장
 * 2) 확정: 관리자가 사유와 함께 확정 → 순위 스냅샷 생성·참가 상태 갱신 (이전 확정본은 superseded)
 *    - 조건: 종료, 미확정 일별 결과·판정 대기·열린 이의 제기 없음 (DB 트리거도 검사)
 * 3) 지급·정정: 확정 후 RewardPayoutService가 완주자별 처리 (멱등, 실패 시 재시도)
 * 잠금 순서: 챌린지 → 정산 → (지급) 지갑 → 월간 사용량 → XP/펫 → 업적
 */
@Injectable()
@Dependencies(DatabaseService, AdminMutationService, RewardPayoutService)
export class SettlementService {
  constructor(database, mutation, payout) {
    this.database = database;
    this.mutation = mutation;
    this.payout = payout;
  }

  async lockChallenge(tx, challengeId) {
    const { rows } = await tx.query(
      `SELECT c.id, c.publication_status, c.settlement_status, c.required_success_days,
              c.start_date::text AS start_date, c.end_date::text AS end_date,
              ${TODAY_SQL}::text AS today,
              p.points, p.user_xp, p.pet_xp, p.badge_achievement_version_id
         FROM challenges c
         LEFT JOIN challenge_reward_packages p ON p.challenge_id = c.id
        WHERE c.id = $1 FOR UPDATE OF c`,
      [challengeId],
    );
    if (!rows[0]) throw notFound();
    return rows[0];
  }

  // ───────── 계산 ─────────

  /** 현재 일별 결과에서 참가자별 정산 항목을 계산(순위는 완주·실패 참가자만) */
  async computeEntries(tx, challenge) {
    const { rows } = await tx.query(
      `SELECT cp.id AS participation_id, cp.user_id, cp.status, cp.joined_at, pf.nickname,
              (SELECT count(*) FROM challenge_daily_missions d
                WHERE d.participation_id = cp.id AND d.status = 'success')::int AS successful_days,
              (SELECT mr.submitted_at::text FROM challenge_daily_missions d
                 JOIN mission_records mr ON mr.id = d.qualifying_record_id
                WHERE d.participation_id = cp.id AND d.status = 'success'
                ORDER BY d.challenge_date DESC LIMIT 1) AS last_submitted_at,
              (SELECT (extract(epoch FROM mr.submitted_at) * 1000000)::bigint
                 FROM challenge_daily_missions d
                 JOIN mission_records mr ON mr.id = d.qualifying_record_id
                WHERE d.participation_id = cp.id AND d.status = 'success'
                ORDER BY d.challenge_date DESC LIMIT 1) AS last_submitted_us,
              g.id AS grant_id, g.status AS grant_status, g.paid_points AS grant_paid,
              (SELECT m.reason FROM challenge_moderation_actions m
                WHERE m.participation_id = cp.id AND m.action = 'disqualify'
                ORDER BY m.occurred_at DESC LIMIT 1) AS disqualify_reason
         FROM challenge_participations cp
         LEFT JOIN profiles pf ON pf.user_id = cp.user_id
         LEFT JOIN challenge_reward_grants g ON g.participation_id = cp.id
        WHERE cp.challenge_id = $1`,
      [challenge.id],
    );
    const ranked = rows
      .filter((row) => !['withdrawn', 'disqualified'].includes(row.status))
      .sort(
        (a, b) =>
          b.successful_days - a.successful_days ||
          (a.last_submitted_us === null) - (b.last_submitted_us === null) ||
          (a.last_submitted_us !== null && b.last_submitted_us !== null
            ? Number(a.last_submitted_us) - Number(b.last_submitted_us)
            : 0) ||
          a.joined_at - b.joined_at ||
          (a.participation_id < b.participation_id ? -1 : 1),
      );
    const rankOf = new Map(
      ranked.map((row, index) => [row.participation_id, index + 1]),
    );

    return rows.map((row) => {
      let outcome;
      if (row.status === 'withdrawn') outcome = 'withdrawn';
      else if (row.status === 'disqualified') outcome = 'disqualified';
      else
        outcome =
          row.successful_days >= challenge.required_success_days
            ? 'completed'
            : 'failed';
      const completed = outcome === 'completed';
      return {
        participationId: row.participation_id,
        userId: row.user_id,
        nickname: row.nickname,
        successfulDays: row.successful_days,
        lastSubmittedAt: row.last_submitted_at,
        lastSubmittedUs:
          row.last_submitted_us === null ? '' : String(row.last_submitted_us),
        rank: rankOf.get(row.participation_id) ?? null,
        outcome,
        exclusionReason:
          outcome === 'withdrawn'
            ? '자진 포기'
            : outcome === 'disqualified'
              ? (row.disqualify_reason ?? '실격')
              : null,
        promisedPoints: completed ? (challenge.points ?? 0) : 0,
        userXp: completed ? (challenge.user_xp ?? 0) : 0,
        petXp: completed ? (challenge.pet_xp ?? 0) : 0,
        paidPoints: completed && row.grant_id ? Number(row.grant_paid) : 0,
        paymentStatus: !completed
          ? 'none'
          : row.grant_status === 'active'
            ? 'paid'
            : 'pending',
        grantStatus: row.grant_status ?? null,
      };
    });
  }

  /** 확정을 막는 조건(DB 트리거와 같은 기준) */
  async blockers(tx, challenge) {
    const one = async (sql) =>
      Number((await tx.query(sql, [challenge.id])).rows[0].n);
    const pendingDays = await one(
      `SELECT count(*) AS n FROM challenge_daily_missions WHERE challenge_id = $1 AND status = 'pending'`,
    );
    const waitingSubmissions = await one(
      `SELECT count(*) AS n FROM challenge_daily_missions d
         JOIN mission_records mr ON mr.mission_id = d.mission_id
        WHERE d.challenge_id = $1
          AND mr.submitted_at < ((d.challenge_date + 1)::timestamp AT TIME ZONE 'Asia/Seoul')
          AND (mr.status IN ('submitted', 'review_required')
               OR EXISTS (SELECT 1 FROM verification_appeals va
                           WHERE va.record_id = mr.id AND va.status = 'open'))`,
    );
    const incompleteParticipants = await one(
      `SELECT count(*) AS n FROM challenge_participations p
        WHERE p.challenge_id = $1 AND (SELECT count(*) FROM challenge_daily_missions d
                WHERE d.participation_id = p.id) <>
              (SELECT end_date - start_date + 1 FROM challenges c WHERE c.id = p.challenge_id)`,
    );
    const notEnded = challenge.today <= challenge.end_date;
    return {
      notEnded,
      pendingDays,
      waitingSubmissions,
      incompleteParticipants,
      ready:
        !notEnded &&
        pendingDays === 0 &&
        waitingSubmissions === 0 &&
        incompleteParticipants === 0,
    };
  }

  entryView(row) {
    return {
      participationId: row.participation_id,
      rank: row.rank_no,
      outcome: row.outcome,
      successfulDays: row.successful_days,
      score: row.score,
      lastQualifyingSubmittedAt: row.last_qualifying_submitted_at,
      promisedPoints: row.promised_points,
      paidPoints: row.paid_points,
      userXp: row.user_xp,
      petXp: row.pet_xp,
      paymentStatus: row.payment_status,
      exclusionReason: row.exclusion_reason,
    };
  }

  async runView(db, runId) {
    const { rows } = await db.query(
      `SELECT id, challenge_id, run_no, status, based_on_at, confirmed_by_admin_id, confirmed_at, reason
         FROM challenge_settlement_runs WHERE id = $1`,
      [runId],
    );
    const run = rows[0];
    const { rows: entries } = await db.query(
      `SELECT participation_id, rank_no, outcome, successful_days, score,
              last_qualifying_submitted_at, promised_points, paid_points, user_xp, pet_xp,
              payment_status, exclusion_reason
         FROM challenge_settlement_entries WHERE run_id = $1
        ORDER BY rank_no NULLS LAST, participation_id`,
      [runId],
    );
    return {
      id: run.id,
      challengeId: run.challenge_id,
      runNo: run.run_no,
      status: run.status,
      basedOnAt: run.based_on_at,
      confirmedAt: run.confirmed_at,
      reason: run.reason,
      entries: entries.map((row) => this.entryView(row)),
    };
  }

  // ───────── 조회 ─────────

  /** 정산 실행 ID로 챌린지를 찾음 (M57~M59는 실행 ID만 경로에 있음) */
  async challengeIdOfRun(runId) {
    const { rows } = await this.database.query(
      'SELECT challenge_id FROM challenge_settlement_runs WHERE id = $1',
      [runId],
    );
    if (!rows[0]) throw notFound('settlement_not_found', '정산을 찾을 수 없음');
    return rows[0].challenge_id;
  }

  async getRun(challengeId, runId) {
    const { rows } = await this.database.query(
      'SELECT status FROM challenge_settlement_runs WHERE id = $1 AND challenge_id = $2',
      [runId, challengeId],
    );
    if (!rows[0]) throw notFound('settlement_not_found', '정산을 찾을 수 없음');
    const view = await this.runView(this.database, runId);
    if (rows[0].status === 'draft') {
      const challenge = await this.database.withTransaction((tx) =>
        this.lockChallenge(tx, challengeId).then(async (c) => ({
          ...c,
          blockers: await this.blockers(tx, c),
        })),
      );
      view.blockers = challenge.blockers;
    }
    return view;
  }

  // ───────── 초안 ─────────

  /** 정산 초안 생성(기존 초안 대체), 확정본이 있으면 정정 초안 */
  createDraft(adminId, challengeId, key, reason) {
    return this.mutation.run(adminId, {
      key,
      reason,
      operation: 'settlement.create',
      payload: { challengeId },
      run: async (tx) => {
        const challenge = await this.lockChallenge(tx, challengeId);
        if (!['public', 'hidden'].includes(challenge.publication_status)) {
          throw conflict(
            'challenge_not_settleable',
            '정산할 수 없는 상태의 챌린지',
            {
              status: challenge.publication_status,
            },
          );
        }
        if (challenge.today <= challenge.end_date) {
          throw conflict(
            'challenge_not_ended',
            '종료 다음 날부터 정산 초안을 만들 수 있음',
            {
              endDate: challenge.end_date,
            },
          );
        }
        await tx.query(
          `DELETE FROM challenge_settlement_runs WHERE challenge_id = $1 AND status = 'draft'`,
          [challengeId],
        );
        const { rows } = await tx.query(
          `SELECT COALESCE(max(run_no), 0) + 1 AS n FROM challenge_settlement_runs WHERE challenge_id = $1`,
          [challengeId],
        );
        const runId = newId();
        await tx.query(
          `INSERT INTO challenge_settlement_runs (id, challenge_id, run_no) VALUES ($1,$2,$3)`,
          [runId, challengeId, rows[0].n],
        );
        const entries = await this.computeEntries(tx, challenge);
        if (entries.length > 0) {
          const col = (pick) => entries.map(pick);
          await tx.query(
            `INSERT INTO challenge_settlement_entries
                    (run_id, challenge_id, participation_id, successful_days,
                     last_qualifying_submitted_at, rank_no, outcome, exclusion_reason,
                     promised_points, paid_points, user_xp, pet_xp, payment_status)
             SELECT $1, $2, * FROM unnest($3::short_id[], $4::int[], $5::timestamptz[], $6::int[],
                    $7::text[], $8::text[], $9::int[], $10::int[], $11::int[], $12::int[], $13::text[])`,
            [
              runId,
              challengeId,
              col((e) => e.participationId),
              col((e) => e.successfulDays),
              col((e) => e.lastSubmittedAt),
              col((e) => e.rank),
              col((e) => e.outcome),
              col((e) => e.exclusionReason),
              col((e) => e.promisedPoints),
              col((e) => e.paidPoints),
              col((e) => e.userXp),
              col((e) => e.petXp),
              col((e) => e.paymentStatus),
            ],
          );
        }
        if (challenge.settlement_status === 'not_started') {
          await tx.query(
            `UPDATE challenges SET settlement_status = 'draft', updated_at = now() WHERE id = $1`,
            [challengeId],
          );
        }
        const view = await this.runView(tx, runId);
        view.blockers = await this.blockers(tx, challenge);
        return { result: view };
      },
    });
  }

  // ───────── 확정 ─────────

  /** 확정: 초안이 최신 일별 결과와 같을 때만, 이전 확정본은 superseded. 지급은 확정 뒤 별도로 실행 */
  async confirm(adminId, challengeId, runId, reason, key) {
    const result = await this.mutation.run(adminId, {
      key,
      operation: 'settlement.confirm',
      payload: { challengeId, runId, reason },
      reason,
      run: async (tx) => {
        const challenge = await this.lockChallenge(tx, challengeId);
        const { rows: runs } = await tx.query(
          `SELECT id, status, run_no FROM challenge_settlement_runs
            WHERE id = $1 AND challenge_id = $2 FOR UPDATE`,
          [runId, challengeId],
        );
        if (!runs[0])
          throw notFound('settlement_not_found', '정산을 찾을 수 없음');
        if (runs[0].status !== 'draft') {
          throw conflict('settlement_not_draft', '초안만 확정할 수 있음', {
            status: runs[0].status,
          });
        }

        const blockers = await this.blockers(tx, challenge);
        if (!blockers.ready) {
          throw conflict(
            'settlement_not_ready',
            '확정 조건을 아직 만족하지 못함',
            blockers,
          );
        }
        const fresh = await this.computeEntries(tx, challenge);
        const { rows: stored } = await tx.query(
          `SELECT participation_id, successful_days, rank_no, outcome,
                  (extract(epoch FROM last_qualifying_submitted_at) * 1000000)::bigint AS last_us
             FROM challenge_settlement_entries WHERE run_id = $1`,
          [runId],
        );
        const fingerprint = (x) =>
          `${x.participationId}|${x.successfulDays}|${x.rank ?? ''}|${x.outcome}|${x.lastSubmittedUs}`;
        const storedPrint = stored
          .map((x) =>
            fingerprint({
              participationId: x.participation_id,
              successfulDays: x.successful_days,
              rank: x.rank_no,
              outcome: x.outcome,
              lastSubmittedUs: x.last_us === null ? '' : String(x.last_us),
            }),
          )
          .sort();
        const freshPrint = fresh.map(fingerprint).sort();
        if (JSON.stringify(storedPrint) !== JSON.stringify(freshPrint)) {
          throw conflict(
            'draft_stale',
            '초안을 만든 뒤 일별 결과나 참가 상태가 바뀌었음(초안을 다시 만들어야 함)',
          );
        }

        const { rows: previous } = await tx.query(
          `SELECT id FROM challenge_settlement_runs
            WHERE challenge_id = $1 AND status = 'confirmed' FOR UPDATE`,
          [challengeId],
        );
        if (previous[0]) {
          await tx.query(
            `UPDATE challenge_settlement_runs SET status = 'superseded' WHERE id = $1`,
            [previous[0].id],
          );
        }
        try {
          await tx.query(
            `UPDATE challenge_settlement_runs
                SET status = 'confirmed', confirmed_by_admin_id = $2, confirmed_at = now(), reason = $3
              WHERE id = $1`,
            [runId, adminId, reason],
          );
        } catch (error) {
          if (error?.code === '23514') {
            throw conflict(
              'settlement_not_ready',
              '확정 조건을 아직 만족하지 못함',
              blockers,
            );
          }
          throw error;
        }

        // 공개 순위 스냅샷(이름은 확정 시점 닉네임), 참가 상태 갱신
        const ranked = fresh.filter((entry) => entry.rank !== null);
        if (ranked.length > 0) {
          await tx.query(
            `INSERT INTO challenge_final_rankings (id, run_id, participation_id, rank_no, score, display_name)
             SELECT new_short_id(), $1, * FROM unnest($2::short_id[], $3::int[], $4::int[], $5::text[])`,
            [
              runId,
              ranked.map((e) => e.participationId),
              ranked.map((e) => e.rank),
              ranked.map((e) => e.successfulDays * 100),
              ranked.map((e) => e.nickname),
            ],
          );
        }
        for (const outcome of ['completed', 'failed']) {
          const ids = fresh
            .filter((entry) => entry.outcome === outcome)
            .map((entry) => entry.participationId);
          if (ids.length === 0) continue;
          await tx.query(
            `UPDATE challenge_participations
                SET status = $2::text,
                    completed_at = CASE WHEN $2::text = 'completed' THEN COALESCE(completed_at, now()) END,
                    updated_at = now()
              WHERE id = ANY($1::short_id[])`,
            [ids, outcome],
          );
        }
        const corrected = await this.payout.reconcileGrants(tx, fresh);
        await tx.query(
          `UPDATE challenges SET settlement_status = 'confirmed', updated_at = now() WHERE id = $1`,
          [challengeId],
        );
        return {
          before: previous[0] ? { supersededRunId: previous[0].id } : undefined,
          result: {
            runId,
            runNo: runs[0].run_no,
            status: 'confirmed',
            entries: fresh.length,
            finalRankings: fresh.filter((e) => e.rank !== null).length,
            completed: fresh.filter((e) => e.outcome === 'completed').length,
            revokedGrants: corrected.revoked,
          },
        };
      },
    });
    // 확정이 커밋된 뒤 참가자별로 지급(실패는 기록되고 작업이 재시도)
    result.payments = await this.payout.payRun(result.runId);
    return result;
  }
}
