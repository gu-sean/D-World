import { http } from '../../api/httpClient.js';

// M30~M37 of the admin API. Lists are AdminPage `{items, page, size, totalCount}`.
// Every mutating call takes the Idempotency-Key created by the screen, so a retry of the same
// user action sends the same key.

/**
 * M30 GET /verifications. The number of decisions made today is in the X-Completed-Today header.
 * @param {{status?: string, method?: string, userId?: string, page?: number, size?: number, sort?: string}} params
 * @returns {Promise<{items: object[], page: number, size: number, totalCount: number, completedToday: number}>}
 */
export const fetchVerifications = (params) =>
  http.get('/verifications', { params }).then((response) => ({
    ...response.data,
    completedToday: Number(response.headers['x-completed-today'] ?? 0),
  }));

/** M32 GET /verifications/:id */
export const fetchVerification = (recordId) =>
  http.get(`/verifications/${recordId}`).then((response) => response.data);

/**
 * M31 POST /verifications/:id/decisions
 * @param {{recordId: string, decision: 'approved'|'rejected', reason: string, idempotencyKey: string}} input
 */
export const decideVerification = ({ recordId, decision, reason, idempotencyKey }) =>
  http
    .post(`/verifications/${recordId}/decisions`, { decision, reason }, { idempotencyKey })
    .then((response) => response.data);

/** M34 GET /appeals (status: open | accepted | rejected) */
export const fetchAppeals = (params) =>
  http.get('/appeals', { params }).then((response) => response.data);

/** M35 GET /appeals/:id -> `{appeal, verification}` */
export const fetchAppeal = (appealId) =>
  http.get(`/appeals/${appealId}`).then((response) => response.data);

/**
 * M33 POST /appeals/:id/resolution (approved = appeal accepted, rejected = dismissed)
 * @param {{appealId: string, decision: 'approved'|'rejected', reason: string, idempotencyKey: string}} input
 */
export const resolveAppeal = ({ appealId, decision, reason, idempotencyKey }) =>
  http
    .post(`/appeals/${appealId}/resolution`, { decision, reason }, { idempotencyKey })
    .then((response) => response.data);

/** GET /goal-categories (needed to name the category of a criteria version) */
export const fetchCategories = () => http.get('/goal-categories').then((response) => response.data);

/** M36 GET /verification-criteria -> array of versions (newest first) */
export const fetchCriteria = (params) =>
  http.get('/verification-criteria', { params }).then((response) => response.data);

/**
 * M37 POST /verification-criteria. A new version is appended; old versions are never edited.
 * @param {{categoryId: string, verificationMethod: 'camera'|'sensor', rules: object, effectiveAt?: string, reason: string, idempotencyKey: string}} input
 */
export const createCriteria = ({ idempotencyKey, ...body }) =>
  http.post('/verification-criteria', body, { idempotencyKey }).then((response) => response.data);
