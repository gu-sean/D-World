/**
 * 08 §3 목표·AI 목표 분해 (A20~A28).
 */
import { request } from '../http/httpClient.js';

/** A25 계획 생성은 서버가 AI를 기다리므로 70초까지 기다린다 (parts/mobile-client §3.1 4번). */
export const PLAN_TIMEOUT_MS = 70000;

/**
 * A20 목표 등록 (멱등 필수).
 * @param {object} input `GoalInput` + `idempotencyKey`
 * @returns {Promise<object>} `Goal`
 */
export function createGoal({ idempotencyKey, ...body }) {
  return request({ method: 'POST', path: '/goals', body, idempotent: true, idempotencyKey });
}

/**
 * A21 목표 목록.
 * @param {{status?: string|string[], categoryCode?: string, cursor?: string, limit?: number}} query
 * @returns {Promise<{items: object[], nextCursor: string|null}>} `Page<Goal>`
 */
export function listGoals(query) {
  return request({ method: 'GET', path: '/goals', query });
}

/**
 * A22 목표 수정 (멱등 필수). `startDate`·`categoryCode`는 보내면 400이다.
 * @param {{goalId: string, idempotencyKey: string} & object} input `GoalInput`의 부분 + `status?`
 * @returns {Promise<object>} `GoalDetail`
 */
export function updateGoal({ goalId, idempotencyKey, ...body }) {
  return request({
    method: 'PATCH',
    path: `/goals/${encodeURIComponent(goalId)}`,
    body,
    idempotent: true,
    idempotencyKey,
  });
}

/**
 * A23 목표 상세.
 * @param {string} goalId
 * @returns {Promise<object>} `GoalDetail`
 */
export function getGoal(goalId) {
  return request({ method: 'GET', path: `/goals/${encodeURIComponent(goalId)}` });
}

/**
 * A24 목표 삭제 (멱등 필수). 시작 전 미션은 서버가 취소한다.
 * @param {{goalId: string, idempotencyKey: string}} input
 * @returns {Promise<null>}
 */
export function deleteGoal({ goalId, idempotencyKey }) {
  return request({
    method: 'DELETE',
    path: `/goals/${encodeURIComponent(goalId)}`,
    idempotent: true,
    idempotencyKey,
  });
}

/**
 * A25 AI 계획 제안 만들기 (멱등 필수). 본문 없음, 70초까지 기다린다.
 * @param {{goalId: string, idempotencyKey: string}} input
 * @returns {Promise<object>} `PlanProposal` (status `draft`)
 */
export function generatePlan({ goalId, idempotencyKey }) {
  return request({
    method: 'POST',
    path: `/goals/${encodeURIComponent(goalId)}/plan-proposals`,
    idempotent: true,
    idempotencyKey,
    timeoutMs: PLAN_TIMEOUT_MS,
  });
}

/**
 * A26 최신 계획 제안. 없으면 404 `COMMON_NOT_FOUND`.
 * @param {string} goalId
 * @returns {Promise<object>} `PlanProposal`
 */
export function getLatestPlan(goalId) {
  return request({ method: 'GET', path: `/goals/${encodeURIComponent(goalId)}/plan-proposals/latest` });
}

/**
 * A27 계획 수락 (멱등 필수). `steps`를 보내면 사용자가 고친 계획이다.
 * @param {{proposalId: string, generationNo: number, steps?: object[], idempotencyKey: string}} input
 * @returns {Promise<object>} `AcceptPlanResult`
 */
export function acceptPlan({ proposalId, idempotencyKey, ...body }) {
  return request({
    method: 'POST',
    path: `/plan-proposals/${encodeURIComponent(proposalId)}/accept`,
    body,
    idempotent: true,
    idempotencyKey,
  });
}

/**
 * A28 계획 거절. `draft`만 가능.
 * @param {{proposalId: string, reason?: string}} input
 * @returns {Promise<null>}
 */
export function rejectPlan({ proposalId, reason }) {
  return request({
    method: 'POST',
    path: `/plan-proposals/${encodeURIComponent(proposalId)}/reject`,
    body: { reason },
  });
}

export default {
  createGoal,
  listGoals,
  updateGoal,
  getGoal,
  deleteGoal,
  generatePlan,
  getLatestPlan,
  acceptPlan,
  rejectPlan,
  PLAN_TIMEOUT_MS,
};
