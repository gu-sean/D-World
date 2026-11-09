/**
 * 08 §11 상황 추천 (A90~A93).
 *
 * 좌표는 요청 본문에만 들어가고 서버도 저장하지 않는다 (08 A90 처리 1번).
 * 앱도 좌표를 저장하거나 로그로 남기지 않는다.
 */
import { request } from '../http/httpClient.js';

/** 서버가 날씨 조회 + AI 15초 + 대체 저장까지 하므로 30초 기다린다 (parts/mobile-client §3.1 4번). */
export const SITUATIONAL_TIMEOUT_MS = 30000;

/**
 * A90 상황 추천 받기 (멱등 필수).
 * @param {{kind: 'location'|'moving'|'weather', latitude?: number, longitude?: number,
 *          isMoving?: boolean, idempotencyKey: string}} input
 * @returns {Promise<object[]>} `MissionRecommendation[]` (1~3개)
 */
export function requestSituational({ idempotencyKey, ...body }) {
  return request({
    method: 'POST',
    path: '/recommendations/situational',
    body,
    idempotent: true,
    idempotencyKey,
    timeoutMs: SITUATIONAL_TIMEOUT_MS,
  });
}

/**
 * A91 추천 수락 (멱등 필수). 오늘 날짜 미션이 생긴다.
 * @param {{recommendationId: string, idempotencyKey: string}} input
 * @returns {Promise<object>} `Mission`
 */
export function acceptRecommendation({ recommendationId, idempotencyKey }) {
  return request({
    method: 'POST',
    path: `/recommendations/${encodeURIComponent(recommendationId)}/accept`,
    idempotent: true,
    idempotencyKey,
  });
}

/**
 * A92 추천 거절. 사유는 MVP에서 받지 않는다.
 * @param {{recommendationId: string}} input
 * @returns {Promise<null>}
 */
export function dismissRecommendation({ recommendationId }) {
  return request({
    method: 'POST',
    path: `/recommendations/${encodeURIComponent(recommendationId)}/dismiss`,
    body: {},
  });
}

/**
 * A93 아직 살아 있는 추천.
 * @returns {Promise<object[]>} `MissionRecommendation[]`
 */
export function getActiveRecommendations() {
  return request({ method: 'GET', path: '/recommendations/active' });
}

export default {
  requestSituational,
  acceptRecommendation,
  dismissRecommendation,
  getActiveRecommendations,
  SITUATIONAL_TIMEOUT_MS,
};
