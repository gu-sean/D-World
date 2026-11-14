import { newId } from '../common/ids.js';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';
import { conflict } from '../common/errors/http-errors.js';
import { kstDate } from '../common/time/kst.js';
import { DatabaseService } from '../database/database.service.js';
import { GoalsService } from '../goals/goals.service.js';
import { MissionsService } from '../missions/missions.service.js';
import { MobileProposalsService } from './mobile-proposals.service.js';
import { ProposalsService } from './proposals.service.js';

const badRequest = (message) =>
  new AppException(HttpStatus.BAD_REQUEST, 'bad_request', message);
const notFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'not_found',
    '재조정 제안을 찾을 수 없음',
  );

const SELECT = `
  SELECT p.id, p.goal_id, g.title AS goal_title, p.status, p.reason, p.proposal_json,
         p.created_at, p.created_at::text AS created_at_raw, p.expires_at, p.decided_at,
         (p.status = 'proposed' AND p.expires_at IS NOT NULL
            AND p.expires_at <= now()) AS lapsed
    FROM plan_adjustment_proposals p
    JOIN goals g ON g.id = p.goal_id AND g.user_id = p.user_id`;

/** 계획 재조정 제안 API (08 A50~A53, 07 PlanAdjustment) */
@Injectable()
@Dependencies(
  DatabaseService,
  GoalsService,
  MissionsService,
  ProposalsService,
  MobileProposalsService,
)
export class PlanAdjustmentsService {
  constructor(database, goals, missions, proposals, mobileProposals) {
    this.database = database;
    this.goals = goals;
    this.missions = missions;
    this.proposals = proposals;
    this.mobileProposals = mobileProposals;
  }

  toView(row) {
    return {
      id: row.id,
      goalId: row.goal_id,
      goalTitle: row.goal_title,
      // 기한이 지난 제안은 저장된 값과 상관없이 expired로 보여 줌
      status: row.lapsed ? 'expired' : row.status,
      reason: row.reason,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      decidedAt: row.decided_at,
      proposedPlan: row.proposal_json?.steps ?? [],
    };
  }

  /** A50 Page<PlanAdjustment>, 최신순 */
  async list(userId, { goalId, statuses, cursor, limit }) {
    let after = null;
    if (cursor) {
      try {
        after = JSON.parse(Buffer.from(cursor, 'base64url').toString());
        if (typeof after.t !== 'string' || typeof after.id !== 'string') {
          throw new Error();
        }
      } catch {
        throw badRequest('잘못된 cursor');
      }
    }
    const { rows } = await this.database.query(
      `${SELECT}
        WHERE p.user_id = $1
          AND ($2::short_id IS NULL OR p.goal_id = $2)
          AND ($3::text[] IS NULL OR p.status = ANY($3::text[]))
          AND ($4::timestamptz IS NULL
               OR (p.created_at, p.id) < ($4::timestamptz, $5::short_id))
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT $6`,
      [
        userId,
        goalId ?? null,
        statuses ?? null,
        after?.t ?? null,
        after?.id ?? null,
        limit + 1,
      ],
    );
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((row) => this.toView(row)),
      nextCursor:
        rows.length > limit
          ? Buffer.from(
              JSON.stringify({ t: last.created_at_raw, id: last.id }),
            ).toString('base64url')
          : null,
    };
  }

  async load(db, userId, id, { lock = false } = {}) {
    const { rows } = await db.query(
      `${SELECT} WHERE p.id = $1 AND p.user_id = $2 ${lock ? 'FOR UPDATE OF p' : ''}`,
      [id, userId],
    );
    if (!rows[0]) throw notFound();
    return rows[0];
  }

  /** A51 */
  async get(userId, id) {
    return this.toView(await this.load(this.database, userId, id));
  }

  assertOpen(row) {
    if (row.status !== 'proposed' || row.lapsed) {
      throw conflict(
        'adjustment_not_open',
        '이미 처리했거나 기간이 지난 제안',
        {
          status: row.lapsed ? 'expired' : row.status,
        },
      );
    }
  }

  /**
   * A52 수락: 제안(또는 사용자가 고친 plan)을 AI 계획으로 적용
   * 계획에 나온 날짜의 시작 전 AI 미션은 취소하고 새로 만든다(ProposalsService.acceptProposal 규칙)
   */
  async accept(userId, id, { plan: edited }, validatePlan) {
    const row = await this.load(this.database, userId, id);
    this.assertOpen(row);
    const steps = edited ?? row.proposal_json?.steps ?? [];
    const plan = validatePlan(await this.mobileProposals.toPlan(steps));

    // 미션의 출처가 되는 계획 제안 행(draft)을 만들고 같은 규칙으로 수락
    const proposalId = newId();
    await this.database.query(
      `INSERT INTO ai_plan_proposals (id, user_id, goal_id, generation_no, proposal_json)
       SELECT $1, $2, $3::short_id, coalesce(max(generation_no), 0) + 1, $4::jsonb
         FROM ai_plan_proposals WHERE goal_id = $3`,
      [
        proposalId,
        userId,
        row.goal_id,
        JSON.stringify({
          summary: row.reason,
          steps,
          engineVersion: 'plan-adjustment',
        }),
      ],
    );
    const result = await this.proposals.acceptProposal(
      userId,
      row.goal_id,
      proposalId,
      plan,
    );

    await this.database.query(
      `UPDATE plan_adjustment_proposals
          SET status = 'accepted', accepted_plan_json = $2::jsonb, decided_at = now()
        WHERE id = $1 AND status = 'proposed'`,
      [id, JSON.stringify(plan)],
    );
    await this.missions.attachChallengeIds(result.missions);
    const today = kstDate();
    return {
      adjustment: await this.get(userId, id),
      goal: await this.goals.getGoal(userId, row.goal_id),
      todayMissions: result.missions.filter((m) => m.scheduledDate === today),
    };
  }

  /** A53 */
  async reject(userId, id) {
    const row = await this.load(this.database, userId, id);
    if (row.status === 'rejected') return;
    this.assertOpen(row);
    await this.database.query(
      `UPDATE plan_adjustment_proposals
          SET status = 'rejected', decided_at = now()
        WHERE id = $1 AND status = 'proposed'`,
      [id],
    );
  }
}
