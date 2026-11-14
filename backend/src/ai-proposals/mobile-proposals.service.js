import { newId } from '../common/ids.js';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';
import { conflict } from '../common/errors/http-errors.js';
import { kstDate } from '../common/time/kst.js';
import { DatabaseService } from '../database/database.service.js';
import { GoalsService } from '../goals/goals.service.js';
import { MissionsService } from '../missions/missions.service.js';
import { AiClient, AiRequestError } from '../integrations/ai/ai.client.js';
import { toLlmException } from '../integrations/ai/ai-errors.js';
import { buildGoalPlanRequest, toProposalJson } from './plan-request.js';
import { ProposalsService } from './proposals.service.js';
import { buildRulePlan } from './rule-planner.js';

const notFound = (message) =>
  new AppException(HttpStatus.NOT_FOUND, 'not_found', message);

/**
 * 모바일 클라이언트의 계획 제안 API (08 A25~A28, 07 PlanProposal·AcceptPlanResult)
 * 제안 생성: AI 서버(I03) 설정이 있으면 AI, 없으면 규칙 기반 생성기(rule-planner)
 */
@Injectable()
@Dependencies(
  DatabaseService,
  GoalsService,
  MissionsService,
  ProposalsService,
  AiClient,
)
export class MobileProposalsService {
  constructor(database, goals, missions, proposals, ai) {
    this.ai = ai;
    this.database = database;
    this.goals = goals;
    this.missions = missions;
    this.proposals = proposals;
  }

  /** 07 PlanProposal */
  toView(row) {
    const plan = row.proposal_json ?? {};
    return {
      id: row.id,
      goalId: row.goal_id,
      generationNo: row.generation_no,
      status: row.status,
      summary: plan.summary ?? null,
      steps: plan.steps ?? [],
      engineVersion: plan.engineVersion ?? null,
      generatedAt: row.generated_at,
      acceptedAt: row.accepted_at,
    };
  }

  async codeMaps(db) {
    const [categories, difficulties] = await Promise.all([
      db.query('SELECT id, code FROM goal_categories'),
      db.query('SELECT id, code FROM difficulty_levels'),
    ]);
    const maps = (rows) => ({
      byId: new Map(rows.map((r) => [r.id, r.code])),
      byCode: new Map(rows.map((r) => [r.code, r.id])),
    });
    return {
      categories: maps(categories.rows),
      difficulties: maps(difficulties.rows),
    };
  }

  assertGoalOpen(goal) {
    if (goal.status === 'completed') {
      throw conflict('goal_completed', '완료된 목표에는 계획을 만들 수 없음');
    }
    if (goal.status === 'paused') {
      throw conflict('goal_paused', '일시정지된 목표에는 계획을 만들 수 없음');
    }
  }

