import { http } from '../../api/httpClient.js';
import { newIdempotencyKey } from '../../api/idempotency.js';

// Admin reward API (backend: points/admin-points.controller.js, admin-assets/*,
// admin-policies/policies.controller.js). Every mutation takes the Idempotency-Key as its last
// argument: one key per user action.

const data = (response) => response.data;
const withKey = (idempotencyKey) => ({ idempotencyKey });

// ---- points (M70, M71) ----

/**
 * M70 GET /point-transactions (AdminPage). The header X-Pending-Points is the reward sum of
 * records still waiting for review, returned here as `pendingPoints`.
 * @param {{userId?: string, kind?: string, sourceType?: string, from?: string, to?: string,
 *   page?: number, size?: number, sort?: string}} params
 */
export const listPointTransactions = (params) =>
  http.get('/point-transactions', { params }).then((response) => ({
    ...response.data,
    pendingPoints: Number(response.headers?.['x-pending-points'] ?? 0),
  }));

/**
 * M71 POST /point-adjustments
 * @param {{userId: string, kind: 'manual_grant'|'manual_recovery', amount: number, reason: string}} body
 */
export const adjustPoints = (body, idempotencyKey) =>
  http.post('/point-adjustments', body, withKey(idempotencyKey)).then(data);

// ---- catalogs used by the reward table (read only) ----

export const fetchCategories = () => http.get('/goal-categories').then(data);
export const fetchDifficultyLevels = () => http.get('/difficulty-levels').then(data);

// ---- point policies (M72~M75) ----

/** M72 GET /point-cap-policies -> `{items: [{id, effectiveMonth, monthlyLimitPoints}]}` */
export const listPointCaps = () => http.get('/point-cap-policies').then(data);

/** M73 POST /point-cap-policies `{effectiveMonth: 'YYYY-MM-01', monthlyLimitPoints, reason}` */
export const createPointCap = (body, idempotencyKey) =>
  http.post('/point-cap-policies', body, withKey(idempotencyKey)).then(data);

/** M74 GET /mission-reward-rates (`categoryId`, `difficultyId` filters) */
export const listRewardRates = (params) => http.get('/mission-reward-rates', { params }).then(data);

/** M75 POST /mission-reward-rates `{categoryId, difficultyId, points, userXp, petXp, effectiveAt?, reason}` */
export const createRewardRate = (body, idempotencyKey) =>
  http.post('/mission-reward-rates', body, withKey(idempotencyKey)).then(data);

// ---- streak milestones (M82, M83) ----

export const listStreakMilestones = () => http.get('/streak-milestone-policies').then(data);

/** `{targetSuccessDays: 7|30|100, points, userXp, petXp, effectiveAt?, reason}` */
export const createStreakMilestone = (body, idempotencyKey) =>
  http.post('/streak-milestone-policies', body, withKey(idempotencyKey)).then(data);

// ---- level thresholds ----

/** GET /policies/pet-levels -> `{items: [{id, versionNo, effectiveAt, thresholds}]}` */
export const listPetLevels = () => http.get('/policies/pet-levels').then(data);

/** POST /policies/pet-levels `{thresholds: [{levelNo, minTotalXp}], effectiveAt?}` */
export const createPetLevels = (body, idempotencyKey) =>
  http.post('/policies/pet-levels', body, withKey(idempotencyKey)).then(data);

// ---- achievements (M76~M78) ----

/** M76 GET /achievements -> array of `{id, code, status, currentVersionNo, versions}` */
export const listAchievements = () => http.get('/achievements').then(data);

/** M77 POST /achievements (`code` + version fields) */
export const createAchievement = (body, idempotencyKey) =>
  http.post('/achievements', body, withKey(idempotencyKey)).then(data);

/** M78 POST /achievements/:id/versions */
export const createAchievementVersion = ({ id, ...body }, idempotencyKey) =>
  http.post(`/achievements/${id}/versions`, body, withKey(idempotencyKey)).then(data);

// ---- pet species (M79~M81) ----

export const listPetSpecies = () => http.get('/pet-species').then(data);

/** M80 POST /pet-species (`code` + version fields, 3 stages) */
export const createPetSpecies = (body, idempotencyKey) =>
  http.post('/pet-species', body, withKey(idempotencyKey)).then(data);

/** M81 POST /pet-species/:id/versions */
export const createPetSpeciesVersion = ({ id, ...body }, idempotencyKey) =>
  http.post(`/pet-species/${id}/versions`, body, withKey(idempotencyKey)).then(data);

// ---- image upload (M84, M85) ----

/**
 * Uploads one image in 3 steps: M84 ticket, PUT to the storage URL, M85 complete.
 * `ownerId` is the id of an existing achievement/species, or a uuid chosen in advance for a new
 * one (the same uuid must be used for every image of that new item).
 * @returns {Promise<{assetId: string, imageUrl: string}>}
 */
export async function uploadImage({ file, assetKind, ownerId, reason }) {
  const ticket = await http
    .post(
      '/assets/upload-urls',
      { assetKind, ownerId, mimeType: file.type, sizeBytes: file.size, reason },
      withKey(newIdempotencyKey()),
    )
    .then(data);
  const put = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    headers: ticket.uploadHeaders,
    body: file,
  });
  if (!put.ok) {
    throw new Error('이미지를 올리지 못했어요. 다시 시도해 주세요.');
  }
  return http
    .post(`/assets/${ticket.assetId}/complete`, undefined, withKey(newIdempotencyKey()))
    .then(data);
}
