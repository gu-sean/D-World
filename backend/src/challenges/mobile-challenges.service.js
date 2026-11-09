import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';
import { conflict } from '../common/errors/http-errors.js';
import { addDays, kstDate } from '../common/time/kst.js';
import { TODAY_SQL } from '../common/time/kst-sql.js';
import { DatabaseService } from '../database/database.service.js';
import { SELECT, toView } from './challenges.service.js';
import { ParticipationService } from './participation.service.js';
import { ScoringService } from './scoring.service.js';

const DAY_MS = 86_400_000;

const notFound = (code, message) =>
  new AppException(HttpStatus.NOT_FOUND, code, message);

const daysBetween = (from, to) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  ) + 1;

/**
 * 모바일 챌린지 입력(07 ChallengeInput) → 기존 사용자 개설 규칙의 입력
 * periodDays+startDate → endDate, completionRateRequired → requiredSuccessDays, capacity → maxParticipants
 */
export function fromMobileChallengeInput(body) {
  if (!body || typeof body !== 'object') return body;
  const { periodDays, capacity, completionRateRequired, ...rest } = body;
  const input = { ...rest };
  if (capacity !== undefined && input.maxParticipants === undefined) {
    input.maxParticipants = capacity;
  }
  if (
    periodDays !== undefined &&
    input.startDate !== undefined &&
    input.endDate === undefined
  ) {
    input.endDate = addDays(input.startDate, Number(periodDays) - 1);
  }
  if (
    completionRateRequired !== undefined &&
    input.requiredSuccessDays === undefined
  ) {
    const period =
      periodDays !== undefined
        ? Number(periodDays)
        : input.startDate && input.endDate
          ? daysBetween(input.startDate, input.endDate)
          : null;
    if (period) {
      input.requiredSuccessDays = Math.max(
        1,
        Math.ceil(Number(completionRateRequired) * period),
      );
    }
  }
  if (input.verificationMethod === undefined && input.exerciseCode) {
    input.verificationMethod =
      input.exerciseCode === 'running' ? 'sensor' : 'camera';
  }
  return input;
}

/** 모바일 클라이언트 챌린지 API (08 A102~A105·A107, 07 MyChallenge·ChallengeRanking·ChallengeResult) */
@Injectable()
@Dependencies(DatabaseService, ParticipationService, ScoringService)
export class MobileChallengesService {
  constructor(database, participation, scoring) {
    this.database = database;
    this.participation = participation;
    this.scoring = scoring;
  }

  /** 참가 행들 → 07 MyChallenge[] (기존 키 successfulDays 유지) */
  async myChallengesFor(rows) {
    if (rows.length === 0) return [];
    const [challenges, counts, today] = await Promise.all([
      this.database.query(`${SELECT} WHERE c.id = ANY($1::uuid[])`, [
        rows.map((row) => row.challenge_id),
      ]),
      this.database.query(
        `SELECT participation_id,
                count(*) FILTER (WHERE status = 'success')::int AS success,
                max(status) FILTER (WHERE challenge_date = ${TODAY_SQL}) AS today_status
           FROM challenge_daily_missions
          WHERE participation_id = ANY($1::uuid[])
          GROUP BY participation_id`,
        [rows.map((row) => row.id)],
      ),
    ]);
    const byChallenge = new Map(challenges.rows.map((c) => [c.id, c]));
    const stats = new Map(counts.rows.map((c) => [c.participation_id, c]));
    return rows.map((row) => {
      const challenge = toView(byChallenge.get(row.challenge_id));
      const stat = stats.get(row.id);
      return {
        id: row.id,
        challengeId: row.challenge_id,
        status: row.status,
        joinedAt: row.joined_at,
        withdrawnAt: row.withdrawn_at,
        completedAt: row.completed_at,
        challenge: { ...challenge, joined: row.status === 'enrolled' },
        participationId: row.id,
        successDays: stat?.success ?? 0,
        successfulDays: stat?.success ?? 0,
        requiredDays: challenge.requiredSuccessDays,
        todayStatus: stat?.today_status ?? null,
      };
    });
  }

  /** A104 */
  async list(userId, { status }) {
    const { rows } = await this.database.query(
      `SELECT cp.* FROM challenge_participations cp
         JOIN challenges c ON c.id = cp.challenge_id
        WHERE cp.user_id = $1 AND ($2::text IS NULL OR cp.status = $2)
        ORDER BY c.start_date DESC, cp.id`,
      [userId, status ?? null],
    );
    return this.myChallengesFor(rows);
  }

  async mine(userId, challengeId) {
    const { rows } = await this.database.query(
      `SELECT * FROM challenge_participations
        WHERE challenge_id = $1 AND user_id = $2`,
      [challengeId, userId],
    );
    if (!rows[0]) {
      throw notFound('not_enrolled', '참여 중인 챌린지가 아님');
    }
    return (await this.myChallengesFor(rows))[0];
  }

  /** A102: 이미 참여 중이면 CHALLENGE_ALREADY_JOINED */
  async join(userId, challengeId) {
    const { rows } = await this.database.query(
      `SELECT status FROM challenge_participations
        WHERE challenge_id = $1 AND user_id = $2`,
      [challengeId, userId],
    );
    if (rows[0]?.status === 'enrolled') {
      throw conflict('already_joined', '이미 참여한 챌린지');
    }
    await this.participation.join(userId, challengeId);
    return this.mine(userId, challengeId);
  }

  /** A103: 참여 중이 아니면 CHALLENGE_NOT_JOINED */
  async leave(userId, challengeId) {
    const { rows } = await this.database.query(
      `SELECT status FROM challenge_participations
        WHERE challenge_id = $1 AND user_id = $2`,
      [challengeId, userId],
    );
    if (rows[0]?.status !== 'enrolled') {
      throw conflict('not_enrolled', '참여 중인 챌린지가 아님');
    }
    await this.participation.leave(userId, challengeId);
  }

  /** A105 ChallengeRanking */
  async ranking(userId, challengeId, limit) {
    const ranking = await this.scoring.ranking(userId, challengeId, { limit });
    const entry = (item) => ({
      rankNo: item.rank,
      nickname: item.displayName,
      score: item.score,
      successfulDays: item.successfulDays,
    });
    return {
      challengeId,
      calculatedAt: new Date().toISOString(),
      isFinal: !ranking.provisional,
      myRank: ranking.me ? entry(ranking.me) : null,
      entries: ranking.items.map(entry),
    };
  }

  /** A107 ChallengeResult: 정산이 확정된 뒤의 내 결과 */
  async result(userId, challengeId) {
    const mine = await this.mine(userId, challengeId);
    const { rows } = await this.database.query(
      `SELECT e.rank_no, e.score, e.paid_points, e.promised_points, r.confirmed_at
         FROM challenge_settlement_entries e
         JOIN challenge_settlement_runs r ON r.id = e.run_id AND r.status = 'confirmed'
        WHERE e.participation_id = $1`,
      [mine.participationId],
    );
    const settled = rows[0];
    return {
      challenge: mine.challenge,
      participationId: mine.participationId,
      status: mine.status,
      rankNo: settled?.rank_no ?? null,
      successfulDays: mine.successDays,
      requiredDays: mine.requiredDays,
      rewardPoints: settled
        ? Number(settled.paid_points ?? settled.promised_points)
        : 0,
      settledAt: settled?.confirmed_at ?? null,
    };
  }
}

export { kstDate };
