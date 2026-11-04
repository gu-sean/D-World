import { randomUUID } from 'node:crypto';
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
  d.verification_method, d.publication_status, d.created_at, d.updated_at`;

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
 * 미션 원형 (3-B-3, 사용자 쪽)
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
          randomUUID(),
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
  async listPublic({ categoryId, difficultyId, cursor, limit }) {
    const after = decodeCursor(cursor);
    const { rows } = await this.database.query(
      `SELECT ${COLUMNS}, p.nickname AS author_nickname, d.created_at::text AS created_at_raw
         FROM mission_definitions d
         LEFT JOIN profiles p ON p.user_id = d.created_by_user_id
        WHERE d.publication_status = 'public' AND d.deleted_at IS NULL
          AND ($1::uuid IS NULL OR d.category_id = $1)
          AND ($2::uuid IS NULL OR d.difficulty_id = $2)
          AND ($3::timestamptz IS NULL OR (d.created_at, d.id) < ($3::timestamptz, $4::uuid))
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT $5`,
      [
        categoryId ?? null,
        difficultyId ?? null,
        after?.t ?? null,
        after?.id ?? null,
        limit + 1,
      ],
    );
    return this.page(rows, limit, false);
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
          AND ($3::timestamptz IS NULL OR (d.created_at, d.id) < ($3::timestamptz, $4::uuid))
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT $5`,
      [userId, status ?? null, after?.t ?? null, after?.id ?? null, limit + 1],
    );
    return this.page(rows, limit, true);
  }

  page(rows, limit, owner) {
    const items = rows.slice(0, limit);
    return {
      items: items.map((row) => this.toView(row, { owner })),
      nextCursor:
        rows.length > limit ? encodeCursor(items[items.length - 1]) : null,
    };
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
        [randomUUID(), definitionId, userId],
      );
      return this.toView(rows[0], { owner: true });
    });
  }
}
