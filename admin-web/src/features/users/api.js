import { http } from '../../api/httpClient.js';

/**
 * M10 GET /users (ADM-02)
 * @param {{page, size, sort, query, status, restricted, joinedFrom, joinedTo}} params
 * @returns {Promise<object>} AdminPage<AdminUserListItem>
 */
export const fetchUsers = (params) => http.get('/users', { params }).then((r) => r.data);

/** M11 GET /users/{userId} (ADM-03) @returns {Promise<object>} AdminUserDetail */
export const fetchUser = (userId) => http.get(`/users/${userId}`).then((r) => r.data);

/**
 * M12 GET /users/{userId}/activities (ADM-03 activity tab)
 * @param {string} userId
 * @param {{type?: string, page: number, size: number}} params
 * @returns {Promise<object>} AdminPage<AdminUserActivity>
 */
export const fetchUserActivities = (userId, params) =>
  http.get(`/users/${userId}/activities`, { params }).then((r) => r.data);

/**
 * M13 POST /users/{userId}/account-actions (ADM-04)
 * @param {string} userId
 * @param {{actionType: 'warning'|'restriction', days?: number, sourceTicketId?: string, reason: string}} body
 * @param {string} idempotencyKey
 * @returns {Promise<object>} AccountAction
 */
export const createAccountAction = (userId, body, idempotencyKey) =>
  http.post(`/users/${userId}/account-actions`, body, { idempotencyKey }).then((r) => r.data);

/**
 * M14 POST /account-actions/{actionId}/lift
 * @param {string} actionId
 * @param {{reason: string}} body
 * @param {string} idempotencyKey
 * @returns {Promise<object>} AccountAction
 */
export const liftAccountAction = (actionId, body, idempotencyKey) =>
  http.post(`/account-actions/${actionId}/lift`, body, { idempotencyKey }).then((r) => r.data);

/**
 * M15 GET /withdrawal-requests (ADM-05)
 * @param {{page, size, sort, status}} params
 * @returns {Promise<object>} AdminPage<WithdrawalRequest>
 */
export const fetchWithdrawals = (params) =>
  http.get('/withdrawal-requests', { params }).then((r) => r.data);

/**
 * M16 PATCH /withdrawal-requests/{requestId}
 * @param {string} requestId
 * @param {{status: 'on_hold'|'processing', reason: string}} body
 * @param {string} idempotencyKey
 * @returns {Promise<object>} WithdrawalRequest
 */
export const updateWithdrawal = (requestId, body, idempotencyKey) =>
  http.patch(`/withdrawal-requests/${requestId}`, body, { idempotencyKey }).then((r) => r.data);
