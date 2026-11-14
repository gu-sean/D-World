import { newId } from '../common/ids.js';
import {
  BadRequestException,
  Dependencies,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';
import { kstDate } from '../common/time/kst.js';
import { DatabaseService } from '../database/database.service.js';
import { EXERCISE_TYPES } from '../goals/exercise-types.js';
import { AiClient, AiRequestError } from '../integrations/ai/ai.client.js';
import { createSystemNotification } from '../notices/system-notification.js';
import {
  adjustmentCauses,
  adjustmentKey,
  consecutiveMissedDays,
  parseAdjustmentKey,
  pickWorstGoal,
  toPlanSteps,
} from './adjustment-input.js';
import { lastWeek, rateOf } from './periods.js';

/**
 * 재조정 요청 경로 (AI 서버의 I06 라우터가 아직 없어 llm 라우터 규칙을 따라 정한 값, AI 쪽과 확정 필요)
 * 요청은 202로 접수되고 결과는 콜백(POST /internal/v1/ai-callbacks/plan-adjustments)으로 온다
 */
export const AI_ADJUSTMENT_PATH = '/llm/plan-adjustments';
/** 결과가 이 시간 안에 오지 않으면 실패로 닫는다 (팀 문서 §4.9) */
const RESULT_WAIT_MINUTES = 30;
const PROPOSAL_VALID_DAYS = 7;
const MAX_SEND_ATTEMPTS = 5;

const notFound = (message) =>
  new AppException(HttpStatus.NOT_FOUND, 'run_not_found', message);

/**
 * 주간 계획 재조정 (I06)
 * 지난주 결과가 나빴던 회원마다 목표 하나를 골라 AI에 재조정을 요청하고,
 * 결과는 plan_adjustment_proposals(proposed)로 저장해 앱의 재조정 제안(A50~A53)에 나타낸다.
 */
@Injectable()
@Dependencies(DatabaseService, AiClient)
export class PlanAdjustmentRunsService {
  logger = new Logger(PlanAdjustmentRunsService.name);
  attempts = new Map(); // runId → 보내려 한 횟수

  constructor(database, ai) {
    this.database = database;
    this.ai = ai;
  }

  async dispatchDue({ limit = 50, today = kstDate() } = {}) {
    if (!this.ai.enabled) return { skipped: true };
    const result = { created: 0, sent: 0, failed: 0, expired: 0 };
    result.expired =
      (await this.expireStale()) + (await this.expireProposals());
    result.created = await this.createRuns(lastWeek(today), today, limit);
    await this.sendRequested(result, today, limit);
    return result;
  }

  /** 지난주 실행이 없는 회원 중 재조정이 필요한 회원의 실행을 만든다 */
  async createRuns(period, today, limit) {
    const { rows } = await this.database.query(
      `SELECT g.id AS goal_id, g.user_id,
              g.start_date::text AS start_date,
              count(m.id) FILTER (WHERE m.status <> 'cancelled'
                  AND m.scheduled_date BETWEEN $1::date AND $2::date)::int AS planned,
              count(m.id) FILTER (WHERE m.status = 'completed'
                  AND m.scheduled_date BETWEEN $1::date AND $2::date)::int AS done,
              count(m.id) FILTER (WHERE m.status = 'failed'
                  AND m.scheduled_date BETWEEN $1::date AND $2::date)::int AS failed,
              max(m.scheduled_date) FILTER (WHERE m.status = 'completed')::text AS last_done
         FROM goals g
         JOIN users u ON u.id = g.user_id AND u.status = 'active'
         LEFT JOIN missions m ON m.goal_id = g.id AND m.deleted_at IS NULL
        WHERE g.status = 'active' AND g.deleted_at IS NULL AND g.end_date >= $3::date
          AND NOT EXISTS (
                SELECT 1 FROM ai_analysis_runs r
                 WHERE r.user_id = g.user_id AND r.run_type = 'plan_adjustment'
                   AND r.period_start = $1::date)
          AND NOT EXISTS (
                SELECT 1 FROM plan_adjustment_proposals p
                 WHERE p.goal_id = g.id AND p.status = 'proposed')
          AND EXISTS (
                SELECT 1 FROM missions f
                 WHERE f.goal_id = g.id AND f.deleted_at IS NULL
                   AND f.status = 'scheduled' AND f.scheduled_date >= $3::date)
        GROUP BY g.id`,
      [period.start, period.end, today],
    );

    // 회원마다 원인이 있는 목표 중 가장 나쁜 하나
    const byUser = new Map();
    for (const row of rows) {
      const causes = adjustmentCauses({
        planned: row.planned,
        done: row.done,
        failed: row.failed,
        missedDays: consecutiveMissedDays({
          lastDone: row.last_done,
          goalStart: row.start_date,
          today,
        }),
      });
      if (causes.length === 0) continue;
      const entry = {
        goalId: row.goal_id,
        userId: row.user_id,
        rate: row.done / row.planned,
        causes,
      };
      byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), entry]);
    }

    let created = 0;
    for (const candidates of [...byUser.values()].slice(0, limit)) {
      const pick = pickWorstGoal(candidates);
      const id = newId();
      try {
        await this.database.query(
          `INSERT INTO ai_analysis_runs
                  (id, user_id, run_type, period_start, period_end, ingest_key)
           VALUES ($1, $2, 'plan_adjustment', $3, $4, $5)`,
          [
            id,
            pick.userId,
            period.start,
            period.end,
            adjustmentKey(id, pick.goalId),
          ],
        );
        created += 1;
      } catch (error) {
        if (error?.code !== '23505') throw error;
      }
    }
    return created;
  }

  async sendRequested(result, today, limit) {
    const { rows } = await this.database.query(
      `SELECT id, user_id, period_start::text AS period_start,
              period_end::text AS period_end, ingest_key
         FROM ai_analysis_runs
        WHERE run_type = 'plan_adjustment' AND status = 'requested'
        ORDER BY requested_at LIMIT $1`,
      [limit],
    );
    for (const run of rows) {
      const tries = this.attempts.get(run.id) ?? 0;
      if (tries >= MAX_SEND_ATTEMPTS) continue;
      const parsed = parseAdjustmentKey(run.ingest_key);
      try {
        const body = await this.buildRequest(run, parsed.goalId, today);
        if (!body) {
          await this.failRun(run.id, 'GOAL_NOT_ADJUSTABLE');
          continue;
        }
        await this.ai.post(AI_ADJUSTMENT_PATH, body, {
          timeoutMs: this.ai.requestTimeoutMs,
        });
        this.attempts.set(run.id, MAX_SEND_ATTEMPTS);
        result.sent += 1;
      } catch (error) {
        if (!(error instanceof AiRequestError)) throw error;
        result.failed += 1;
        if (error.permanent) {
          await this.failRun(run.id, error.code ?? 'AI_REQUEST_REJECTED');
          this.attempts.delete(run.id);
        } else {
          this.attempts.set(run.id, tries + 1);
          this.logger.warn(
            `재조정 요청 실패 run=${run.id} 시도=${tries + 1}: ${error.message}`,
          );
        }
      }
    }
  }

  /** 앞으로 남은 예정 미션을 AI 계약 PlanStep[]으로 */
  async loadBeforePlan(db, goalId, today, goalEnd) {
    const { rows } = await db.query(
      `SELECT s.step_no, s.title AS step_title, s.description AS step_description,
              s.due_date::text AS step_due_date,
              m.scheduled_date::text AS scheduled_date, m.title, m.description,
              c.code AS category_code, d.code AS difficulty_code, m.exercise_code,
              m.verification_method, m.target_value, m.target_unit,
              m.estimated_duration_seconds, m.is_required
         FROM missions m
         JOIN goal_categories c ON c.id = m.category_id
         JOIN difficulty_levels d ON d.id = m.difficulty_id
         LEFT JOIN goal_steps s ON s.id = m.goal_step_id
        WHERE m.goal_id = $1 AND m.deleted_at IS NULL AND m.status = 'scheduled'
          AND m.scheduled_date >= $2::date
        ORDER BY s.step_no NULLS LAST, m.scheduled_date, m.created_at`,
      [goalId, today],
    );
    return toPlanSteps(rows, goalEnd);
  }

  /** I06 요청 본문 (AI 계약 PlanAdjustmentRequest), 조정할 미션이 없으면 null */
  async buildRequest(run, goalId, today) {
    const { rows } = await this.database.query(
      `SELECT g.title, g.description, g.start_date::text AS start_date,
              g.end_date::text AS end_date, g.target_frequency,
              g.daily_available_minutes, c.code AS category_code,
              d.code AS difficulty_code, g.user_id,
              count(m.id) FILTER (WHERE m.status <> 'cancelled'
                  AND m.scheduled_date BETWEEN $2::date AND $3::date)::int AS planned,
              count(m.id) FILTER (WHERE m.status = 'completed'
                  AND m.scheduled_date BETWEEN $2::date AND $3::date)::int AS done,
              count(m.id) FILTER (WHERE m.status = 'failed'
                  AND m.scheduled_date BETWEEN $2::date AND $3::date)::int AS failed,
              max(m.scheduled_date) FILTER (WHERE m.status = 'completed')::text AS last_done
         FROM goals g
         JOIN goal_categories c ON c.id = g.category_id
         JOIN difficulty_levels d ON d.id = g.difficulty_id
         LEFT JOIN missions m ON m.goal_id = g.id AND m.deleted_at IS NULL
        WHERE g.id = $1 AND g.deleted_at IS NULL AND g.status = 'active'
        GROUP BY g.id, c.code, d.code`,
      [goalId, run.period_start, run.period_end],
    );
    const goal = rows[0];
    if (!goal || goal.user_id !== run.user_id) return null;
    const beforePlan = await this.loadBeforePlan(
      this.database,
      goalId,
      today,
      goal.end_date,
    );
    if (beforePlan.length === 0) return null;

    const missedDays = consecutiveMissedDays({
      lastDone: goal.last_done,
      goalStart: goal.start_date,
      today,
    });
    return {
      ingestKey: run.ingest_key,
      runId: run.id,
      today,
      goal: {
        title: goal.title,
        description: goal.description ?? null,
        categoryCode: goal.category_code,
        difficultyCode: goal.difficulty_code,
        startDate: goal.start_date,
        endDate: goal.end_date,
        targetFrequency: goal.target_frequency ?? null,
        dailyAvailableMinutes: goal.daily_available_minutes ?? null,
      },
      beforePlan,
      stats: {
        periodStart: run.period_start,
        periodEnd: run.period_end,
        plannedCount: goal.planned,
        completedCount: goal.done,
        failedCount: goal.failed,
        achievementRate: rateOf(goal.done, goal.planned) ?? 0,
        consecutiveMissedDays: missedDays,
      },
      causes: adjustmentCauses({
        planned: goal.planned,
        done: goal.done,
        failed: goal.failed,
        missedDays,
      }),
      exerciseTypes: EXERCISE_TYPES.map((type) => ({ ...type })),
      callbackUrl: `${this.ai.callbackBaseUrl}/internal/v1/ai-callbacks/plan-adjustments`,
    };
  }

  async failRun(runId, reason) {
    await this.database.query(
      `UPDATE ai_analysis_runs
          SET status = 'failed', failure_reason = $2, completed_at = now()
        WHERE id = $1 AND status = 'requested'`,
      [runId, String(reason).slice(0, 200)],
    );
  }

  async expireStale() {
    const { rows } = await this.database.query(
      `UPDATE ai_analysis_runs
          SET status = 'failed', failure_reason = 'AI_NO_RESULT', completed_at = now()
        WHERE run_type = 'plan_adjustment' AND status = 'requested'
          AND requested_at < now() - make_interval(mins => $1)
        RETURNING id`,
      [RESULT_WAIT_MINUTES],
    );
    for (const { id } of rows) this.attempts.delete(id);
    return rows.length;
  }

  /** 기한이 지난 제안을 expired로 (앱은 기한이 지난 proposed를 이미 expired로 보여 줌) */
  async expireProposals() {
    const { rowCount } = await this.database.query(
      `UPDATE plan_adjustment_proposals
          SET status = 'expired', decided_at = now()
        WHERE status = 'proposed' AND expires_at IS NOT NULL AND expires_at <= now()`,
    );
    return rowCount;
  }

  /**
   * 콜백 처리 (AI 계약 PlanAdjustmentCallback)
   * - completed: 제안(proposed) 저장 → 실행 완료 → 알림
   * - failed: 실행을 실패로 닫음
   * - 이미 닫힌 실행이면 ignored
   */
  async ingest(input) {
    const key = parseAdjustmentKey(input.ingestKey);
    if (!key || key.runId !== input.runId) {
      throw new BadRequestException(['ingestKey: 형식이 올바르지 않음']);
    }
    const today = kstDate();
    return this.database.withTransaction(async (tx) => {
      const { rows } = await tx.query(
        `SELECT id, user_id, status, ingest_key FROM ai_analysis_runs
          WHERE id = $1 AND run_type = 'plan_adjustment' FOR UPDATE`,
        [input.runId],
      );
      const run = rows[0];
      if (!run) throw notFound('재조정 실행을 찾을 수 없음');
      if (run.ingest_key !== input.ingestKey) {
        throw new BadRequestException(['ingestKey: 실행과 맞지 않음']);
      }
      if (run.status !== 'requested') {
        return { status: 'ignored', runStatus: run.status };
      }

      if (input.status === 'failed') {
        await tx.query(
          `UPDATE ai_analysis_runs
              SET status = 'failed', failure_reason = $2, completed_at = now()
            WHERE id = $1`,
          [
            run.id,
            (input.failureReason ?? 'AI_ADJUSTMENT_FAILED').slice(0, 200),
          ],
        );
        return { status: 'failed_handled' };
      }

      const { rows: goals } = await tx.query(
        `SELECT id, end_date::text AS end_date FROM goals
          WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [key.goalId, run.user_id],
      );
      if (!goals[0]) throw notFound('재조정할 목표를 찾을 수 없음');

      const before = await this.loadBeforePlan(
        tx,
        key.goalId,
        today,
        goals[0].end_date,
      );
      const { rows: made } = await tx.query(
        `INSERT INTO plan_adjustment_proposals
                (id, run_id, user_id, goal_id, proposal_json, before_plan, reason, expires_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7,
                 now() + make_interval(days => $8))
         RETURNING id`,
        [
          newId(),
          run.id,
          run.user_id,
          key.goalId,
          JSON.stringify({ steps: input.proposedPlan }),
          JSON.stringify({ steps: before }),
          input.reason ?? null,
          PROPOSAL_VALID_DAYS,
        ],
      );
      await tx.query(
        `UPDATE ai_analysis_runs
            SET status = 'completed', engine_version = $2, completed_at = now()
          WHERE id = $1`,
        [run.id, input.engineVersion],
      );
      await createSystemNotification(tx, {
        userId: run.user_id,
        eventKey: `plan_adjustment:${made[0].id}`,
        title: '계획 조정 제안이 도착했어요',
        body: (
          input.reason ?? '지난주 결과를 바탕으로 계획을 조정해 봤어요.'
        ).slice(0, 200),
        linkScreen: `plan-adjustments/${made[0].id}`,
      });
      this.attempts.delete(run.id);
      return { status: 'applied', adjustmentId: made[0].id };
    });
  }
}
