import { randomUUID } from 'node:crypto';
import { Dependencies, Injectable } from '@nestjs/common';
import { AdminMutationService } from '../admin-auth/admin-mutation.service.js';
import { rethrowConstraint } from '../common/errors/constraint.js';
import { conflict, unprocessable } from '../common/errors/http-errors.js';
import { DatabaseService } from '../database/database.service.js';
import {
  lockScope,
  nextVersionNo,
  resolveEffectiveAt,
} from './policy-support.js';

/** 사용자·펫 레벨 정책 테이블 쌍 */
const LEVEL_POLICIES = {
  'user-levels': {
    policies: 'user_level_policy_versions',
    thresholds: 'user_level_thresholds',
    label: '사용자 레벨',
  },
  'pet-levels': {
    policies: 'pet_level_policy_versions',
    thresholds: 'pet_level_thresholds',
    label: '펫 레벨',
  },
};

/** 스트릭 마일스톤 금액·월간 포인트 한도·레벨 정책(추가 전용 버전) */
@Injectable()
@Dependencies(DatabaseService, AdminMutationService)
export class GrowthPoliciesService {
  constructor(database, mutation) {
    this.database = database;
    this.mutation = mutation;
  }

  // ───────── 스트릭 마일스톤 금액 ─────────

  async listStreakMilestones() {
    const { rows } = await this.database.query(
      `SELECT id, target_success_days, version_no, points, user_xp, pet_xp, effective_at
         FROM streak_milestone_policy_versions
        ORDER BY target_success_days, effective_at DESC, version_no DESC`,
    );
    return {
      items: rows.map((row) => ({
        id: row.id,
        targetSuccessDays: row.target_success_days,
        versionNo: row.version_no,
        points: row.points,
        userXp: row.user_xp,
        petXp: row.pet_xp,
        effectiveAt: row.effective_at,
      })),
    };
  }

  createStreakMilestone(adminId, input, key) {
    return this.mutation.run(adminId, {
      key,
      operation: 'streak_policy.create',
      payload: input,
      reason: input.reason,
      run: async (tx) => {
        await lockScope(tx, `streak:${input.targetDays}`);
        const effectiveAt = await resolveEffectiveAt(tx, input.effectiveAt);
        const versionNo = await nextVersionNo(
          tx,
          'streak_milestone_policy_versions',
          'WHERE target_success_days = $1',
          [input.targetDays],
        );
        const id = randomUUID();
        await tx.query(
          `INSERT INTO streak_milestone_policy_versions
                  (id, target_success_days, version_no, points, user_xp, pet_xp,
                   effective_at, created_by_admin_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            id,
            input.targetDays,
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
            targetSuccessDays: input.targetDays,
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

  // ───────── 월간 포인트 한도 ─────────

  async listMonthlyCaps() {
    const { rows } = await this.database.query(
      `SELECT id, effective_month::text AS effective_month, monthly_limit_points
         FROM point_monthly_cap_policies ORDER BY effective_month DESC`,
    );
    return {
      items: rows.map((row) => ({
        id: row.id,
        effectiveMonth: row.effective_month,
        monthlyLimitPoints: row.monthly_limit_points,
      })),
    };
  }

  createMonthlyCap(adminId, input, key) {
    return this.mutation.run(adminId, {
      key,
      operation: 'point_cap.create',
      payload: input,
      reason: input.reason,
      run: async (tx) => {
        await lockScope(tx, 'monthly-cap');
        const { rows: month } = await tx.query(
          `SELECT date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date::text AS current`,
        );
        if (input.effectiveMonth <= month[0].current) {
          throw unprocessable(
            'effective_month_not_future',
            '월간 한도는 다음 달 이후부터 시행할 수 있음',
            { currentMonth: month[0].current },
          );
        }
        const id = randomUUID();
        try {
          await tx.query(
            `INSERT INTO point_monthly_cap_policies
                    (id, effective_month, monthly_limit_points, created_by_admin_id)
             VALUES ($1,$2,$3,$4)`,
            [id, input.effectiveMonth, input.limitPoints, adminId],
          );
        } catch (error) {
          rethrowConstraint(error, {
            point_monthly_cap_policies_effective_month_key: () =>
              conflict('policy_exists', '그 달에 이미 시행 예정인 한도가 있음'),
          });
        }
        return {
          result: {
            id,
            effectiveMonth: input.effectiveMonth,
            monthlyLimitPoints: input.limitPoints,
          },
        };
      },
    });
  }

  // ───────── 사용자·펫 레벨 정책 ─────────

  async listLevelPolicies(kind) {
    const { policies, thresholds } = LEVEL_POLICIES[kind];
    const { rows } = await this.database.query(
      `SELECT p.id, p.version_no, p.effective_at,
              (SELECT json_agg(json_build_object('levelNo', t.level_no,
                                                 'minTotalXp', t.min_total_xp::bigint)
                               ORDER BY t.level_no)
                 FROM ${thresholds} t WHERE t.policy_version_id = p.id) AS thresholds
         FROM ${policies} p ORDER BY p.effective_at DESC, p.version_no DESC`,
    );
    return {
      items: rows.map((row) => ({
        id: row.id,
        versionNo: row.version_no,
        effectiveAt: row.effective_at,
        thresholds: row.thresholds ?? [],
      })),
    };
  }

  createLevelPolicy(adminId, kind, input, key) {
    const { policies, thresholds, label } = LEVEL_POLICIES[kind];
    return this.mutation.run(adminId, {
      key,
      operation: `policy.${kind}.create`,
      payload: input,
      run: async (tx) => {
        const sorted = this.sortedThresholds(label, input.thresholds);
        await lockScope(tx, kind);
        const effectiveAt = await resolveEffectiveAt(tx, input.effectiveAt);
        const versionNo = await nextVersionNo(tx, policies, '', []);
        const id = randomUUID();
        await tx.query(
          `INSERT INTO ${policies} (id, version_no, effective_at, created_by_admin_id)
           VALUES ($1,$2,$3,$4)`,
          [id, versionNo, effectiveAt, adminId],
        );
        for (const row of sorted) {
          await tx.query(
            `INSERT INTO ${thresholds} (policy_version_id, level_no, min_total_xp)
             VALUES ($1,$2,$3)`,
            [id, row.levelNo, row.minTotalXp],
          );
        }
        return {
          result: { id, versionNo, effectiveAt, thresholds: sorted },
        };
      },
    });
  }

  /** 1레벨부터 빠짐없이, 1레벨은 0 XP, 임곗값은 엄격히 증가 (DB 트리거와 같은 규칙을 먼저 안내) */
  sortedThresholds(label, thresholds) {
    const sorted = [...thresholds].sort((a, b) => a.levelNo - b.levelNo);
    sorted.forEach((row, index) => {
      if (row.levelNo !== index + 1) {
        throw unprocessable(
          'invalid_thresholds',
          `${label} 단계는 1부터 빠짐없이 이어져야 함`,
        );
      }
      if (index === 0 && row.minTotalXp !== 0) {
        throw unprocessable(
          'invalid_thresholds',
          '1레벨의 필요 누적 XP는 0이어야 함',
        );
      }
      if (index > 0 && row.minTotalXp <= sorted[index - 1].minTotalXp) {
        throw unprocessable(
          'invalid_thresholds',
          '필요 누적 XP는 레벨이 오를수록 커져야 함',
        );
      }
    });
    return sorted;
  }
}
