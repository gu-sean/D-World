import { http } from '../../api/httpClient.js';

/**
 * M05 GET /dashboard/summary
 * @param {{from: string, to: string}} params `YYYY-MM-DD`, at most 31 days (docs/09 §2)
 * @returns {Promise<object>} DashboardSummary (docs/07 §16)
 */
export const fetchDashboardSummary = (params) =>
  http.get('/dashboard/summary', { params }).then((response) => response.data);
