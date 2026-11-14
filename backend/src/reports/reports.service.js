import { Dependencies, HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';
import { addDays, kstDate } from '../common/time/kst.js';
import { DatabaseService } from '../database/database.service.js';

const rate = (done, total) =>
  total === 0 ? 0 : Number((done / total).toFixed(4));

const badRequest = (message) =>
  new AppException(HttpStatus.BAD_REQUEST, 'bad_request', message);

/** 기준 날짜가 속한 기간의 [시작, 끝] (week: 월~일, month: 그 달, all: 시작 없음) */
export function periodRange(period, date) {
  if (period === 'all') return { start: null, end: date };
  if (period === 'month') {
    const start = `${date.slice(0, 7)}-01`;
    const next = new Date(`${start}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return { start, end: addDays(next.toISOString().slice(0, 10), -1) };
  }
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=일
  const start = addDays(date, weekday === 0 ? -6 : 1 - weekday);
  return { start, end: addDays(start, 6) };
}

/** 한 달(YYYY-MM)의 첫날과 마지막 날 */
export function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw badRequest('month: YYYY-MM 형식이어야 함');
  }
  return periodRange('month', `${month}-01`);
}

/** 리포트(A60~A64): 기간 요약, AI 리포트, 달력 */
@Injectable()
@Dependencies(DatabaseService)
export class ReportsService {
  constructor(database) {
    this.database = database;
  }

  /** A60 ReportSummary */
  async summary(userId, { period = 'week', date, categoryId }) {
    const today = kstDate();
    const range = periodRange(period, date ?? today);
    const params = [userId, range.start, range.end, categoryId ?? null];

    const [totals, byCategory, goals, streak, insight, adjustment] =
      await Promise.all([
        this.database.query(
          `SELECT count(*)::int AS planned,
                  count(*) FILTER (WHERE status = 'completed')::int AS done
             FROM missions
            WHERE user_id = $1 AND deleted_at IS NULL AND status <> 'cancelled'
              AND ($2::date IS NULL OR scheduled_date >= $2::date)
              AND scheduled_date <= $3::date
              AND ($4::short_id IS NULL OR category_id = $4)`,
          params,
        ),
        this.database.query(
          `SELECT c.code, c.name, count(*)::int AS planned,
                  count(*) FILTER (WHERE m.status = 'completed')::int AS done
             FROM missions m JOIN goal_categories c ON c.id = m.category_id
            WHERE m.user_id = $1 AND m.deleted_at IS NULL AND m.status <> 'cancelled'
              AND ($2::date IS NULL OR m.scheduled_date >= $2::date)
              AND m.scheduled_date <= $3::date
              AND ($4::short_id IS NULL OR m.category_id = $4)
            GROUP BY c.id ORDER BY c.display_order, c.id`,
          params,
        ),
        this.database.query(
          `SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE m.status = 'completed')::int AS done
             FROM missions m JOIN goals g ON g.id = m.goal_id AND g.user_id = m.user_id
            WHERE m.user_id = $1 AND m.deleted_at IS NULL AND m.status <> 'cancelled'
              AND g.deleted_at IS NULL AND g.status = 'active'
              AND ($2::short_id IS NULL OR g.category_id = $2)`,
          [userId, categoryId ?? null],
        ),
        this.database.query(
          'SELECT current_success_days FROM streak_states WHERE user_id = $1',
          [userId],
        ),
        this.database.query(
          `SELECT r.run_id, r.summary, r.feedback
             FROM ai_reports r JOIN ai_analysis_runs a ON a.id = r.run_id
            WHERE r.user_id = $1 AND a.superseded_at IS NULL
              AND ($2::date IS NULL OR a.period_end >= $2::date)
              AND a.period_start <= $3::date
            ORDER BY a.period_end DESC, r.generated_at DESC LIMIT 1`,
          [userId, range.start, range.end],
        ),
        this.database.query(
          `SELECT id, reason FROM plan_adjustment_proposals
            WHERE user_id = $1 AND status = 'proposed'
              AND (expires_at IS NULL OR expires_at > now())
            ORDER BY created_at DESC LIMIT 1`,
          [userId],
        ),
      ]);

    const { planned, done } = totals.rows[0];
    const report = insight.rows[0];
    const open = adjustment.rows[0];
    return {
      period,
      periodStart: range.start,
      periodEnd: range.end,
      categoryId: categoryId ?? null,
      completedMissionCount: done,
      plannedMissionCount: planned,
      goalProgressRate: rate(goals.rows[0].done, goals.rows[0].total),
      achievementRate: rate(done, planned),
      streakDays: streak.rows[0]?.current_success_days ?? 0,
      categories: byCategory.rows.map((row) => ({
        categoryCode: row.code,
        name: row.name,
        completedCount: row.done,
        plannedCount: row.planned,
        achievementRate: rate(row.done, row.planned),
      })),
      insight: report
        ? {
            aiReportRunId: report.run_id,
            summary: report.summary,
            feedback: report.feedback,
          }
        : null,
      nextSuggestion: open
        ? {
            text: open.reason ?? '계획을 조정해 볼까요?',
            planAdjustmentId: open.id,
          }
        : null,
    };
  }

  toReport(row) {
    const highlights = row.content_json?.highlights;
    return {
      runId: row.run_id,
      runType: row.run_type,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      title: row.title,
      summary: row.summary,
      feedback: row.feedback,
      highlights: Array.isArray(highlights) ? highlights : [],
      engineVersion: row.engine_version,
      readAt: row.read_at,
      createdAt: row.generated_at,
    };
  }

  /** A61 Page<AiReport>, 최신 기간 순 */
  async listReports(userId, { runType, cursor, limit }) {
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
      `SELECT r.run_id, r.run_type, r.title, r.summary, r.feedback, r.content_json,
              r.generated_at, r.generated_at::text AS generated_at_raw, r.read_at,
              a.period_start::text AS period_start, a.period_end::text AS period_end,
              a.engine_version
         FROM ai_reports r JOIN ai_analysis_runs a ON a.id = r.run_id
        WHERE r.user_id = $1 AND a.superseded_at IS NULL
          AND ($2::text IS NULL OR r.run_type = $2)
          AND ($3::timestamptz IS NULL
               OR (r.generated_at, r.run_id) < ($3::timestamptz, $4::short_id))
        ORDER BY r.generated_at DESC, r.run_id DESC
        LIMIT $5`,
      [userId, runType ?? null, after?.t ?? null, after?.id ?? null, limit + 1],
    );
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((row) => this.toReport(row)),
      nextCursor:
        rows.length > limit
          ? Buffer.from(
              JSON.stringify({ t: last.generated_at_raw, id: last.run_id }),
            ).toString('base64url')
          : null,
    };
  }

  /** A62 */
  async getReport(userId, runId) {
    const { rows } = await this.database.query(
      `SELECT r.run_id, r.run_type, r.title, r.summary, r.feedback, r.content_json,
              r.generated_at, r.read_at,
              a.period_start::text AS period_start, a.period_end::text AS period_end,
              a.engine_version
         FROM ai_reports r JOIN ai_analysis_runs a ON a.id = r.run_id
        WHERE r.run_id = $1 AND r.user_id = $2`,
      [runId, userId],
    );
    if (!rows[0]) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'not_found',
        '리포트를 찾을 수 없음',
      );
    }
    return this.toReport(rows[0]);
  }

  /** A63: 처음 읽은 시각만 기록 */
  async markRead(userId, runId) {
    await this.getReport(userId, runId);
    await this.database.query(
      `UPDATE ai_reports SET read_at = now()
        WHERE run_id = $1 AND user_id = $2 AND read_at IS NULL`,
      [runId, userId],
    );
  }

  /** A64 CalendarDay[]: 그 달 1일부터 말일까지 하루도 빠뜨리지 않음 */
  async calendar(userId, month) {
    const { start, end } = monthRange(month);
    const { rows } = await this.database.query(
      `SELECT d::date::text AS date,
              coalesce(m.total, 0) AS total, coalesce(m.done, 0) AS done,
              s.status AS streak_status
         FROM generate_series($2::date, $3::date, interval '1 day') d
         LEFT JOIN (
           SELECT scheduled_date, count(*)::int AS total,
                  count(*) FILTER (WHERE status = 'completed')::int AS done
             FROM missions
            WHERE user_id = $1 AND deleted_at IS NULL AND status <> 'cancelled'
              AND scheduled_date BETWEEN $2::date AND $3::date
            GROUP BY scheduled_date) m ON m.scheduled_date = d::date
         LEFT JOIN streak_days s ON s.user_id = $1 AND s.streak_date = d::date
        ORDER BY d`,
      [userId, start, end],
    );
    return rows.map((row) => ({
      date: row.date,
      totalCount: row.total,
      completedCount: row.done,
      streakStatus: row.streak_status ?? null,
    }));
  }
}
