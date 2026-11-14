import { randomUUID } from 'node:crypto';
import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';
import { stableStringify } from '../common/idempotency/admin-idempotency.service.js';
import { DatabaseService } from '../database/database.service.js';
import { GoalsService } from '../goals/goals.service.js';
import { MAX_STEPS_PER_GOAL } from '../goals/goals.constants.js';
import { StepsService } from '../goals/steps.service.js';
import { MissionsService } from '../missions/missions.service.js';
import { RewardResolver } from '../missions/reward-resolver.js';
import { assessDifficulty } from '../missions/difficulty-rules.js';
import { addDays, kstDayStart } from '../common/time/kst.js';
import {
  MAX_PLAN_MISSIONS,
  PROPOSAL_EXPIRY_DAYS,
} from './proposals.constants.js';
import { conflict } from '../common/errors/http-errors.js';

const num = (value) => Number(value);

const proposalNotFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    'proposal_not_found',
    'AI 제안을 찾을 수 없음',
  );
const badRequest = (message) =>
  new AppException(HttpStatus.BAD_REQUEST, 'bad_request', message);
const notOpen = (status) =>
  conflict('proposal_not_open', '수락하거나 거절할 수 없는 제안', { status });

const defaultDueAt = (date) => kstDayStart(addDays(date, 1)).toISOString();

/**
 * AI 계획 제안 수락·거절·만료
 * 제안 생성은 AI 쪽(AiResultsModule)이 ai_plan_proposals에 draft로 넣고, 여기서는 사용자가 확인·수정한
 * 계획을 받아 단계·미션 생성. 원안(proposal_json) 보존, 확정안은 accepted_plan_json에 저장
 */
@Injectable()
@Dependencies(
  DatabaseService,
  GoalsService,
  StepsService,
  MissionsService,
  RewardResolver,
)
export class ProposalsService {
  constructor(database, goals, steps, missions, rewards) {
    this.database = database;
    this.goals = goals;
    this.steps = steps;
    this.missions = missions;
    this.rewards = rewards;
  }

  toView(row) {
    const draft = row.status === 'draft';
    return {
      id: row.id,
      goalId: row.goal_id,
      generationNo: row.generation_no,
      status: row.status,
      proposal: row.proposal_json,
      acceptedPlan: row.accepted_plan_json,
      generatedAt: row.generated_at,
      acceptedAt: row.accepted_at,
      expiresAt: draft
        ? new Date(
            new Date(row.generated_at).getTime() +
              PROPOSAL_EXPIRY_DAYS * 86_400_000,
          ).toISOString()
        : null,
    };
  }

  /** 목표별 제안 목록, 최신 생성순 커서 */
  async listProposals(userId, goalId, { status, cursor, limit }) {
    await this.goals.loadGoal(this.database, userId, goalId);

    let after = null;
    if (cursor) {
      try {
        after = JSON.parse(Buffer.from(cursor, 'base64url').toString());
        if (typeof after.t !== 'string' || typeof after.id !== 'string')
          throw new Error();
      } catch {
        throw badRequest('잘못된 cursor');
      }
    }
    const { rows } = await this.database.query(
      `SELECT id, goal_id, generation_no, status, proposal_json, accepted_plan_json,
              generated_at, accepted_at, generated_at::text AS generated_at_raw
         FROM ai_plan_proposals
        WHERE goal_id = $1 AND user_id = $2
          AND ($3::text IS NULL OR status = $3)
          AND ($4::timestamptz IS NULL OR (generated_at, id) < ($4::timestamptz, $5::uuid))
        ORDER BY generated_at DESC, id DESC
        LIMIT $6`,
      [
        goalId,
        userId,
        status ?? null,
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
              JSON.stringify({ t: last.generated_at_raw, id: last.id }),
            ).toString('base64url')
          : null,
    };
  }

  async lockProposal(tx, userId, goalId, proposalId) {
    const { rows } = await tx.query(
      `SELECT id, goal_id, generation_no, status, proposal_json, accepted_plan_json,
              generated_at, accepted_at,
              generated_at < now() - make_interval(days => $4) AS stale
         FROM ai_plan_proposals
        WHERE id = $1 AND goal_id = $2 AND user_id = $3 FOR UPDATE`,
      [proposalId, goalId, userId, PROPOSAL_EXPIRY_DAYS],
    );
    if (!rows[0]) throw proposalNotFound();
    return rows[0];
  }

