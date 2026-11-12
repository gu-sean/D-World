import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchAuditLogs } from './api.js';

export const accessKeys = {
  all: ['access'],
  auditLogs: (params) => ['access', 'audit-logs', params],
};

/** M101 */
export const useAuditLogs = (params) =>
  useQuery({
    queryKey: accessKeys.auditLogs(params),
    queryFn: () => fetchAuditLogs(params),
    placeholderData: keepPreviousData,
  });
