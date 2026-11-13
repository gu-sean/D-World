import { newId } from '../common/ids.js';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AdminMutationService } from '../admin-auth/admin-mutation.service.js';
import { adminPage } from '../common/pagination/admin-page.js';
import { AppException } from '../common/errors/app-exception.js';
import { DatabaseService } from '../database/database.service.js';
import { DURATIONS } from './challenges.constants.js';
import { conflict, unprocessable } from '../common/errors/http-errors.js';
import { TODAY_SQL } from '../common/time/kst-sql.js';

const notFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'challenge_not_found',
    '챌린지를 찾을 수 없음',
  );

export const SELECT = `
  SELECT c.id, c.origin, c.title, c.description, c.category_id, c.difficulty_id,
         c.verification_method, c.exercise_code, c.target_value, c.target_unit,
         c.estimated_duration_seconds, c.start_date::text AS start_date,
         c.end_date::text AS end_date, c.required_success_days, c.max_participants,
         c.publication_status, c.settlement_status, c.published_at, c.cancelled_at,
         p.points, p.user_xp, p.pet_xp, p.badge_achievement_version_id,
         (SELECT pf.nickname FROM profiles pf WHERE pf.user_id = c.created_by_user_id) AS creator_nickname,
         (SELECT count(*) FROM challenge_participations cp
           WHERE cp.challenge_id = c.id AND cp.status IN ('enrolled', 'completed', 'failed')
         )::int AS participant_count,
         CASE WHEN ${TODAY_SQL} < c.start_date THEN 'recruiting'
              WHEN ${TODAY_SQL} <= c.end_date THEN 'ongoing'
              ELSE 'ended' END AS phase
    FROM challenges c
    LEFT JOIN challenge_reward_packages p ON p.challenge_id = c.id`;

const periodDaysOf = (start, end) =>
  Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
      86_400_000,
  ) + 1;

export function toView(row) {
  return {
    id: row.id,
    origin: row.origin,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    difficultyId: row.difficulty_id,
    verificationMethod: row.verification_method,
    exerciseCode: row.exercise_code,
    targetValue: row.target_value === null ? null : Number(row.target_value),
    targetUnit: row.target_unit,
    estimatedDurationSeconds: row.estimated_duration_seconds,
    startDate: row.start_date,
    endDate: row.end_date,
    requiredSuccessDays: row.required_success_days,
    maxParticipants: row.max_participants,
    publicationStatus: row.publication_status,
    settlementStatus: row.settlement_status,
    phase: row.phase,
    publishedAt: row.published_at,
    cancelledAt: row.cancelled_at,
    creatorNickname: row.creator_nickname ?? null,
    participantCount: row.participant_count,
    reward: {
      points: row.points ?? 0,
      userXp: row.user_xp ?? 0,
      petXp: row.pet_xp ?? 0,
      badgeAchievementVersionId: row.badge_achievement_version_id ?? null,
    },
    // 모바일 클라이언트(07 Challenge) 키
    periodDays: periodDaysOf(row.start_date, row.end_date),
    capacity: row.max_participants,
    completionRateRequired: Number(
      (
        row.required_success_days / periodDaysOf(row.start_date, row.end_date)
      ).toFixed(4),
    ),
    rewardPoints: row.points ?? 0,
    joined: false,
  };
}

function encodeCursor(row) {
  return Buffer.from(
    JSON.stringify({ d: row.start_date, id: row.id }),
  ).toString('base64url');
}
function decodeCursor(cursor) {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (typeof value.d !== 'string' || typeof value.id !== 'string') {
      throw new Error();
    }
    return value;
  } catch {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      'bad_request',
      '잘못된 cursor',
    );
  }
}

/**
 * 챌린지 정의·공개
 * - 관리자 공식 챌린지의 생성·수정·공개·숨김(createOfficial 등)과 사용자 조회(목록·상세)를 맡는다.
 * - 사용자 개설·검수는 UserChallengesService, 모바일 응답 조립은 MobileChallengesService.
 * - 첫 참가자 이후 기간·조건·보상은 DB 트리거가 잠금 → 수정은 참가자 없는 draft/public만 성공
 */
@Injectable()
@Dependencies(DatabaseService, AdminMutationService)
export class ChallengesService {
  constructor(database, mutation) {
    this.database = database;
    this.mutation = mutation;
  }

  // ───────── 사용자 조회 ─────────

