import { newId } from '../common/ids.js';
import { Dependencies, Injectable } from '@nestjs/common';
import { AdminMutationService } from '../admin-auth/admin-mutation.service.js';
import { rethrowConstraint } from '../common/errors/constraint.js';
import {
  conflict,
  notFound,
  unprocessable,
} from '../common/errors/http-errors.js';
import { DatabaseService } from '../database/database.service.js';

/** 기준 데이터(카테고리·난이도) 테이블, 쿼리에 들어가므로 고정 목록만 사용 */
const CATALOGS = {
  categories: {
    table: 'goal_categories',
    label: '카테고리',
    audit: 'category',
  },
  difficulties: {
    table: 'difficulty_levels',
    label: '난이도',
    audit: 'difficulty',
  },
};

const catalogView = (row) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  displayOrder: row.display_order,
  isActive: row.is_active,
});

/** 카테고리·난이도: 유일하게 수정 가능한 기준 데이터(비활성화 가능, 삭제 없음) */
@Injectable()
@Dependencies(DatabaseService, AdminMutationService)
export class CatalogService {
  constructor(database, mutation) {
    this.database = database;
    this.mutation = mutation;
  }

  // ───────── 카테고리·난이도 ─────────

  async listCatalog(kind) {
    const { rows } = await this.database.query(
      `SELECT id, code, name, display_order, is_active FROM ${CATALOGS[kind].table}
        ORDER BY display_order, code`,
    );
    return rows.map(catalogView);
  }

  createCatalog(adminId, kind, input, key, reason) {
    const { table, label, audit } = CATALOGS[kind];
    return this.mutation.run(adminId, {
      key,
      operation: `${audit}.create`,
      payload: { ...input, reason },
      reason,
      run: async (tx) => {
        const id = newId();
        try {
          await tx.query(
            `INSERT INTO ${table} (id, code, name, display_order) VALUES ($1,$2,$3,$4)`,
            [id, input.code, input.name, input.displayOrder],
          );
        } catch (error) {
          rethrowConstraint(error, {
            [`${table}_code_key`]: () =>
              conflict('code_taken', `이미 쓰는 ${label} 코드`),
            [`${table}_name_key`]: () =>
              conflict('name_taken', `이미 쓰는 ${label} 이름`),
          });
        }
        const result = catalogView(
          (
            await tx.query(
              `SELECT id, code, name, display_order, is_active FROM ${table} WHERE id = $1`,
              [id],
            )
          ).rows[0],
        );
        return { result };
      },
    });
  }

  updateCatalog(adminId, kind, id, patch, key, reason) {
    const { table, label, audit } = CATALOGS[kind];
    return this.mutation.run(adminId, {
      key,
      operation: `${audit}.update`,
      payload: { id, ...patch, reason },
      reason,
      run: async (tx) => {
        const { rows: current } = await tx.query(
          `SELECT id, code, name, display_order, is_active FROM ${table} WHERE id = $1 FOR UPDATE`,
          [id],
        );
        if (!current[0]) {
          throw notFound('catalog_not_found', `${label}를 찾을 수 없음`);
        }
        // 공개 미션 틀이 쓰는 값은 끌 수 없음
        if (patch.isActive === false && current[0].is_active) {
          const column =
            kind === 'categories' ? 'category_id' : 'difficulty_id';
          const { rowCount } = await tx.query(
            `SELECT 1 FROM mission_definitions
              WHERE ${column} = $1 AND publication_status = 'public' AND deleted_at IS NULL LIMIT 1`,
            [id],
          );
          if (rowCount > 0) {
            throw conflict(
              'catalog_in_use',
              `사용 중인 ${label}는 비활성화할 수 없음`,
            );
          }
        }
        try {
          await tx.query(
            `UPDATE ${table}
                SET name = COALESCE($2, name),
                    display_order = COALESCE($3, display_order),
                    is_active = COALESCE($4, is_active),
                    updated_at = now()
              WHERE id = $1`,
            [
              id,
              patch.name ?? null,
              patch.displayOrder ?? null,
              patch.isActive ?? null,
            ],
          );
        } catch (error) {
          rethrowConstraint(error, {
            [`${table}_name_key`]: () =>
              conflict('name_taken', `이미 쓰는 ${label} 이름`),
          });
        }
        const { rows } = await tx.query(
          `SELECT id, code, name, display_order, is_active FROM ${table} WHERE id = $1`,
          [id],
        );
        return {
          before: catalogView(current[0]),
          result: catalogView(rows[0]),
        };
      },
    });
  }

  async assertCatalogRow(tx, kind, id) {
    const { table, label } = CATALOGS[kind];
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
