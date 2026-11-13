import { newId } from '../common/ids.js';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';
import { DatabaseService } from '../database/database.service.js';
import { GoalsService } from '../goals/goals.service.js';
import {
  EDITABLE_STATUSES,
  MAX_DEFINITIONS_PER_USER,
} from './definitions.constants.js';
import { conflict } from '../common/errors/http-errors.js';

const num = (value) => Number(value);

export const definitionNotFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'definition_not_found',
    '미션 원형을 찾을 수 없음',
  );
const badRequest = (message) =>
  new AppException(HttpStatus.BAD_REQUEST, 'bad_request', message);

const COLUMNS = `d.id, d.origin, d.created_by_user_id, d.title, d.description, d.category_id,
  d.difficulty_id, d.estimated_duration_seconds, d.target_value, d.target_unit,
  d.verification_method, d.publication_status, d.created_at, d.updated_at,
  d.exercise_code, d.base_points, d.base_user_xp, d.base_pet_xp`;

// PATCH로 바꿀 수 있는 컬럼(쿼리에 들어가므로 고정 목록만 사용)
const PATCH_COLUMNS = {
  title: 'title',
  description: 'description',
  categoryId: 'category_id',
  difficultyId: 'difficulty_id',
  estimatedDurationSeconds: 'estimated_duration_seconds',
  targetValue: 'target_value',
  targetUnit: 'target_unit',
  verificationMethod: 'verification_method',
};

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const after = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (typeof after.t !== 'string' || typeof after.id !== 'string')
      throw new Error();
    return after;
  } catch {
    throw badRequest('잘못된 cursor');
  }
}

const encodeCursor = (row) =>
  Buffer.from(JSON.stringify({ t: row.created_at_raw, id: row.id })).toString(
    'base64url',
  );

/**
 * 미션 틀 (사용자 쪽)
 * 상태: private → review_pending → public / rejected / hidden
 * 원형의 기본 보상(base_*)은 사용자가 정할 수 없고 항상 0, 보상은 미션 생성 시 보상표에서 확정
 */
@Injectable()
@Dependencies(DatabaseService, GoalsService)
export class DefinitionsService {
  constructor(database, goals) {
    this.database = database;
    this.goals = goals;
  }

