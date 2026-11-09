import { randomUUID } from 'node:crypto';
import { Dependencies, Injectable } from '@nestjs/common';
import { AdminMutationService } from '../admin-auth/admin-mutation.service.js';
import { DatabaseService } from '../database/database.service.js';
import {
  lockScope,
  nextVersionNo,
  resolveEffectiveAt,
} from './policy-support.js';
import { CatalogService } from './catalog.service.js';

/** 보상표·판정 기준: 카테고리×난이도 / 카테고리×인증 방식별 추가 전용 버전 */
@Injectable()
@Dependencies(DatabaseService, AdminMutationService, CatalogService)
export class RewardPoliciesService {
  constructor(database, mutation, catalogs) {
    this.database = database;
    this.mutation = mutation;
    this.catalogs = catalogs;
  }

  // ───────── 보상표 ─────────

  async listRewardRates({ categoryId, difficultyId, limit }) {
    const { rows } = await this.database.query(
      `SELECT id, category_id, difficulty_id, version_no, points, user_xp, pet_xp, effective_at
         FROM mission_reward_rate_versions
        WHERE ($1::uuid IS NULL OR category_id = $1) AND ($2::uuid IS NULL OR difficulty_id = $2)
        ORDER BY effective_at DESC, version_no DESC LIMIT $3`,
      [categoryId ?? null, difficultyId ?? null, limit],
    );
    return {
      items: rows.map((row) => ({
        id: row.id,
        categoryId: row.category_id,
        difficultyId: row.difficulty_id,
        versionNo: row.version_no,
        points: row.points,
        userXp: row.user_xp,
        petXp: row.pet_xp,
        effectiveAt: row.effective_at,
      })),
    };
  }

  createRewardRate(adminId, input, key) {
    return this.mutation.run(adminId, {
      key,
      operation: 'reward_rate.create',
      payload: input,
      reason: input.reason,
      run: async (tx) => {
        await this.catalogs.assertCatalogRow(
          tx,
          'categories',
          input.categoryId,
        );
        await this.catalogs.assertCatalogRow(
          tx,
          'difficulties',
          input.difficultyId,
        );
        await lockScope(tx, `reward:${input.categoryId}:${input.difficultyId}`);
        const effectiveAt = await resolveEffectiveAt(tx, input.effectiveAt);
        const versionNo = await nextVersionNo(
          tx,
          'mission_reward_rate_versions',
          'WHERE category_id = $1 AND difficulty_id = $2',
          [input.categoryId, input.difficultyId],
        );
        const id = randomUUID();
        await tx.query(
          `INSERT INTO mission_reward_rate_versions
                  (id, category_id, difficulty_id, version_no, points, user_xp, pet_xp,
                   effective_at, created_by_admin_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            id,
            input.categoryId,
            input.difficultyId,
            versionNo,
            input.points,
            input.userXp,
            input.petXp,
            effectiveAt,
            adminId,
          ],
        );
        return {
          result: {
            id,
            categoryId: input.categoryId,
            difficultyId: input.difficultyId,
            versionNo,
            points: input.points,
            userXp: input.userXp,
            petXp: input.petXp,
            effectiveAt,
          },
        };
      },
    });
  }

  // ───────── 판정 기준 ─────────

  async listCriteria({ categoryId, verificationMethod, limit }) {
    const { rows } = await this.database.query(
      `SELECT id, category_id, verification_method, version_no, rules_json, effective_at
         FROM verification_criteria_versions
        WHERE ($1::uuid IS NULL OR category_id = $1)
          AND ($2::text IS NULL OR verification_method = $2)
        ORDER BY effective_at DESC, version_no DESC LIMIT $3`,
      [categoryId ?? null, verificationMethod ?? null, limit],
    );
    return {
      items: rows.map((row) => ({
        id: row.id,
        categoryId: row.category_id,
        verificationMethod: row.verification_method,
        versionNo: row.version_no,
        rules: row.rules_json,
        effectiveAt: row.effective_at,
      })),
    };
  }

  createCriteria(adminId, input, key) {
    return this.mutation.run(adminId, {
      key,
      operation: 'criteria.create',
      payload: input,
      reason: input.reason,
      run: async (tx) => {
        await this.catalogs.assertCatalogRow(
          tx,
          'categories',
          input.categoryId,
        );
        await lockScope(
          tx,
          `criteria:${input.categoryId}:${input.verificationMethod}`,
        );
        const effectiveAt = await resolveEffectiveAt(tx, input.effectiveAt);
        const versionNo = await nextVersionNo(
          tx,
          'verification_criteria_versions',
          'WHERE category_id = $1 AND verification_method = $2',
          [input.categoryId, input.verificationMethod],
        );
        const id = randomUUID();
        await tx.query(
          `INSERT INTO verification_criteria_versions
                  (id, category_id, verification_method, version_no, rules_json,
                   effective_at, created_by_admin_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            id,
            input.categoryId,
            input.verificationMethod,
            versionNo,
            JSON.stringify(input.rules),
            effectiveAt,
            adminId,
          ],
        );
        return {
          result: {
            id,
            categoryId: input.categoryId,
            verificationMethod: input.verificationMethod,
            versionNo,
            rules: input.rules,
            effectiveAt,
          },
        };
      },
    });
  }
}
