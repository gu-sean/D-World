import { http } from '../../api/httpClient.js';

/**
 * M20 GET /support-tickets (ADM-06, ADM-11)
 * @param {{ticketType?, status?, targetKind?, assigned?, page, size, sort}} params
 * @returns {Promise<object>} AdminPage<AdminTicketListItem>
 */
export const fetchTickets = (params) =>
  http.get('/support-tickets', { params }).then((r) => r.data);

/** M21 GET /support-tickets/{ticketId} @returns {Promise<object>} AdminTicketDetail */
export const fetchTicket = (ticketId) =>
  http.get(`/support-tickets/${ticketId}`).then((r) => r.data);

/**
 * M22 POST /support-tickets/{ticketId}/assign
 * @param {string} ticketId
 * @param {{adminId: string|null, reason: string}} body `adminId: null` means "me"
 * @param {string} idempotencyKey
 * @returns {Promise<object>} AdminTicketDetail
 */
export const assignTicket = (ticketId, body, idempotencyKey) =>
  http.post(`/support-tickets/${ticketId}/assign`, body, { idempotencyKey }).then((r) => r.data);

/**
 * M23 POST /support-tickets/{ticketId}/events
 * @param {string} ticketId
 * @param {{eventType: 'reply'|'note', body: string, reason: string}} body
 * @param {string} idempotencyKey
 * @returns {Promise<object>} AdminTicketDetail
 */
export const addTicketEvent = (ticketId, body, idempotencyKey) =>
  http.post(`/support-tickets/${ticketId}/events`, body, { idempotencyKey }).then((r) => r.data);

/**
 * M24 POST /support-tickets/{ticketId}/resolution
 * @param {string} ticketId
 * @param {object} body TicketResolutionInput
 * @param {string} idempotencyKey
 * @returns {Promise<object>} AdminTicketDetail
 */
export const resolveTicket = (ticketId, body, idempotencyKey) =>
  http
    .post(`/support-tickets/${ticketId}/resolution`, body, { idempotencyKey })
    .then((r) => r.data);