  /** 공개된 챌린지 목록(시작일 순). 내 참가 상태를 함께 반환 */
  async listPublic(userId, { phase, categoryId, cursor, limit }) {
    const after = cursor ? decodeCursor(cursor) : null;
    const { rows } = await this.database.query(
      `${SELECT}
        WHERE c.publication_status = 'public'
          AND ($1::text IS NULL OR (CASE WHEN ${TODAY_SQL} < c.start_date THEN 'recruiting'
                 WHEN ${TODAY_SQL} <= c.end_date THEN 'ongoing' ELSE 'ended' END) = $1)
          AND ($2::short_id IS NULL OR c.category_id = $2)
          AND ($3::date IS NULL OR (c.start_date, c.id) > ($3::date, $4::short_id))
        ORDER BY c.start_date, c.id
        LIMIT $5`,
      [
        phase ?? null,
        categoryId ?? null,
        after?.d ?? null,
        after?.id ?? null,
        limit + 1,
      ],
    );
    const page = rows.slice(0, limit);
    const mine = await this.myParticipations(
      userId,
      page.map((r) => r.id),
    );
    return {
      items: page.map((row) => ({
        ...toView(row),
        joined: mine.get(row.id)?.status === 'enrolled',
        myParticipation: mine.get(row.id) ?? null,
      })),
      nextCursor:
        rows.length > limit ? encodeCursor(page[page.length - 1]) : null,
    };
  }

  async myParticipations(userId, challengeIds) {
    if (challengeIds.length === 0) return new Map();
    const { rows } = await this.database.query(
      `SELECT id, challenge_id, status FROM challenge_participations
        WHERE user_id = $1 AND challenge_id = ANY($2::short_id[])`,
      [userId, challengeIds],
    );
    return new Map(
      rows.map((row) => [row.challenge_id, { id: row.id, status: row.status }]),
    );
  }

  async getPublic(userId, id) {
    const { rows } = await this.database.query(
      `${SELECT} WHERE c.id = $1 AND c.publication_status = 'public'`,
      [id],
    );
    if (!rows[0]) throw notFound();
    const mine = await this.myParticipations(userId, [id]);
    return {
      ...toView(rows[0]),
      joined: mine.get(id)?.status === 'enrolled',
      myParticipation: mine.get(id) ?? null,
    };
  }

  // ───────── 관리자 ─────────

  /** M53 관리자 목록(AdminPage): 공개 상태·정산 상태·단계·분야·출처 필터, 시작일 순 */
  async listAdmin({
    publicationStatus,
    settlementStatus,
    phase,
    categoryId,
    origin,
    paging,
  }) {
    const params = [
      publicationStatus ?? null,
      settlementStatus ?? null,
      phase ?? null,
      categoryId ?? null,
      origin ?? null,
    ];
    const where = `($1::text IS NULL OR publication_status = $1)
          AND ($2::text IS NULL OR settlement_status = $2)
          AND ($3::text IS NULL OR phase = $3)
          AND ($4::short_id IS NULL OR category_id = $4)
          AND ($5::text IS NULL OR origin = $5)`;
    const [{ rows }, count] = await Promise.all([
      this.database.query(
        `SELECT * FROM (${SELECT}) c
          WHERE ${where}
          ORDER BY ${paging.orderBy}
          LIMIT $6 OFFSET $7`,
        [...params, paging.size, paging.offset],
      ),
      this.database.query(
        `SELECT count(*) AS n FROM (${SELECT}) c WHERE ${where}`,
        params,
      ),
    ]);
    return adminPage(rows.map(toView), paging, count.rows[0].n);
  }

  async getAdmin(id) {
    const { rows } = await this.database.query(`${SELECT} WHERE c.id = $1`, [
      id,
    ]);
    if (!rows[0]) throw notFound();
    return toView(rows[0]);
  }

  assertPeriod(startDate, endDate, requiredSuccessDays) {
    const duration =
      (Date.parse(`${endDate}T00:00:00Z`) -
        Date.parse(`${startDate}T00:00:00Z`)) /
        86_400_000 +
      1;
    if (!DURATIONS.includes(duration)) {
      throw unprocessable(
        'invalid_period',
        `기간은 ${DURATIONS.join('·')}일 중 하나여야 함(양 끝 포함)`,
        { duration },
      );
    }
    if (requiredSuccessDays !== undefined && requiredSuccessDays > duration) {
      throw unprocessable(
        'invalid_required_days',
        '완주 필요 일수는 기간 일수를 넘을 수 없음',
        { duration },
      );
    }
    return duration;
  }