  /**
   * 확정한 계획으로 단계·미션을 한 트랜잭션에 생성
   * - 같은 계획으로 다시 수락하면 만든 결과를 그대로 돌려주고, 다른 계획이면 거절
   * - 계획에 포함된 날짜의 시작 전 AI 미션은 취소(ai_regenerated)하고 새로 만든다(재생성)
   *   시작·완료한 미션, 직접 추가한 미션은 유지
   */
  async acceptProposal(userId, goalId, proposalId, plan) {
    return this.database.withTransaction(async (tx) => {
      // 사용자 행 → 목표 행 → 제안 행 순서로 잠금(미션 생성과 같은 순서)
      await tx.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const goal = await this.goals.loadGoal(tx, userId, goalId, {
        lock: true,
      });
      const proposal = await this.lockProposal(tx, userId, goalId, proposalId);

      if (proposal.status === 'accepted') {
        if (
          stableStringify(proposal.accepted_plan_json) === stableStringify(plan)
        ) {
          return this.acceptedResult(tx, userId, proposal);
        }
        throw notOpen(proposal.status);
      }
      if (proposal.status !== 'draft') throw notOpen(proposal.status);
      if (proposal.stale) throw notOpen('expired');

      if (goal.status === 'completed') {
        throw conflict(
          'goal_completed',
          '완료된 목표에는 계획을 적용할 수 없음',
        );
      }
      if (goal.status === 'paused') {
        throw conflict(
          'goal_paused',
          '일시정지된 목표에는 계획을 적용할 수 없음',
        );
      }

      const planSteps = plan.steps ?? [];
      const entries = [
        ...planSteps.flatMap((step, stepIndex) =>
          (step.missions ?? []).map((mission) => ({ mission, stepIndex })),
        ),
        ...(plan.missions ?? []).map((mission) => ({
          mission,
          stepIndex: null,
        })),
      ];
      if (entries.length === 0) throw badRequest('계획에 미션이 하나도 없음');
      if (entries.length > MAX_PLAN_MISSIONS) {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'plan_too_large',
          `한 번에 적용할 수 있는 미션은 최대 ${MAX_PLAN_MISSIONS}개`,
        );
      }

      const { rows: stepInfo } = await tx.query(
        `SELECT count(*) AS n, coalesce(max(step_no), 0) AS last FROM goal_steps WHERE goal_id = $1`,
        [goalId],
      );
      if (num(stepInfo[0].n) + planSteps.length > MAX_STEPS_PER_GOAL) {
        throw conflict(
          'step_limit_reached',
          `단계는 목표당 최대 ${MAX_STEPS_PER_GOAL}개`,
        );
      }
      for (const step of planSteps)
        this.steps.assertDueDate(goal, step.dueDate);

      // 미션마다 값을 확정하고 규칙을 검증
      // 분야는 생략하면 목표의 값, 난이도는 AI·사용자 값이 아니라 미션 내용으로 규칙 판정 (보상은 미션마다)
      const resolved = [];
      const checkedPairs = new Set();
      for (const { mission, stepIndex } of entries) {
        const categoryId = mission.categoryId ?? goal.category_id;
        const difficultyId = await this.missions.difficultyIdOf(
          tx,
          assessDifficulty(mission).difficultyCode,
        );
        if (
          (mission.targetValue === undefined) !==
          (mission.targetUnit === undefined)
        ) {
          throw badRequest('targetValue와 targetUnit은 함께 지정해야 함');
        }
        const pair = `${categoryId}:${difficultyId}`;
        if (!checkedPairs.has(pair)) {
          await this.goals.assertReferences(tx, categoryId, difficultyId);
          checkedPairs.add(pair);
        }
        this.missions.assertDates([mission.scheduledDate], goal);
        if (mission.dueAt !== undefined)
          this.missions.assertDueAt(mission.dueAt, mission.scheduledDate);
        resolved.push({ mission, stepIndex, categoryId, difficultyId });
      }

      // 이 시점부터 제안이 accepted여야 AI 미션을 만들 수 있음(DB 트리거가 검증)
      await tx.query(
        `UPDATE ai_plan_proposals
            SET status = 'accepted', accepted_plan_json = $2::jsonb, accepted_at = now()
          WHERE id = $1`,
        [proposalId, JSON.stringify(plan)],
      );

      // 재생성: 계획에 나온 날짜의 시작 전 AI 미션만 취소
      const dates = [
        ...new Set(entries.map((entry) => entry.mission.scheduledDate)),
      ];
      const { rows: cancelled } = await tx.query(
        `UPDATE missions
            SET status = 'cancelled', cancel_reason = 'ai_regenerated',
                cancelled_at = now(), updated_at = now()
          WHERE user_id = $1 AND goal_id = $2 AND source_type = 'ai'
            AND status = 'scheduled' AND deleted_at IS NULL
            AND scheduled_date = ANY($3::date[])
          RETURNING goal_step_id`,
        [userId, goalId, dates],
      );

      // 취소한 미션을 뺀 뒤의 하루 상한
      const counts = new Map();
      for (const { mission } of entries) {
        counts.set(
          mission.scheduledDate,
          (counts.get(mission.scheduledDate) ?? 0) + 1,
        );
      }
      await this.missions.assertCapacityCounts(tx, userId, counts);

      let stepNo = num(stepInfo[0].last);
      const createdSteps = [];
      for (const step of planSteps) {
        stepNo += 1;
        const { rows } = await tx.query(
          `INSERT INTO goal_steps (id, goal_id, step_no, title, description, due_date)
           VALUES ($6, $1, $2, $3, $4, $5)
           RETURNING id, goal_id, step_no, title, description, due_date, status, completed_at`,
          [
            goalId,
            stepNo,
            step.title,
            step.description || null,
            step.dueDate,
            randomUUID(),
          ],
        );
        createdSteps.push(rows[0]);
      }

      // 보상은 (카테고리, 난이도) 조합마다 한 번만 구해 복사
      const rewardCache = new Map();
      const createdMissions = [];
      for (const { mission, stepIndex, categoryId, difficultyId } of resolved) {
        const pair = `${categoryId}:${difficultyId}`;
        if (!rewardCache.has(pair)) {
          rewardCache.set(
            pair,
            await this.rewards.resolve(tx, { categoryId, difficultyId }),
          );
        }
        createdMissions.push(
          await this.missions.insertMissionRow(tx, userId, {
            goalId,
            stepId: stepIndex === null ? null : createdSteps[stepIndex].id,
            sourceType: 'ai',
            sourceProposalId: proposalId,
            title: mission.title,
            description: mission.description || null,
            categoryId,
            difficultyId,
            targetValue: mission.targetValue,
            targetUnit: mission.targetUnit,
            estimatedDurationSeconds: mission.estimatedDurationSeconds,
            verificationMethod: mission.verificationMethod,
            exerciseCode: mission.exerciseCode ?? null,
            scheduledDate: mission.scheduledDate,
            dueAt: mission.dueAt ?? defaultDueAt(mission.scheduledDate),
            isRequired: mission.isRequired ?? true,
            memo: mission.memo || null,
            reward: rewardCache.get(pair),
          }),
        );
      }

      // 새 단계, 그리고 미션을 잃은 이전 단계의 자동 완료 조건을 다시 평가
      const affected = new Set([
        ...createdSteps.map((s) => s.id),
        ...cancelled.map((c) => c.goal_step_id).filter(Boolean),
      ]);
      for (const stepId of affected)
        await this.goals.reevaluateStep(tx, stepId);

      const acceptedAt = (
        await tx.query(
          'SELECT accepted_at FROM ai_plan_proposals WHERE id = $1',
          [proposalId],
        )
      ).rows[0].accepted_at;
      return {
        proposalId,
        status: 'accepted',
        acceptedAt,
        steps: createdSteps.map((s) => this.steps.toView(s)),
        missions: createdMissions,
      };
    });
  }

  /** 이미 수락한 제안의 결과: 그 제안으로 만든 미션과 그 미션이 속한 단계 */
  async acceptedResult(tx, userId, proposal) {
    const missions = await this.missions.listByProposal(
      tx,
      userId,
      proposal.id,
    );
    const stepIds = [...new Set(missions.map((m) => m.stepId).filter(Boolean))];
    const { rows: stepRows } = await tx.query(
      `SELECT id, goal_id, step_no, title, description, due_date, status, completed_at
         FROM goal_steps WHERE id = ANY($1::uuid[]) ORDER BY step_no`,
      [stepIds],
    );
    return {
      proposalId: proposal.id,
      status: 'accepted',
      acceptedAt: proposal.accepted_at,
      steps: stepRows.map((s) => this.steps.toView(s)),
      missions,
    };
  }

  /** 거절: draft만 가능, 이미 거절한 제안을 다시 거절하면 같은 결과 */
  async rejectProposal(userId, goalId, proposalId) {
    return this.database.withTransaction(async (tx) => {
      await this.goals.loadGoal(tx, userId, goalId);
      const proposal = await this.lockProposal(tx, userId, goalId, proposalId);
      if (proposal.status === 'rejected')
        return { id: proposalId, status: 'rejected' };
      if (proposal.status !== 'draft') throw notOpen(proposal.status);
      await tx.query(
        `UPDATE ai_plan_proposals SET status = 'rejected' WHERE id = $1`,
        [proposalId],
      );
      return { id: proposalId, status: 'rejected' };
    });
  }

  /** 만료 작업: 생성 후 PROPOSAL_EXPIRY_DAYS가 지난 draft를 expired로, JobsModule의 매일 작업이 호출 */
  async expireStale({ limit = 500 } = {}) {
    const { rowCount } = await this.database.query(
      `UPDATE ai_plan_proposals SET status = 'expired'
        WHERE id IN (
          SELECT id FROM ai_plan_proposals
           WHERE status = 'draft' AND generated_at < now() - make_interval(days => $1)
           ORDER BY generated_at LIMIT $2)`,
      [PROPOSAL_EXPIRY_DAYS, limit],
    );
    return { expired: rowCount };
  }
}
