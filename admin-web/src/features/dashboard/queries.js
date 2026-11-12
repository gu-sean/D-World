import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchDashboardSummary } from './api.js';

export const dashboardKeys = {
  all: ['dashboard'],
  summary: (params) => ['dashboard', 'summary', params],
};

/**
 * M05. Asked again whenever the period changes.
 * @param {{from: string, to: string}} params
 * @param {{enabled?: boolean}} [options] `enabled: false` while the period is not valid
 */
export const useDashboardSummary = (params, { enabled = true } = {}) =>
  useQuery({
    queryKey: dashboardKeys.summary(params),
    queryFn: () => fetchDashboardSummary(params),
    placeholderData: keepPreviousData,
    enabled,
  });
