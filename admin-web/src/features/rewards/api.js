import { http } from '../../api/httpClient.js';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// Admin reward API (backend: points/admin-points.controller.js, admin-assets/*,
// admin-policies/policies.controller.js). Every mutation takes the Idempotency-Key as its last
// argument: one key per user action.

dayjs.extend(utc);
dayjs.extend(timezone);

const data = (response) => response.data;
const withKey = (idempotencyKey) => ({ idempotencyKey });

// ---- points (M70, M71) ----

/**
 * M70 GET /point-transactions (AdminPage). The header X-Pending-Points is the reward sum of
 * records still waiting for review, returned here as `pendingPoints`.
 * @param {{userId?: string, kind?: string, sourceType?: string, from?: string, to?: string,
 *   page?: number, size?: number, sort?: string}} params
 */
export const listPointTransactions = ({ from, to, ...params }) =>
  http
    .get('/point-transactions', {
      params: {
        ...params,
        // The list filter gives dates (both included, Asia/Seoul); the API takes `to` exclusive.
        from: from ? dayjs.tz(from, 'Asia/Seoul').startOf('day').toISOString() : undefined,
        to: to ? dayjs.tz(to, 'Asia/Seoul').add(1, 'day').startOf('day').toISOString() : undefined,
      },
    })
    .then((response) => ({
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
