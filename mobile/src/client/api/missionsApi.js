/**
 * 08 §5 미션 (A30~A36).
 */
import { request } from '../http/httpClient.js';

/**
 * A30 미션 목록. `date` 하나만 주거나 `from`·`to`(최대 31일)를 준다.
 * @param {{date?: string, from?: string, to?: string, goalId?: string,
 *          categoryCode?: string, status?: string|string[], cursor?: string, limit?: number}} query
 * @returns {Promise<{items: object[], nextCursor: string|null}>} `Page<Mission>`
 */
export function listMissions(query) {
  return request({ method: 'GET', path: '/missions', query });
}

/**
 * A31 미션 만들기 (멱등 필수).
 * 직접 만들기(`title`·`targetValue`…)와 틀에서 만들기(`definitionId`) 중 하나만 보낸다.
 * @param {object} input `MissionInput` + `idempotencyKey`
 * @returns {Promise<object>} `Mission`
 */
export function createMission({ idempotencyKey, ...body }) {
  return request({ method: 'POST', path: '/missions', body, idempotent: true, idempotencyKey });
}

/**
 * A32 미션 상세.
 * @param {string} missionId
 * @returns {Promise<object>} `MissionDetail`
 */
export function getMission(missionId) {
  return request({ method: 'GET', path: `/missions/${encodeURIComponent(missionId)}` });
}

/**
 * A33 미션 수정 (멱등 필수).
 * 받는 필드는 `title`·`description`·`targetValue`·`estimatedDurationSeconds`·`scheduledDate`·`memo`뿐이다.
 * @param {{missionId: string, idempotencyKey: string} & object} input
 * @returns {Promise<object>} `MissionDetail`
 */
export function updateMission({ missionId, idempotencyKey, ...body }) {
  return request({
    method: 'PATCH',
    path: `/missions/${encodeURIComponent(missionId)}`,
    body,
    idempotent: true,
    idempotencyKey,
  });
}

/**
 * A34 미션 취소 (멱등 필수). `scheduled`인 미션만.
 * @param {{missionId: string, idempotencyKey: string}} input
 * @returns {Promise<object>} `Mission`
 */
export function cancelMission({ missionId, idempotencyKey }) {
  return request({
    method: 'POST',
    path: `/missions/${encodeURIComponent(missionId)}/cancel`,
    idempotent: true,
    idempotencyKey,
  });
}

/**
 * A35 미션 틀 목록 (공개된 것만).
 * @param {{categoryCode?: string, difficultyCode?: string, exerciseCode?: string,
 *          sort?: 'recent'|'duration', cursor?: string, limit?: number}} query
 * @returns {Promise<{items: object[], nextCursor: string|null}>} `Page<MissionDefinition>`
 */
export function listMissionDefinitions(query) {
  return request({ method: 'GET', path: '/mission-definitions', query });
}

/**
 * A36 다음에 할 미션 추천 (최대 10).
 * @param {'ai'|'interest'|'all'} [source]
 * @returns {Promise<object[]>} `MissionDefinition[]`
 */
export function getNextMissions(source) {
  return request({ method: 'GET', path: '/recommendations/next-missions', query: { source } });
}

export default {
  listMissions,
  createMission,
  getMission,
  updateMission,
  cancelMission,
  listMissionDefinitions,
  getNextMissions,
};