  toView(row, { owner = false } = {}) {
    const view = {
      id: row.id,
      origin: row.origin,
      title: row.title,
      description: row.description,
      categoryId: row.category_id,
      difficultyId: row.difficulty_id,
      estimatedDurationSeconds: row.estimated_duration_seconds,
      targetValue: row.target_value === null ? null : num(row.target_value),
      targetUnit: row.target_unit,
      verificationMethod: row.verification_method,
      exerciseCode: row.exercise_code ?? null,
      rewardPreview: row.reward_preview ?? null,
      authorNickname:
        row.origin === 'user' ? (row.author_nickname ?? null) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    // 검수 상태는 작성자에게만 보여 줌
    if (owner) view.publicationStatus = row.publication_status;
    return view;
  }

  async createDefinition(userId, data) {
    if ((data.targetValue === undefined) !== (data.targetUnit === undefined)) {
      throw badRequest('targetValue와 targetUnit은 함께 지정해야 함');
    }
    await this.goals.assertReferences(
      this.database,
      data.categoryId,
      data.difficultyId,
    );

    return this.database.withTransaction(async (tx) => {
      // 같은 사용자의 동시 생성이 상한 검사를 함께 통과하지 못하게 직렬화
      await tx.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const { rows: count } = await tx.query(
        `SELECT count(*) AS n FROM mission_definitions
          WHERE created_by_user_id = $1 AND origin = 'user' AND deleted_at IS NULL`,
        [userId],
      );
      if (num(count[0].n) >= MAX_DEFINITIONS_PER_USER) {
        throw conflict(
          'definition_limit_reached',
          `원형은 최대 ${MAX_DEFINITIONS_PER_USER}개`,
        );
      }

      const { rows } = await tx.query(
        `INSERT INTO mission_definitions
                (id, origin, created_by_user_id, title, description, category_id,
                 difficulty_id, estimated_duration_seconds, target_value, target_unit,
                 verification_method, publication_status)
         VALUES ($1, 'user', $2, $3, $4, $5, $6, $7, $8, $9, $10, 'private')
         RETURNING ${COLUMNS.replaceAll('d.', '')}`,
        [
          newId(),
          userId,
          data.title,
          data.description || null,
          data.categoryId,
          data.difficultyId,
          data.estimatedDurationSeconds ?? null,
          data.targetValue ?? null,
          data.targetUnit ?? null,
          data.verificationMethod,
        ],
      );
      return this.toView(rows[0], { owner: true });
    });
  }

  /** 공개된 원형 탐색(관리자 템플릿 포함), 최신순 커서 */
  async listPublic({
    categoryId,
    difficultyId,
    exerciseCode,
    sort,
    cursor,
    limit,
  }) {
    if (sort === 'duration') {
      return this.listPublicByDuration({
        categoryId,
        difficultyId,
        exerciseCode,
        cursor,
        limit,
      });
    }
    const after = decodeCursor(cursor);
    const { rows } = await this.database.query(
      `SELECT ${COLUMNS}, p.nickname AS author_nickname, d.created_at::text AS created_at_raw
         FROM mission_definitions d
         LEFT JOIN profiles p ON p.user_id = d.created_by_user_id
        WHERE d.publication_status = 'public' AND d.deleted_at IS NULL
          AND ($1::short_id IS NULL OR d.category_id = $1)
          AND ($2::short_id IS NULL OR d.difficulty_id = $2)
          AND ($3::timestamptz IS NULL OR (d.created_at, d.id) < ($3::timestamptz, $4::short_id))
          AND ($6::text IS NULL OR d.exercise_code = $6)
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT $5`,
      [
        categoryId ?? null,
        difficultyId ?? null,
        after?.t ?? null,
        after?.id ?? null,
        limit + 1,
        exerciseCode ?? null,
      ],
    );
    return this.page(rows, limit, false);
  }

  /** sort=duration: 짧은 순(소요 시간이 없는 원형은 맨 뒤), 커서는 (소요 시간, id) */
  async listPublicByDuration({
    categoryId,
    difficultyId,
    exerciseCode,
    cursor,
    limit,
  }) {
    let after = null;
    if (cursor) {
      try {
        after = JSON.parse(Buffer.from(cursor, 'base64url').toString());
        if (typeof after.k !== 'number' || typeof after.id !== 'string') {
          throw new Error();
        }
      } catch {
        throw badRequest('잘못된 cursor');
      }
    }
    const { rows } = await this.database.query(
      `SELECT ${COLUMNS}, p.nickname AS author_nickname,
              COALESCE(d.estimated_duration_seconds, 2147483647) AS duration_key
         FROM mission_definitions d
         LEFT JOIN profiles p ON p.user_id = d.created_by_user_id
        WHERE d.publication_status = 'public' AND d.deleted_at IS NULL
          AND ($1::short_id IS NULL OR d.category_id = $1)
          AND ($2::short_id IS NULL OR d.difficulty_id = $2)
          AND ($3::text IS NULL OR d.exercise_code = $3)
          AND ($4::int IS NULL
               OR (COALESCE(d.estimated_duration_seconds, 2147483647), d.id)
                  > ($4::int, $5::short_id))
        ORDER BY COALESCE(d.estimated_duration_seconds, 2147483647), d.id
        LIMIT $6`,
      [
        categoryId ?? null,
        difficultyId ?? null,
        exerciseCode ?? null,
        after?.k ?? null,
        after?.id ?? null,
        limit + 1,
      ],
    );
    return this.page(rows, limit, false, (row) =>
      Buffer.from(
        JSON.stringify({ k: Number(row.duration_key), id: row.id }),
      ).toString('base64url'),
    );
  }

  /** 내가 만든 원형(삭제 제외), 검수 상태 포함 */
  async listMine(userId, { status, cursor, limit }) {
    const after = decodeCursor(cursor);
    const { rows } = await this.database.query(
      `SELECT ${COLUMNS}, p.nickname AS author_nickname, d.created_at::text AS created_at_raw
         FROM mission_definitions d
         LEFT JOIN profiles p ON p.user_id = d.created_by_user_id
        WHERE d.created_by_user_id = $1 AND d.origin = 'user' AND d.deleted_at IS NULL
          AND ($2::text IS NULL OR d.publication_status = $2)
          AND ($3::timestamptz IS NULL OR (d.created_at, d.id) < ($3::timestamptz, $4::short_id))
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT $5`,
      [userId, status ?? null, after?.t ?? null, after?.id ?? null, limit + 1],
    );
    return this.page(rows, limit, true);
  }

  async page(rows, limit, owner, cursorOf = encodeCursor) {
    const items = rows.slice(0, limit);
    await this.attachRewardPreviews(items);
    return {
      items: items.map((row) => this.toView(row, { owner })),
      nextCursor:
        rows.length > limit ? cursorOf(items[items.length - 1]) : null,
    };
  }

  /**
   * 보상 미리보기: 관리자 원형은 원형의 기본 보상, 그 외는 (분야, 난이도)의 최신 보상표
   * 미션을 만들 때 확정되는 값과 같은 규칙(RewardResolver)
   */
  async attachRewardPreviews(rows) {
    const rated = rows.filter((row) => row.origin !== 'admin');
    const rates = new Map();
    if (rated.length > 0) {
      const { rows: found } = await this.database.query(
        `SELECT DISTINCT ON (category_id, difficulty_id)
                category_id, difficulty_id, points, user_xp, pet_xp
           FROM mission_reward_rate_versions
          WHERE effective_at <= now()
          ORDER BY category_id, difficulty_id, effective_at DESC, version_no DESC`,
      );
      for (const r of found) {
        rates.set(`${r.category_id}:${r.difficulty_id}`, {
          points: num(r.points),
          userXp: num(r.user_xp),
          petXp: num(r.pet_xp),
        });
      }
    }
    for (const row of rows) {
      row.reward_preview =
        row.origin === 'admin'
          ? {
              points: num(row.base_points),
              userXp: num(row.base_user_xp),
              petXp: num(row.base_pet_xp),
            }
          : (rates.get(`${row.category_id}:${row.difficulty_id}`) ?? null);
    }
  }

  /** 여러 원형을 공개 보기(보상 미리보기 포함)로, 요청한 순서대로 */
  async viewsByIds(ids) {
    if (ids.length === 0) return [];
    const { rows } = await this.database.query(
      `SELECT ${COLUMNS}, p.nickname AS author_nickname
         FROM mission_definitions d
         LEFT JOIN profiles p ON p.user_id = d.created_by_user_id
        WHERE d.id = ANY($1::short_id[]) AND d.deleted_at IS NULL`,
      [ids],
    );
    await this.attachRewardPreviews(rows);
    const byId = new Map(rows.map((row) => [row.id, this.toView(row)]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  /**
   * A36 다음에 할 미션 추천 (최대 10)
   * source=interest: 진행 중인 목표의 분야만, ai·all: 관심 분야를 앞에 두고 나머지도 포함
   * 최근 7일 안에 같은 원형으로 만든 미션이 있으면 제외
   */
  async nextMissions(userId, source) {
    const { rows } = await this.database.query(
      `SELECT ${COLUMNS}, p.nickname AS author_nickname,
              d.category_id IN (
                SELECT category_id FROM goals
                 WHERE user_id = $1 AND status = 'active') AS interest
         FROM mission_definitions d
         LEFT JOIN profiles p ON p.user_id = d.created_by_user_id
        WHERE d.publication_status = 'public' AND d.deleted_at IS NULL
          AND NOT EXISTS (
                SELECT 1 FROM missions m
                 WHERE m.user_id = $1 AND m.definition_id = d.id
                   AND m.deleted_at IS NULL AND m.status <> 'cancelled'
                   AND m.scheduled_date >= (now() AT TIME ZONE 'Asia/Seoul')::date - 7)
        ORDER BY interest DESC, d.created_at DESC, d.id DESC
        LIMIT 40`,
      [userId],
    );
    const picked =
      source === 'interest' ? rows.filter((row) => row.interest) : rows;
    const items = picked.slice(0, 10);
    await this.attachRewardPreviews(items);
    return items.map((row) => this.toView(row));
  }

  /** 공개된 원형 또는 내 원형 한 건, 검수 이력(사유 포함)은 작성자에게만 */
  async getDefinition(userId, definitionId) {
    const { rows } = await this.database.query(
      `SELECT ${COLUMNS}, p.nickname AS author_nickname
         FROM mission_definitions d
         LEFT JOIN profiles p ON p.user_id = d.created_by_user_id
        WHERE d.id = $1 AND d.deleted_at IS NULL
          AND (d.publication_status = 'public' OR d.created_by_user_id = $2)`,
      [definitionId, userId],
    );
    if (!rows[0]) throw definitionNotFound();

    await this.attachRewardPreviews([rows[0]]);
    const owner = rows[0].created_by_user_id === userId;
    const view = this.toView(rows[0], { owner });
    if (owner) {
      const { rows: reviews } = await this.database.query(
        `SELECT decision, reason, created_at FROM mission_publication_reviews
          WHERE definition_id = $1 ORDER BY created_at DESC, id DESC`,
        [definitionId],
      );
      view.reviews = reviews.map((r) => ({
        decision: r.decision,
        reason: r.reason,
        createdAt: r.created_at,
      }));
    }
    return view;
  }

  /** 내 원형을 소유자 확인과 함께 잠그고 조회 */
  async lockOwn(tx, userId, definitionId) {
    const { rows } = await tx.query(
      `SELECT ${COLUMNS} FROM mission_definitions d
        WHERE d.id = $1 AND d.created_by_user_id = $2 AND d.origin = 'user'
          AND d.deleted_at IS NULL FOR UPDATE`,
      [definitionId, userId],
    );
    if (!rows[0]) throw definitionNotFound();
    return rows[0];
  }

  /** 수정은 private·rejected일 때만, 검수 중이거나 공개된 내용은 바꿀 수 없음 */
  async updateDefinition(userId, definitionId, patch) {
    const fields = Object.keys(patch).filter((key) => patch[key] !== undefined);
    if (fields.length === 0) throw badRequest('변경할 값이 없음');

    return this.database.withTransaction(async (tx) => {
      const definition = await this.lockOwn(tx, userId, definitionId);
      if (!EDITABLE_STATUSES.includes(definition.publication_status)) {
        throw conflict(
          'definition_locked',
          '검수 중이거나 공개된 원형은 수정할 수 없음',
          {
            status: definition.publication_status,
          },
        );
      }

      const targetValue = patch.targetValue ?? definition.target_value;
      const targetUnit = patch.targetUnit ?? definition.target_unit;
      if ((targetValue === null) !== (targetUnit === null)) {
        throw badRequest('targetValue와 targetUnit은 함께 지정해야 함');
      }
      if (patch.categoryId !== undefined || patch.difficultyId !== undefined) {
        await this.goals.assertReferences(
          tx,
          patch.categoryId ?? definition.category_id,
          patch.difficultyId ?? definition.difficulty_id,
        );
      }

      const assignments = fields.map(
        (key, index) => `${PATCH_COLUMNS[key]} = $${index + 3}`,
      );
      const values = fields.map((key) =>
        key === 'description' && patch[key] === '' ? null : patch[key],
      );
      const { rows } = await tx.query(
        `UPDATE mission_definitions SET ${assignments.join(', ')}, updated_at = now()
          WHERE id = $1 AND created_by_user_id = $2
          RETURNING ${COLUMNS.replaceAll('d.', '')}`,
        [definitionId, userId, ...values],
      );
      return this.toView(rows[0], { owner: true });
    });
  }

  /** 소프트 삭제, 검수 중에는 거절. 이미 쓴 미션은 값을 복사해 갖고 있어 영향 없음 */
  async deleteDefinition(userId, definitionId) {
    await this.database.withTransaction(async (tx) => {
      const definition = await this.lockOwn(tx, userId, definitionId);
      if (definition.publication_status === 'review_pending') {
        throw conflict('definition_locked', '검수 중인 원형은 삭제할 수 없음', {
          status: definition.publication_status,
        });
      }
      await tx.query(
        'UPDATE mission_definitions SET deleted_at = now(), updated_at = now() WHERE id = $1',
        [definitionId],
      );
    });
  }

  /** 공개 검수 신청: private·rejected → review_pending, 제출 이력을 새 행으로 남김 */
  async requestPublication(userId, definitionId) {
    return this.database.withTransaction(async (tx) => {
      const definition = await this.lockOwn(tx, userId, definitionId);
      if (!EDITABLE_STATUSES.includes(definition.publication_status)) {
        throw conflict(
          'invalid_transition',
          '지금은 검수를 신청할 수 없는 상태',
          {
            status: definition.publication_status,
          },
        );
      }
      // 신청 시점에 사용할 수 없는 카테고리·난이도면 공개해도 쓸 수 없으므로 막음
      await this.goals.assertReferences(
        tx,
        definition.category_id,
        definition.difficulty_id,
      );

      const { rows } = await tx.query(
        `UPDATE mission_definitions
            SET publication_status = 'review_pending', updated_at = now()
          WHERE id = $1 RETURNING ${COLUMNS.replaceAll('d.', '')}`,
        [definitionId],
      );
      await tx.query(
        `INSERT INTO mission_publication_reviews
                (id, definition_id, requested_by_user_id, decision)
         VALUES ($1, $2, $3, 'submitted')`,
        [newId(), definitionId, userId],
      );
      return this.toView(rows[0], { owner: true });
    });
  }
}