  /**
   * A25 계획 제안 만들기: 다음 세대의 draft를 한 건 만든다
   * 1) 목표·이전 제안을 읽고 2) 계획을 만들고(AI 설정이 있으면 I03, 없으면 규칙 기반) 3) 트랜잭션으로 저장
   * AI 호출은 트랜잭션 밖에서 하고, AI가 실패하면 규칙 기반으로 바꾸지 않고 오류를 앱에 전달한다(팀 문서 §4.9)
   */
  async generate(userId, goalId) {
    const { categories, difficulties } = await this.codeMaps(this.database);
    const goal = await this.goals.loadGoal(this.database, userId, goalId);
    this.assertGoalOpen(goal);

    const today = kstDate();
    if (goal.end_date < today) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'invalid_period',
        '계획을 세울 남은 기간이 없음',
      );
    }
    const { rows: previous } = await this.database.query(
      `SELECT generation_no, proposal_json->>'summary' AS summary
         FROM ai_plan_proposals WHERE goal_id = $1
        ORDER BY generation_no DESC LIMIT 1`,
      [goalId],
    );
    const categoryCode = categories.byId.get(goal.category_id);
    const difficultyCode = difficulties.byId.get(goal.difficulty_id);

    const plan = this.ai.enabled
      ? await this.planFromAi({
          goal,
          categoryCode,
          difficultyCode,
          today,
          generationNo: (previous[0]?.generation_no ?? 0) + 1,
          previousSummary: previous[0]?.summary ?? null,
        })
      : this.planFromRules({ goal, categoryCode, difficultyCode, today });

    return this.database.withTransaction(async (tx) => {
      await tx.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);
      this.assertGoalOpen(
        await this.goals.loadGoal(tx, userId, goalId, { lock: true }),
      );
      const { rows: last } = await tx.query(
        'SELECT coalesce(max(generation_no), 0) AS n FROM ai_plan_proposals WHERE goal_id = $1',
        [goalId],
      );
      const { rows } = await tx.query(
        `INSERT INTO ai_plan_proposals
                (id, user_id, goal_id, generation_no, proposal_json)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         RETURNING id, goal_id, generation_no, status, proposal_json,
                   generated_at, accepted_at`,
        [newId(), userId, goalId, Number(last[0].n) + 1, JSON.stringify(plan)],
      );
      return this.toView(rows[0]);
    });
  }

  /** I03: POST /llm/goal-plans (동기, 60초) */
  async planFromAi(input) {
    let response;
    try {
      response = await this.ai.post(
        '/llm/goal-plans',
        buildGoalPlanRequest(input),
        { timeoutMs: this.ai.planTimeoutMs },
      );
    } catch (error) {
      if (error instanceof AiRequestError) throw toLlmException(error);
      throw error;
    }
    const plan = toProposalJson(response.body);
    if (!plan) throw toLlmException({ code: 'AI_INVALID_OUTPUT' });
    return plan;
  }

  /** AI 서버가 설정되지 않은 환경(개발)의 규칙 기반 생성 */
  planFromRules({ goal, categoryCode, difficultyCode, today }) {
    const plan = buildRulePlan(
      {
        title: goal.title,
        startDate: goal.start_date,
        endDate: goal.end_date,
        targetFrequency: goal.target_frequency,
        dailyAvailableMinutes: goal.daily_available_minutes,
      },
      { categoryCode, difficultyCode, today },
    );
    if (!plan) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'invalid_period',
        '계획을 세울 남은 기간이 없음',
      );
    }
    return plan;
  }

  /** A26 최신 제안, 없으면 404 */
  async latest(userId, goalId) {
    await this.goals.loadGoal(this.database, userId, goalId);
    const { rows } = await this.database.query(
      `SELECT id, goal_id, generation_no, status, proposal_json, generated_at, accepted_at
         FROM ai_plan_proposals
        WHERE goal_id = $1 AND user_id = $2
        ORDER BY generation_no DESC LIMIT 1`,
      [goalId, userId],
    );
    if (!rows[0]) throw notFound('계획 제안이 없음');
    return this.toView(rows[0]);
  }

  async loadOwned(userId, proposalId) {
    const { rows } = await this.database.query(
      `SELECT id, goal_id, generation_no, status, proposal_json,
              EXISTS (SELECT 1 FROM ai_plan_proposals n
                       WHERE n.goal_id = p.goal_id
                         AND n.generation_no > p.generation_no) AS superseded
         FROM ai_plan_proposals p WHERE id = $1 AND user_id = $2`,
      [proposalId, userId],
    );
    if (!rows[0]) throw notFound('계획 제안을 찾을 수 없음');
    return rows[0];
  }

  /** 앱의 PlanStep[] → 수락 API가 받는 계획 { steps }, code는 ID로 바꾼다 */
  async toPlan(steps) {
    const { categories, difficulties } = await this.codeMaps(this.database);
    return {
      steps: steps.map((step) => ({
        title: step.title,
        description: step.description ?? undefined,
        dueDate: step.dueDate,
        missions: (step.missions ?? []).map((mission) => {
          const out = {
            title: mission.title,
            description: mission.description ?? undefined,
            categoryId:
              mission.categoryId ??
              categories.byCode.get(mission.categoryCode) ??
              undefined,
            difficultyId:
              mission.difficultyId ??
              difficulties.byCode.get(mission.difficultyCode) ??
              undefined,
            exerciseCode: mission.exerciseCode ?? undefined,
            verificationMethod: mission.verificationMethod,
            targetValue: mission.targetValue ?? undefined,
            targetUnit: mission.targetUnit ?? undefined,
            estimatedDurationSeconds:
              mission.estimatedDurationSeconds ?? undefined,
            scheduledDate: mission.scheduledDate,
            isRequired: mission.isRequired ?? undefined,
          };
          return Object.fromEntries(
            Object.entries(out).filter(([, value]) => value !== undefined),
          );
        }),
      })),
    };
  }

  /** A27 수락: generationNo가 최신이 아니면 PLAN_PROPOSAL_OUTDATED */
  async accept(userId, proposalId, { generationNo, steps }, validatePlan) {
    const proposal = await this.loadOwned(userId, proposalId);
    if (proposal.generation_no !== generationNo || proposal.superseded) {
      throw conflict('draft_stale', '더 새로운 제안이 있음', {
        latestGenerationNo: proposal.generation_no,
      });
    }
    const plan = validatePlan(
      await this.toPlan(steps ?? proposal.proposal_json.steps ?? []),
    );
    const result = await this.proposals.acceptProposal(
      userId,
      proposal.goal_id,
      proposalId,
      plan,
    );
    await this.missions.attachChallengeIds(result.missions);
    const today = kstDate();
    return {
      goal: await this.goals.getGoal(userId, proposal.goal_id),
      createdMissionCount: result.missions.length,
      todayMissions: result.missions.filter((m) => m.scheduledDate === today),
    };
  }

  /** A28 거절 */
  async reject(userId, proposalId) {
    const proposal = await this.loadOwned(userId, proposalId);
    await this.proposals.rejectProposal(userId, proposal.goal_id, proposalId);
  }
}
