/**
 * 08 §7 계획 재조정 (A50~A53).
 */
import { request } from '../http/httpClient.js';

/**
 * A50 재조정 제안 목록.
 * @param {{goalId?: string, status?: string|string[], cursor?: string, limit?: number}} query
 * @returns {Promise<{items: object[], nextCursor: string|null}>} `Page<PlanAdjustment>`
 */
export function listAdjustments(query) {
  return request({ method: 'GET', path: '/plan-adjustments', query });
}

/**
 * A51 재조정 제안 상세.
 * @param {string} adjustmentId
 * @returns {Promise<object>} `PlanAdjustment`
 */
export function getAdjustment(adjustmentId) {
  return request({ method: 'GET', path: `/plan-adjustments/${encodeURIComponent(adjustmentId)}` });
}

/**
 * A52 재조정 수락 (멱등 필수). `plan`을 보내면 사용자가 고친 계획이다.
 * @param {{adjustmentId: string, plan?: object[], idempotencyKey: string}} input
 * @returns {Promise<{adjustment: object, goal: object, todayMissions: object[]}>}
 */
export function acceptAdjustment({ adjustmentId, idempotencyKey, ...body }) {
  return request({
    method: 'POST',
    path: `/plan-adjustments/${encodeURIComponent(adjustmentId)}/accept`,
    body,
    idempotent: true,
    idempotencyKey,
  });
}

/**
 * A53 재조정 거절. `proposed`만.
 * @param {{adjustmentId: string}} input
 * @returns {Promise<null>}
 */
export function rejectAdjustment({ adjustmentId }) {
  return request({ method: 'POST', path: `/plan-adjustments/${encodeURIComponent(adjustmentId)}/reject` });
}

export default { listAdjustments, getAdjustment, acceptAdjustment, rejectAdjustment };
