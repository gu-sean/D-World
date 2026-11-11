import { http } from '../../api/httpClient.js';

/**
 * M101 GET /audit-logs (ADM-36)
 * @param {{adminId?, action?, targetUserId?, result?, from?, to?, page, size, sort}} params
 *   `action` matches the beginning of the action (e.g. `verification.`)
 * @returns {Promise<object>} AdminPage<AuditLog>
 */
export const fetchAuditLogs = (params) => http.get('/audit-logs', { params }).then((r) => r.data);
