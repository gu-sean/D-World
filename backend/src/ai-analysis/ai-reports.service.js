import { randomUUID } from 'node:crypto';
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
import { AiClient, AiRequestError } from '../integrations/ai/ai.client.js';
import { createSystemNotification } from '../notices/system-notification.js';
import { lastMonth, lastWeek, previousPeriod } from './periods.js';
import { loadReportStats } from './report-stats.js';

/**
 * 리포트 요청 경로 (AI 서버의 I05 라우터가 아직 없어 llm 라우터 규칙을 따라 정한 값, AI 쪽과 확정 필요)
 * 요청은 202로 접수되고 결과는 콜백(POST /internal/v1/ai-callbacks/reports)으로 온다
 */
export const AI_REPORT_PATH = '/llm/reports';
export const REPORT_TYPES = ['weekly_report', 'monthly_report'];
/** 결과가 이 시간 안에 오지 않으면 실패로 닫는다 */
const RESULT_WAIT_MINUTES = 60;
const MAX_SEND_ATTEMPTS = 5;

const periodOf = (runType, today) =>
  runType === 'weekly_report' ? lastWeek(today) : lastMonth(today);

/** 주간·월간 AI 리포트 (I05): 대상 선정 → 요청 → 결과 저장·알림 */
@Injectable()
@Dependencies(DatabaseService, AiClient)
export class AiReportsService {
  logger = new Logger(AiReportsService.name);
  attempts = new Map(); // runId → 보내려 한 횟수

  constructor(database, ai) {
    this.database = database;
    this.ai = ai;
  }

  /**
   * 정기 작업: 지난주·지난달에 계획이 있었는데 리포트 실행이 없는 회원마다 실행을 만들고 요청을 보냄
   * 요청이 일시 실패하면 다음 주기에 다시 보내고(최대 5번), 결과가 늦으면 실패로 닫는다
   */
  async dispatchDue({ limit = 50, today = kstDate() } = {}) {
    if (!this.ai.enabled) return { skipped: true };
    const result = { created: 0, sent: 0, failed: 0, expired: 0 };
    result.expired = await this.expireStale();
    for (const runType of REPORT_TYPES) {
      result.created += await this.createRuns(
        runType,
        periodOf(runType, today),
        limit,
      );
    }
    await this.sendRequested(result, limit);
    return result;
  }

  async createRuns(runType, period, limit) {
    const { rows } = await this.database.query(
      `SELECT DISTINCT m.user_id
         FROM missions m JOIN users u ON u.id = m.user_id AND u.status = 'active'
        WHERE m.deleted_at IS NULL AND m.status <> 'cancelled'
          AND m.scheduled_date BETWEEN $1::date AND $2::date
          AND NOT EXISTS (
                SELECT 1 FROM ai_analysis_runs r
                 WHERE r.user_id = m.user_id AND r.run_type = $3
                   AND r.period_start = $1::date)
        LIMIT $4`,
      [period.start, period.end, runType, limit],
    );
    if (rows.length === 0) return 0;
    // 한 번에 삽입, 동시에 다른 인스턴스가 만든 행(고유 인덱스 충돌)은 건너뜀
    const ids = rows.map(() => randomUUID());
    const { rowCount } = await this.database.query(
      `INSERT INTO ai_analysis_runs
              (id, user_id, run_type, period_start, period_end, ingest_key)
       SELECT t.id, t.user_id, $3, $4::date, $5::date, 'report:' || t.id
         FROM unnest($1::uuid[], $2::uuid[]) AS t(id, user_id)
       ON CONFLICT DO NOTHING`,
      [ids, rows.map((row) => row.user_id), runType, period.start, period.end],
    );
    return rowCount;
  }

  async sendRequested(result, limit) {
    const { rows } = await this.database.query(
      `SELECT id, user_id, run_type, period_start::text AS period_start,
              period_end::text AS period_end, ingest_key
         FROM ai_analysis_runs
        WHERE run_type = ANY($1::text[]) AND status = 'requested'
        ORDER BY requested_at LIMIT $2`,
      [REPORT_TYPES, limit],
    );
    for (const run of rows) {
      const tries = this.attempts.get(run.id) ?? 0;
      if (tries >= MAX_SEND_ATTEMPTS) continue;
      try {
        await this.ai.post(AI_REPORT_PATH, await this.buildRequest(run), {
          timeoutMs: this.ai.requestTimeoutMs,
        });
        // 접수된 뒤에는 결과(콜백)를 기다림, 다시 보내지 않도록 횟수를 가득 채움
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
            `리포트 요청 실패 run=${run.id} 시도=${tries + 1}: ${error.message}`,
          );
        }
      }
    }
  }

  /** I05 요청 본문 (AI 계약 ReportRequest) */
  async buildRequest(run) {
    const period = { start: run.period_start, end: run.period_end };
    const stats = await loadReportStats(
      this.database,
      run.user_id,
      period,
      previousPeriod(run.run_type, period),
    );
    return {
      ingestKey: run.ingest_key,
      runId: run.id,
      runType: run.run_type,
      periodStart: run.period_start,
      periodEnd: run.period_end,
      stats,
      callbackUrl: `${this.ai.callbackBaseUrl}/internal/v1/ai-callbacks/reports`,
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
        WHERE run_type = ANY($1::text[]) AND status = 'requested'
          AND requested_at < now() - make_interval(mins => $2)
        RETURNING id`,
      [REPORT_TYPES, RESULT_WAIT_MINUTES],
    );
    for (const { id } of rows) this.attempts.delete(id);
    return rows.length;
  }

  /**
   * 콜백 처리 (AI 계약 ReportCallback)
   * - completed: ai_reports 저장 → 실행 완료 → 알림 (결과는 열린 실행에만 붙일 수 있어 이 순서)
   * - failed: 실행을 실패로 닫음
   * - 이미 닫힌 실행에 다시 오면 ignored (재전송에 안전)
   */
  async ingest(input) {
    return this.database.withTransaction(async (tx) => {
      const { rows } = await tx.query(
        `SELECT id, user_id, run_type, status, ingest_key FROM ai_analysis_runs
          WHERE id = $1 AND run_type = ANY($2::text[]) FOR UPDATE`,
        [input.runId, REPORT_TYPES],
      );
      const run = rows[0];
      if (!run) {
        throw new AppException(
          HttpStatus.NOT_FOUND,
          'run_not_found',
          '리포트 실행을 찾을 수 없음',
        );
      }
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
          [run.id, (input.failureReason ?? 'AI_REPORT_FAILED').slice(0, 200)],
        );
        return { status: 'failed_handled' };
      }

      await tx.query(
        `INSERT INTO ai_reports
                (run_id, run_type, user_id, title, summary, content_json, feedback, next_goals)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb)`,
        [
          run.id,
          run.run_type,
          run.user_id,
          input.title,
          input.summary,
          JSON.stringify(input.content ?? { highlights: [] }),
          input.feedback ?? null,
          JSON.stringify(input.nextGoals ?? []),
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
        eventKey: `ai_report:${run.id}`,
        title:
          run.run_type === 'weekly_report'
            ? '주간 리포트가 도착했어요'
            : '월간 리포트가 도착했어요',
        body: input.summary.slice(0, 200),
        linkScreen: `reports/ai/${run.id}`,
      });
      this.attempts.delete(run.id);
      return { status: 'applied' };
    });
  }
}