  assertExercise(exerciseCode, method) {
    if (
      exerciseCode &&
      (exerciseCode === 'running') !== (method === 'sensor')
    ) {
      throw unprocessable(
        'exercise_method_mismatch',
        '달리기는 센서, 나머지 운동은 카메라 인증만 가능',
      );
    }
  }

  async assertRefs(tx, input) {
    const { rows: category } = await tx.query(
      'SELECT is_active FROM goal_categories WHERE id = $1',
      [input.categoryId],
    );
    const { rows: difficulty } = await tx.query(
      'SELECT is_active FROM difficulty_levels WHERE id = $1',
      [input.difficultyId],
    );
    if (!category[0] || !difficulty[0]) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'catalog_not_found',
        '카테고리 또는 난이도를 찾을 수 없음',
      );
    }
    if (!category[0].is_active || !difficulty[0].is_active) {
      throw unprocessable('catalog_inactive', '비활성 카테고리 또는 난이도');
    }
  }

  badgeError(error) {
    if (error?.code === '23514' && /badge/i.test(error.message)) {
      return unprocessable(
        'invalid_badge',
        '배지는 보상이 0인 챌린지 완주 업적 버전이어야 함',
      );
    }
    return error;
  }

  createOfficial(adminId, input, key, reason) {
    return this.mutation.run(adminId, {
      key,
      operation: 'challenge.create',
      payload: input,
      reason,
      run: async (tx) => {
        const duration = this.assertPeriod(
          input.startDate,
          input.endDate,
          input.requiredSuccessDays,
        );
        this.assertExercise(input.exerciseCode, input.verificationMethod);
        await this.assertRefs(tx, input);

        const id = newId();
        try {
          await tx.query(
            `INSERT INTO challenges
                    (id, origin, created_by_admin_id, title, description, category_id,
                     difficulty_id, verification_method, exercise_code, target_value, target_unit,
                     estimated_duration_seconds, start_date, end_date, required_success_days,
                     max_participants)
             VALUES ($1,'admin',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            [
              id,
              adminId,
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
          await tx.query(
            `INSERT INTO challenge_reward_packages
                    (challenge_id, points, user_xp, pet_xp, badge_achievement_version_id)
             VALUES ($1,$2,$3,$4,$5)`,
            [
              id,
              input.reward.points,
              input.reward.userXp,
              input.reward.petXp,
              input.reward.badgeAchievementVersionId ?? null,
            ],
          );
        } catch (error) {
          throw this.badgeError(error);
        }
        const { rows } = await tx.query(`${SELECT} WHERE c.id = $1`, [id]);
        return { result: toView(rows[0]) };
      },
    });
  }

  /** 참가자가 없는 draft·public 챌린지의 정의 수정, 참가자가 생긴 뒤는 DB가 거절 */
  updateOfficial(adminId, id, patch, key, reason) {
    return this.mutation.run(adminId, {
      key,
      reason,
      operation: 'challenge.update',
      payload: { id, ...patch },
      run: async (tx) => {
        const current = await this.lockOfficial(tx, id);
        if (!['draft', 'public'].includes(current.publication_status)) {
          throw conflict('challenge_not_editable', '수정할 수 없는 상태', {
            status: current.publication_status,
          });
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
        const duration = this.assertPeriod(next.startDate, next.endDate);
        const requiredSuccessDays =
          patch.requiredSuccessDays ??
          (patch.startDate || patch.endDate
            ? Math.min(current.required_success_days, duration)
            : current.required_success_days);
        this.assertPeriod(next.startDate, next.endDate, requiredSuccessDays);
        this.assertExercise(next.exerciseCode, next.verificationMethod);
        await this.assertRefs(tx, next);

        const before = toView(
          (await tx.query(`${SELECT} WHERE c.id = $1`, [id])).rows[0],
        );
        try {
          await tx.query(
            `UPDATE challenges
                SET title = $2, description = $3, category_id = $4, difficulty_id = $5,
                    verification_method = $6, exercise_code = $7, start_date = $8,
                    end_date = $9, required_success_days = $10, max_participants = $11,
                    target_value = $12, target_unit = $13,
                    estimated_duration_seconds = $14, updated_at = now()
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
          if (patch.reward) {
            await tx.query(
              `UPDATE challenge_reward_packages
                  SET points = $2, user_xp = $3, pet_xp = $4, badge_achievement_version_id = $5
                WHERE challenge_id = $1`,
              [
                id,
                patch.reward.points,
                patch.reward.userXp,
                patch.reward.petXp,
                patch.reward.badgeAchievementVersionId ?? null,
              ],
            );
          }
        } catch (error) {
          if (
            error?.code === '23514' &&
            /locked after first enrollment/.test(error.message)
          ) {
            throw conflict(
              'challenge_locked',
              '첫 참가자가 생긴 뒤에는 기간·조건·보상을 바꿀 수 없음(취소 후 새로 등록)',
            );
          }
          throw this.badgeError(error);
        }
        const after = toView(
          (await tx.query(`${SELECT} WHERE c.id = $1`, [id])).rows[0],
        );
        return { before, result: after };
      },
    });
  }

  /** 공개: 시작일이 미래여야 함(DB 트리거도 검사), 게시 시각은 불변 */
  publish(adminId, id, key, reason) {
    return this.mutation.run(adminId, {
      key,
      reason,
      operation: 'challenge.update',
      payload: { id },
      run: async (tx) => {
        const current = await this.lockOfficial(tx, id);
        if (current.publication_status !== 'draft') {
          throw conflict('challenge_not_draft', '초안 상태만 공개할 수 있음', {
            status: current.publication_status,
          });
        }
        const { rows: today } = await tx.query(
          `SELECT ${TODAY_SQL}::text AS today`,
        );
        if (current.start_date <= today[0].today) {
          throw unprocessable(
            'start_date_not_future',
            '시작일이 내일 이후여야 공개할 수 있음',
            { today: today[0].today },
          );
        }
        await tx.query(
          `UPDATE challenges SET publication_status = 'public', published_at = now(), updated_at = now()
            WHERE id = $1`,
          [id],
        );
        await tx.query(
          `INSERT INTO challenge_rule_events (id, challenge_id, admin_id, event_type, reason)
           VALUES ($1,$2,$3,'published','공개')`,
          [newId(), id, adminId],
        );
        const { rows } = await tx.query(`${SELECT} WHERE c.id = $1`, [id]);
        return { result: toView(rows[0]) };
      },
    });
  }

  /** 숨김: 공개 챌린지를 목록에서 내림(참가자 데이터는 유지) */
  hide(adminId, id, reason, key) {
    return this.mutation.run(adminId, {
      key,
      reason,
      operation: 'challenge.update',
      payload: { id, reason },
      run: async (tx) => {
        const current = await this.lockOfficial(tx, id, { anyOrigin: true });
        if (current.publication_status !== 'public') {
          throw conflict('challenge_not_public', '공개 상태만 숨길 수 있음', {
            status: current.publication_status,
          });
        }
        await tx.query(
          `UPDATE challenges SET publication_status = 'hidden', updated_at = now() WHERE id = $1`,
          [id],
        );
        await tx.query(
          `INSERT INTO challenge_rule_events (id, challenge_id, admin_id, event_type, reason)
           VALUES ($1,$2,$3,'hidden',$4)`,
          [newId(), id, adminId, reason],
        );
        if (current.origin === 'user') {
          await tx.query(
            `INSERT INTO challenge_publication_reviews
                    (id, challenge_id, reviewed_by_admin_id, decision, reason)
             VALUES ($1,$2,$3,'hidden',$4)`,
            [newId(), id, adminId, reason],
          );
        }
        const { rows } = await tx.query(`${SELECT} WHERE c.id = $1`, [id]);
        return { result: toView(rows[0]) };
      },
    });
  }

  async lockOfficial(tx, id, { anyOrigin = false } = {}) {
    const { rows } = await tx.query(
      `SELECT id, origin, title, description, category_id, difficulty_id, verification_method,
              exercise_code, target_value, target_unit, estimated_duration_seconds,
              start_date::text AS start_date, end_date::text AS end_date,
              required_success_days, max_participants, publication_status
         FROM challenges WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!rows[0]) throw notFound();
    if (!anyOrigin && rows[0].origin !== 'admin') {
      throw conflict(
        'not_official',
        '사용자 개설 챌린지는 검수 API로 처리함(공식 챌린지만 직접 수정·공개)',
      );
    }
    return rows[0];
  }
}
