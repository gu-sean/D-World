import { http } from '../../api/httpClient.js';

// Admin mission APIs. Contract = backend controllers
//   mission-definitions/admin-mission-definitions.controller.js (M40~M44)
//   admin-policies/policies.controller.js (M45~M50, M74~M75)
// Every mutation needs a `reason` in its body and an Idempotency-Key (one key per user action).

// ── Mission definitions (M40~M44) ──

/**
 * M42 GET /mission-definitions -> AdminPage `{items, page, size, totalCount}`
 * @param {{origin?: 'admin'|'user', publicationStatus?: string, categoryId?: string,
 *   query?: string, page?: number, size?: number, sort?: 'createdAt,desc'|'createdAt,asc'}} params
 */
export const fetchDefinitions = (params = {}) =>
  http
    .get('/mission-definitions', {
      params: Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
      ),
    })
    .then((response) => response.data);

/** M43 GET /mission-definitions/:id */
export const fetchDefinition = (id) =>
  http.get(`/mission-definitions/${id}`).then((response) => response.data);

/**
 * M40 POST /mission-definitions
 * @param {object} body `{title, categoryId, difficultyId, verificationMethod, reason, ...optional}`
 * @param {string} idempotencyKey
 */
export const createDefinition = (body, idempotencyKey) =>
  http.post('/mission-definitions', body, { idempotencyKey }).then((response) => response.data);

/** M41 PATCH /mission-definitions/:id (only the sent fields change, `reason` is required) */
export const updateDefinition = (id, body, idempotencyKey) =>
  http
    .patch(`/mission-definitions/${id}`, body, { idempotencyKey })
    .then((response) => response.data);

/**
 * M44 POST /mission-definitions/:id/reviews (user-made definitions only)
 * @param {string} id
 * @param {{decision: 'approved'|'rejected'|'hidden', reason: string}} body
 * @param {string} idempotencyKey
 * @returns {Promise<{id: string, publicationStatus: string, decidedAt: string}>}
 */
export const reviewDefinition = (id, body, idempotencyKey) =>
  http
    .post(`/mission-definitions/${id}/reviews`, body, { idempotencyKey })
    .then((response) => response.data);

// ── Categories and difficulties (M45~M50) ──

const CATALOG_PATHS = { categories: '/goal-categories', difficulties: '/difficulty-levels' };

/** GET /goal-categories | /difficulty-levels -> `[{id, code, name, displayOrder, isActive}]` */
export const fetchCatalog = (kind) =>
  http.get(CATALOG_PATHS[kind]).then((response) => response.data);

/** POST: body `{code, name, displayOrder, reason}` */
export const createCatalogItem = (kind, body, idempotencyKey) =>
  http.post(CATALOG_PATHS[kind], body, { idempotencyKey }).then((response) => response.data);

/** PATCH /:id: body `{name?, displayOrder?, isActive?, reason}` (at least one field besides reason) */
export const updateCatalogItem = (kind, id, body, idempotencyKey) =>
  http
    .patch(`${CATALOG_PATHS[kind]}/${id}`, body, { idempotencyKey })
    .then((response) => response.data);

// ── Reward rates (M74~M75), append-only versions ──

/** M74 GET /mission-reward-rates -> `[{id, categoryId, difficultyId, versionNo, points, userXp, petXp, effectiveAt}]` */
export const fetchRewardRates = (params = {}) =>
  http
    .get('/mission-reward-rates', {
      params: Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
      ),
    })
    .then((response) => response.data);

/** M75 POST /mission-reward-rates: `{categoryId, difficultyId, points, userXp, petXp, effectiveAt?, reason}` */
export const createRewardRate = (body, idempotencyKey) =>
  http.post('/mission-reward-rates', body, { idempotencyKey }).then((response) => response.data);
