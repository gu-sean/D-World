/**
 * 08 §8 리포트 (A60~A64).
 */
import { request } from '../http/httpClient.js';

/**
 * A60 기간 요약.
 * @param {{period?: 'week'|'month'|'all', date?: string, categoryCode?: string}} query
 * @returns {Promise<object>} `ReportSummary`
 */
export function getReportSummary(query) {
  return request({ method: 'GET', path: '/reports/summary', query });
}

/**
 * A61 AI 리포트 목록.
 * @param {{runType?: 'weekly_report'|'monthly_report', cursor?: string, limit?: number}} query
 * @returns {Promise<{items: object[], nextCursor: string|null}>} `Page<AiReport>`
 */
export function listAiReports(query) {
  return request({ method: 'GET', path: '/ai-reports', query });
}

/**
 * A62 AI 리포트 상세.
 * @param {string} runId
 * @returns {Promise<object>} `AiReport`
 */
export function getAiReport(runId) {
  return request({ method: 'GET', path: `/ai-reports/${encodeURIComponent(runId)}` });
}

/**
 * A63 AI 리포트 읽음.
 * @param {{runId: string}} input
 * @returns {Promise<null>}
 */
export function markAiReportRead({ runId }) {
  return request({ method: 'POST', path: `/ai-reports/${encodeURIComponent(runId)}/read` });
}

/**
 * A64 달력 (그 달 1일~말일).
 * @param {string} month `YYYY-MM`
 * @returns {Promise<object[]>} `CalendarDay[]`
 */
export function getCalendar(month) {
  return request({ method: 'GET', path: '/calendar', query: { month } });
}

export default { getReportSummary, listAiReports, getAiReport, markAiReportRead, getCalendar };
