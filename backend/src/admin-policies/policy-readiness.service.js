import { Dependencies, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

/** 서비스 시작 전 설정해야 하는 정책이 모두 시행 중인지 확인 */
@Injectable()
@Dependencies(DatabaseService)
export class PolicyReadinessService {
  constructor(database) {
    this.database = database;
  }

  // ───────── 서비스 시작 준비 상태 ─────────

  /** 정책 문서가 "서비스 시작 전 설정 필요"라고 정한 항목이 모두 시행 중인지 */
  async readiness() {
    const count = async (sql) =>
      Number((await this.database.query(sql)).rows[0].n);
    const items = [
      {
        key: 'monthly_cap',
        label: '월간 포인트 한도',
        ok:
          (await count(
            `SELECT count(*) AS n FROM point_monthly_cap_policies
              WHERE effective_month <= date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date`,
          )) > 0,
      },
      {
        key: 'user_levels',
        label: '사용자 레벨 정책',
        ok:
          (await count(
            'SELECT count(*) AS n FROM user_level_policy_versions WHERE effective_at <= now()',
          )) > 0,
      },
      {
        key: 'pet_levels',
        label: '펫 레벨 정책',
        ok:
          (await count(
            'SELECT count(*) AS n FROM pet_level_policy_versions WHERE effective_at <= now()',
          )) > 0,
      },
      {
        key: 'reward_rates',
        label: '카테고리·난이도 조합별 보상표',
        ok:
          (await count(`
            SELECT count(*) AS n FROM goal_categories c CROSS JOIN difficulty_levels d
             WHERE c.is_active AND d.is_active AND NOT EXISTS (
               SELECT 1 FROM mission_reward_rate_versions r
                WHERE r.category_id = c.id AND r.difficulty_id = d.id AND r.effective_at <= now())`)) ===
          0,
      },
      {
        key: 'criteria',
        label: '카테고리·인증 방식별 판정 기준',
        ok:
          (await count(`
            SELECT count(*) AS n FROM goal_categories c CROSS JOIN (VALUES ('camera'), ('sensor')) AS m(method)
             WHERE c.is_active AND NOT EXISTS (
               SELECT 1 FROM verification_criteria_versions v
                WHERE v.category_id = c.id AND v.verification_method = m.method AND v.effective_at <= now())`)) ===
          0,
      },
    ];
    for (const target of [7, 30, 100]) {
      items.push({
        key: `streak_${target}`,
        label: `스트릭 ${target}일 마일스톤 금액`,
        ok:
          (await count(
            `SELECT count(*) AS n FROM streak_milestone_policy_versions
              WHERE target_success_days = ${target} AND effective_at <= now()`,
          )) > 0,
      });
    }
    return { ready: items.every((item) => item.ok), items };
  }
}
