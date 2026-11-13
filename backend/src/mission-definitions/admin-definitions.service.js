import { newId } from '../common/ids.js';
import { Dependencies, Injectable } from '@nestjs/common';
import { AdminMutationService } from '../admin-auth/admin-mutation.service.js';
import {
  conflict,
  notFound,
  unprocessable,
} from '../common/errors/http-errors.js';
import { DatabaseService } from '../database/database.service.js';
import {
  ADMIN_DEFINITION_SELECT,
  adminDefinitionView,
} from './definition-review.service.js';

const definitionNotFound = () =>
  notFound('definition_not_found', '미션 틀을 찾을 수 없음');

// 컬럼 매핑(입력 키 → 컬럼), 고정 목록이라 쿼리에 그대로 쓸 수 있음
const COLUMNS = {
  title: 'title',
  description: 'description',
  categoryId: 'category_id',
  difficultyId: 'difficulty_id',
  exerciseCode: 'exercise_code',
  verificationMethod: 'verification_method',
  targetValue: 'target_value',
  targetUnit: 'target_unit',
  estimatedDurationSeconds: 'estimated_duration_seconds',
  publicationStatus: 'publication_status',
};

/**
 * 관리자 미션 틀 등록·수정·조회 (M40, M41, M43)
 * 관리자 틀은 origin='admin'이고 작성 사용자가 없음. 이미 만들어진 미션은 생성 때 값을 복사해 두므로 영향 없음
 */
@Injectable()
@Dependencies(DatabaseService, AdminMutationService)
export class AdminDefinitionsService {
  constructor(database, mutation) {
    this.database = database;
    this.mutation = mutation;
  }

  async get(definitionId) {
    const { rows } = await this.database.query(
      `${ADMIN_DEFINITION_SELECT} WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [definitionId],
    );
    if (!rows[0]) throw definitionNotFound();
    return adminDefinitionView(rows[0]);
  }

  /** 운동 종류와 인증 방식 정합성(달리기만 센서) */
  assertExerciseMethod(exerciseCode, method) {
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

  async assertActiveCatalog(tx, categoryId, difficultyId) {
    for (const [table, id, label] of [
      ['goal_categories', categoryId, '분야'],
      ['difficulty_levels', difficultyId, '난이도'],
    ]) {
      if (id === undefined) continue;
      const { rows } = await tx.query(
        `SELECT is_active FROM ${table} WHERE id = $1`,
        [id],
      );
      if (!rows[0])
        throw notFound('catalog_not_found', `${label}를 찾을 수 없음`);
      if (!rows[0].is_active) {
        throw unprocessable('catalog_inactive', `비활성 ${label}`);
      }
    }
  }

  /** M40 */
  create(adminId, input, key, reason) {
    return this.mutation.run(adminId, {
      key,
      operation: 'mission_definition.create',
      payload: { ...input, reason },
      reason,
      run: async (tx) => {
        if (
          (input.targetValue === undefined) !==
          (input.targetUnit === undefined)
        ) {
          throw unprocessable(
            'target_pair_required',
            'targetValue와 targetUnit은 함께 지정해야 함',
          );
        }
        this.assertExerciseMethod(input.exerciseCode, input.verificationMethod);
        await this.assertActiveCatalog(
          tx,
          input.categoryId,
          input.difficultyId,
        );

        const id = newId();
        await tx.query(
          `INSERT INTO mission_definitions
                  (id, origin, title, description, category_id, difficulty_id, exercise_code,
                   verification_method, target_value, target_unit, estimated_duration_seconds,
                   publication_status)
           VALUES ($1, 'admin', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            id,
            input.title,
            input.description || null,
            input.categoryId,
            input.difficultyId,
            input.exerciseCode ?? null,
            input.verificationMethod,
            input.targetValue ?? null,
            input.targetUnit ?? null,
            input.estimatedDurationSeconds ?? null,
            input.publicationStatus,
          ],
        );
        const { rows } = await tx.query(
          `${ADMIN_DEFINITION_SELECT} WHERE d.id = $1`,
          [id],
        );
        return { result: adminDefinitionView(rows[0]) };
      },
    });
  }

  /** M41: 보낸 필드만 바꿈 */
  update(adminId, definitionId, patch, key, reason) {
    return this.mutation.run(adminId, {
      key,
      operation: 'mission_definition.update',
      payload: { definitionId, ...patch, reason },
      reason,
      run: async (tx) => {
        const { rows } = await tx.query(
          `SELECT id, origin, title, description, category_id, difficulty_id, exercise_code,
                  verification_method, target_value, target_unit, estimated_duration_seconds,
                  publication_status
             FROM mission_definitions
            WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [definitionId],
        );
        const current = rows[0];
        if (!current) throw definitionNotFound();
        if (current.origin !== 'admin') {
          throw conflict(
            'not_admin_definition',
            '사용자가 만든 미션 틀은 검수만 할 수 있음',
          );
        }

        const next = {
          exerciseCode: current.exercise_code,
          verificationMethod: current.verification_method,
          targetValue:
            current.target_value === null ? null : Number(current.target_value),
          targetUnit: current.target_unit,
          ...patch,
        };
        if ((next.targetValue === null) !== (next.targetUnit === null)) {
          throw unprocessable(
            'target_pair_required',
            'targetValue와 targetUnit은 함께 지정해야 함',
          );
        }
        this.assertExerciseMethod(next.exerciseCode, next.verificationMethod);
        await this.assertActiveCatalog(
          tx,
          patch.categoryId,
          patch.difficultyId,
        );

        const sets = [];
        const params = [definitionId];
        for (const [field, column] of Object.entries(COLUMNS)) {
          if (!(field in patch)) continue;
          params.push(
            field === 'description' ? patch.description || null : patch[field],
          );
          sets.push(`${column} = $${params.length}`);
        }
        await tx.query(
          `UPDATE mission_definitions SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`,
          params,
        );

        const { rows: after } = await tx.query(
          `${ADMIN_DEFINITION_SELECT} WHERE d.id = $1`,
          [definitionId],
        );
        const before = Object.fromEntries(
          Object.keys(patch).map((field) => [
            field,
            current[COLUMNS[field]] ?? null,
          ]),
        );
        return {
          before,
          after: patch,
          result: adminDefinitionView(after[0]),
        };
      },
    });
  }
}
