/**
 * 08 §13 문의·신고 (A120~A122).
 */
import { request } from '../http/httpClient.js';

/**
 * A120 문의·신고 등록 (멱등 필수).
 * @param {{ticketType: 'inquiry'|'report', category: string, subject: string, body: string,
 *          targetKind?: string|null, targetId?: string|null, idempotencyKey: string}} input
 * @returns {Promise<object>} `SupportTicket`
 */
export function createSupportTicket({ idempotencyKey, ...body }) {
  return request({ method: 'POST', path: '/support-tickets', body, idempotent: true, idempotencyKey });
}

/**
 * A121 내 문의 목록.
 * @param {{cursor?: string, limit?: number}} query
 * @returns {Promise<{items: object[], nextCursor: string|null}>} `Page<SupportTicket>`
 */
export function listMySupportTickets(query) {
  return request({ method: 'GET', path: '/me/support-tickets', query });
}

/**
 * A122 문의 상세 (내 것만).
 * @param {string} ticketId
 * @returns {Promise<object>} `SupportTicket`
 */
export function getSupportTicket(ticketId) {
  return request({ method: 'GET', path: `/support-tickets/${encodeURIComponent(ticketId)}` });
}

export default { createSupportTicket, listMySupportTickets, getSupportTicket };
