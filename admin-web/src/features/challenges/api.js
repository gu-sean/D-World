import { http } from '../../api/httpClient.js';

// Admin challenge API M51~M61 (backend: src/challenges/admin-challenges.controller.js).
// Every mutation takes the Idempotency-Key as its last argument: one key per user action.

const data = (response) => response.data;
const withKey = (idempotencyKey) => ({ idempotencyKey });

/**
 * M53 GET /challenges (AdminPage)
 * @param {{publicationStatus?: string, settlementStatus?: string, phase?: string,
 *   origin?: string, categoryId?: string, page?: number, size?: number, sort?: string}} params
 * @returns {Promise<{items: object[], page: number, size: number, totalCount: number}>}
 */
export const listChallenges = (params) => http.get('/challenges', { params }).then(data);

/** M54 GET /challenges/:id */
export const fetchChallenge = (id) => http.get(`/challenges/${id}`).then(data);

/** M51 POST /challenges (official challenge). body: definition fields + reward + reason */
export const createChallenge = (body, idempotencyKey) =>
  http.post('/challenges', body, withKey(idempotencyKey)).then(data);

/** M52 PATCH /challenges/:id (field patch + reason) */
export const updateChallenge = (id, patch, idempotencyKey) =>
  http.patch(`/challenges/${id}`, patch, withKey(idempotencyKey)).then(data);

/** M52 PATCH /challenges/:id `{action: publish|hide|cancel, reason}` */
export const changeChallengeStatus = (id, body, idempotencyKey) =>
  http.patch(`/challenges/${id}`, body, withKey(idempotencyKey)).then(data);

/** M60 GET /challenges/:id/rankings -> `{ranking: {challengeId, calculatedAt}, entries}` */
export const fetchRankings = (id) => http.get(`/challenges/${id}/rankings`).then(data);

/** GET /challenges/:id/participants/:participationId/days -> `{items}` */
export const fetchParticipantDays = (id, participationId) =>
  http.get(`/challenges/${id}/participants/${participationId}/days`).then(data);

/**
 * M61 POST /challenges/:id/moderation-actions
 * @param {{participationId: string, action: 'disqualify'|'exclude_day'|'restore_day',
 *   dailyMissionId?: string, reason: string}} body
 */
export const moderate = (id, body, idempotencyKey) =>
  http.post(`/challenges/${id}/moderation-actions`, body, withKey(idempotencyKey)).then(data);

/** M56 POST /challenges/:id/settlement-runs (201) `{reason}` */
export const createSettlementRun = (id, body, idempotencyKey) =>
  http.post(`/challenges/${id}/settlement-runs`, body, withKey(idempotencyKey)).then(data);

/** M57 GET /settlement-runs/:runId */
export const fetchSettlementRun = (runId) => http.get(`/settlement-runs/${runId}`).then(data);

/** M58 POST /settlement-runs/:runId/confirm `{reason}` */
export const confirmSettlementRun = (runId, body, idempotencyKey) =>
  http.post(`/settlement-runs/${runId}/confirm`, body, withKey(idempotencyKey)).then(data);

/** M59 POST /settlement-runs/:runId/payments/retry (202) `{reason}` -> `{retriedCount}` */
export const retrySettlementPayments = (runId, body, idempotencyKey) =>
  http.post(`/settlement-runs/${runId}/payments/retry`, body, withKey(idempotencyKey)).then(data);

/** M45 GET /goal-categories -> `[{id, code, name, displayOrder, isActive}]` */
export const fetchCategories = () => http.get('/goal-categories').then(data);

/** M48 GET /difficulty-levels -> `[{id, code, name, displayOrder, isActive}]` */
export const fetchDifficultyLevels = () => http.get('/difficulty-levels').then(data);
