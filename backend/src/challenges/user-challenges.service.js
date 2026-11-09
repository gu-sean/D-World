import { randomUUID } from 'node:crypto';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from '../admin-auth/audit.service.js';
import { AdminIdempotencyService } from '../common/idempotency/admin-idempotency.service.js';
import { DatabaseService } from '../database/database.service.js';
import { MAX_OPEN_CREATED } from './challenges.constants.js';
import { ChallengesService, SELECT, toView } from './challenges.service.js';
import { conflict, httpError } from '../common/errors/http-errors.js';
import { TODAY_SQL } from '../common/time/kst-sql.js';

const notFound = () =>
  httpError(
    HttpStatus.NOT_FOUND,
    'challenge_not_found',
    '챌린지를 찾을 수 없음',
  );
const startNotFuture = (today) =>
  httpError(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'start_date_not_future',
    '시작일이 내일 이후여야 함(일정을 고쳐 다시 제출)',
    { today },
  );

/**
 * 사용자 개설 챌린지와 공개 검수 (정책 15)
 * - 개설자: 초안 작성·수정 → 검수 신청. 승인 전에는 탐색·참여 대상 아님
 * - 보상(포인트·XP·배지) 항상 0, 개설자도 일반 참가자와 같은 규칙으로 참여
 * - 관리자는 승인(공개)·반려(사유 필수)하고, 공개 후 숨김은 사유를 남긴다. 승인·반려·숨김 이력은
 *   challenge_publication_reviews에 기록. 반려된 챌린지는 수정 후 재제출 가능
 */
@Injectable()
@Dependencies(
  DatabaseService,
  AuditService,
  AdminIdempotencyService,
  ChallengesService,
)
export class UserChallengesService {
  constructor(database, audit, idempotency, challenges) {
    this.database = database;
    this.audit = audit;
    this.idempotency = idempotency;
    this.challenges = challenges;
  }

  async view(db, id) {
    const { rows } = await db.query(`${SELECT} WHERE c.id = $1`, [id]);
    return toView(rows[0]);
  }

  /** 내 챌린지 잠금 조회: 소유자가 아니면 404 */
  async lockMine(tx, userId, id) {
    const { rows } = await tx.query(
      `SELECT id, title, description, category_id, difficulty_id, verification_method,
              exercise_code, target_value, target_unit, estimated_duration_seconds,
              start_date::text AS start_date, end_date::text AS end_date,
              required_success_days, max_participants, publication_status,
              ${TODAY_SQL}::text AS today
         FROM challenges WHERE id = $1 AND origin = 'user' AND created_by_user_id = $2
        FOR UPDATE`,
      [id, userId],
    );
    if (!rows[0]) throw notFound();
    return rows[0];
  }

