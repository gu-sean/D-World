/**
 * 리포트 훅 (A60~A64).
 */
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

import queryKeys from './keys.js';
import { infiniteListOptions, flattenItems } from '../http/cursor.js';
import { useAppMutation } from './mutation.js';
import * as reportsApi from '../api/reportsApi.js';

/**
 * A60 기간 요약 (`ReportSummary`).
 * @param {{period?: 'week'|'month'|'all', date?: string, categoryCode?: string}} [params]
 */
export function useReportSummary(params = {}) {
  return useQuery({
    queryKey: queryKeys.reportSummary(params),
    queryFn: () => reportsApi.getReportSummary(params),
  });
}

/**
 * A61 AI 리포트 목록 (무한 스크롤).
 * @param {{runType?: 'weekly_report'|'monthly_report'}} [params]
 */
export function useAiReports(params = {}) {
  const query = useInfiniteQuery(infiniteListOptions({
    queryKey: queryKeys.aiReports(params),
    limit: 10,
    fetchPage: ({ cursor, limit }) => reportsApi.listAiReports({ ...params, cursor, limit }),
  }));
  return { ...query, items: flattenItems(query.data) };
}

/** A62 AI 리포트 상세 (`AiReport`) */
export function useAiReport(runId) {
  return useQuery({
    queryKey: queryKeys.aiReport(runId),
    queryFn: () => reportsApi.getAiReport(runId),
    enabled: Boolean(runId),
  });
}

/** A63 AI 리포트 읽음. 입력 `{runId}` */
export function useMarkAiReportRead() {
  return useAppMutation({
    mutationFn: reportsApi.markAiReportRead,
    onDone: (queryClient) => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'ai'] });
    },
  });
}

/**
 * A64 달력 (`CalendarDay[]`).
 * @param {string} month `YYYY-MM`
 */
export function useCalendar(month) {
  return useQuery({
    queryKey: queryKeys.calendar(month),
    queryFn: () => reportsApi.getCalendar(month),
    enabled: Boolean(month),
  });
}

export default { useReportSummary, useAiReports, useAiReport, useMarkAiReportRead, useCalendar };