  async createDraft(userId, input) {
    return this.database.withTransaction(async (tx) => {
      const duration = this.challenges.assertPeriod(
        input.startDate,
        input.endDate,
        input.requiredSuccessDays,
      );
      this.challenges.assertExercise(
        input.exerciseCode,
        input.verificationMethod,
      );
      await this.challenges.assertRefs(tx, input);

      // 남용 방지: 사용자 단위로 직렬화한 뒤 미완료 개설 챌린지 수를 확인
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `challenge-create:${userId}`,
      ]);
      const { rows: open } = await tx.query(
        `SELECT count(*)::int AS n FROM challenges
          WHERE origin = 'user' AND created_by_user_id = $1
            AND (publication_status IN ('draft', 'review_pending', 'rejected')
                 OR (publication_status = 'public' AND end_date >= ${TODAY_SQL}))`,
        [userId],
      );
      if (open[0].n >= MAX_OPEN_CREATED) {
        throw conflict(
          'creation_limit_reached',
          `동시에 만들 수 있는 챌린지는 ${MAX_OPEN_CREATED}개까지`,
          { limit: MAX_OPEN_CREATED },
        );
      }

      const id = randomUUID();
      await tx.query(
        `INSERT INTO challenges
                (id, origin, created_by_user_id, title, description, category_id, difficulty_id,
                 verification_method, exercise_code, target_value, target_unit,
                 estimated_duration_seconds, start_date, end_date, required_success_days,
                 max_participants)
         VALUES ($1,'user',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          id,
          userId,
          input.title,
          input.description,
          input.categoryId,
          input.difficultyId,
          input.verificationMethod,
          input.exerciseCode ?? null,
          input.targetValue ?? null,
          input.targetUnit ?? null,
          input.estimatedDurationSeconds ?? null,
          input.startDate,
          input.endDate,
          input.requiredSuccessDays ?? duration,
          input.maxParticipants ?? null,
        ],
      );
      // 사용자 개설 챌린지 보상은 DB 트리거가 0으로 강제
      await tx.query(
        'INSERT INTO challenge_reward_packages (challenge_id) VALUES ($1)',
        [id],
      );
      return this.view(tx, id);
    });
  }

  /** 초안·반려 상태에서만 수정(참가자 없음 → DB 잠금 대상 아님) */
  async update(userId, id, patch) {
    return this.database.withTransaction(async (tx) => {
      const current = await this.lockMine(tx, userId, id);
      if (!['draft', 'rejected'].includes(current.publication_status)) {
        throw conflict(
          'challenge_not_editable',
          '초안이나 반려된 챌린지만 수정할 수 있음',
          { status: current.publication_status },
        );
      }
      const next = {
        title: patch.title ?? current.title,
        description: patch.description ?? current.description,
        categoryId: patch.categoryId ?? current.category_id,
        difficultyId: patch.difficultyId ?? current.difficulty_id,
        verificationMethod:
          patch.verificationMethod ?? current.verification_method,
        exerciseCode:
          patch.exerciseCode === undefined
            ? current.exercise_code
            : patch.exerciseCode,
        startDate: patch.startDate ?? current.start_date,
        endDate: patch.endDate ?? current.end_date,
        maxParticipants:
          patch.maxParticipants === undefined
            ? current.max_participants
            : patch.maxParticipants,
      };
      const duration = this.challenges.assertPeriod(
        next.startDate,
        next.endDate,
      );
      const requiredSuccessDays =
        patch.requiredSuccessDays ??
        Math.min(current.required_success_days, duration);
      this.challenges.assertPeriod(
        next.startDate,
        next.endDate,
        requiredSuccessDays,
      );
      this.challenges.assertExercise(
        next.exerciseCode,
        next.verificationMethod,
      );
      await this.challenges.assertRefs(tx, next);

      await tx.query(
        `UPDATE challenges
            SET title = $2, description = $3, category_id = $4, difficulty_id = $5,
                verification_method = $6, exercise_code = $7, start_date = $8, end_date = $9,
                required_success_days = $10, max_participants = $11, target_value = $12,
                target_unit = $13, estimated_duration_seconds = $14, updated_at = now()
          WHERE id = $1`,
        [
          id,
          next.title,
          next.description,
          next.categoryId,
          next.difficultyId,
          next.verificationMethod,
          next.exerciseCode,
          next.startDate,
          next.endDate,
          requiredSuccessDays,
          next.maxParticipants,
          patch.targetValue === undefined
            ? current.target_value
            : patch.targetValue,
          patch.targetUnit === undefined
            ? current.target_unit
            : patch.targetUnit,
          patch.estimatedDurationSeconds === undefined
            ? current.estimated_duration_seconds
            : patch.estimatedDurationSeconds,
        ],
      );
      return this.view(tx, id);
    });
  }

  /** 검수 신청: 초안·반려 → review_pending, 시작일은 내일 이후 */
  async submit(userId, id) {
    return this.database.withTransaction(async (tx) => {
      const current = await this.lockMine(tx, userId, id);
      if (current.publication_status === 'review_pending') {
        return this.view(tx, id); // 이미 신청함
      }
      if (!['draft', 'rejected'].includes(current.publication_status)) {
        throw conflict(
          'challenge_not_submittable',
          '검수를 신청할 수 없는 상태',
          {
            status: current.publication_status,
          },
        );
      }
      if (current.start_date <= current.today)
        throw startNotFuture(current.today);
      await tx.query(
        `UPDATE challenges SET publication_status = 'review_pending', updated_at = now() WHERE id = $1`,
        [id],
      );
      await tx.query(
        `INSERT INTO challenge_publication_reviews (id, challenge_id, requested_by_user_id, decision)
         VALUES ($1,$2,$3,'submitted')`,
        [randomUUID(), id, userId],
      );
      return this.view(tx, id);
    });
  }

  /** 내가 만든 챌린지(모든 상태)와 마지막 검수 결과 */
  async listMine(userId, { limit }) {
    const { rows } = await this.database.query(
      `${SELECT}
        WHERE c.origin = 'user' AND c.created_by_user_id = $1
        ORDER BY c.created_at DESC, c.id LIMIT $2`,
      [userId, limit],
    );
    const reviews = await this.database.query(
      `SELECT DISTINCT ON (challenge_id) challenge_id, decision, reason, created_at
         FROM challenge_publication_reviews
        WHERE challenge_id = ANY($1::uuid[]) AND decision <> 'submitted'
        ORDER BY challenge_id, created_at DESC`,
      [rows.map((row) => row.id)],
    );
    const byId = new Map(reviews.rows.map((r) => [r.challenge_id, r]));
    return {
      items: rows.map((row) => {
        const review = byId.get(row.id);
        return {
          ...toView(row),
          lastReview: review
            ? {
                decision: review.decision,
                reason: review.reason,
                at: review.created_at,
              }
            : null,
        };
      }),
    };
  }

  // ───────── 관리자 검수 ─────────

  /** 승인(공개) 또는 반려(사유 필수). 대기 중인 사용자 개설 챌린지만 */
  review(adminId, id, { decision, reason }, key) {
    return this.idempotency.run(
      adminId,
      { key, operation: 'challenge.review', payload: { id, decision, reason } },
      async (tx) => {
        const { rows } = await tx.query(
          `SELECT id, origin, created_by_user_id, publication_status, start_date::text AS start_date,
                  ${TODAY_SQL}::text AS today
             FROM challenges WHERE id = $1 FOR UPDATE`,
          [id],
        );
        const current = rows[0];
        if (!current) throw notFound();
        if (current.origin !== 'user') {
          throw conflict('not_user_challenge', '사용자 개설 챌린지만 검수함');
        }
        if (current.publication_status !== 'review_pending') {
          throw conflict('challenge_not_pending', '검수 대기 상태가 아님', {
            status: current.publication_status,
          });
        }
        if (decision === 'approve') {
          if (current.start_date <= current.today)
            throw startNotFuture(current.today);
          await tx.query(
            `UPDATE challenges SET publication_status = 'public', published_at = now(), updated_at = now()
              WHERE id = $1`,
            [id],
          );
          await tx.query(
            `INSERT INTO challenge_rule_events (id, challenge_id, admin_id, event_type, reason)
             VALUES ($1,$2,$3,'published',$4)`,
            [randomUUID(), id, adminId, reason ?? '검수 승인'],
          );
        } else {
          await tx.query(
            `UPDATE challenges SET publication_status = 'rejected', updated_at = now() WHERE id = $1`,
            [id],
          );
        }
        await tx.query(
          `INSERT INTO challenge_publication_reviews
                  (id, challenge_id, reviewed_by_admin_id, decision, reason)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            randomUUID(),
            id,
            adminId,
            decision === 'approve' ? 'approved' : 'rejected',
            reason ?? null,
          ],
        );
        const result = await this.view(tx, id);
        await this.audit.record(tx, {
          adminId,
          targetUserId: current.created_by_user_id,
          action: 'challenge.review',
          result: 'success',
          reason,
          before: { status: 'review_pending' },
          after: { decision, status: result.publicationStatus },
        });
        return result;
      },
    );
  }
}
