/**
 * 08 §12 챌린지 (A100~A107).
 */
import { request } from '../http/httpClient.js';

/**
 * A100 챌린지 목록 (공개된 것).
 * @param {{phase?: 'recruiting'|'ongoing'|'ended', categoryCode?: string,
 *          closingSoon?: boolean, cursor?: string, limit?: number}} query
 * @returns {Promise<{items: object[], nextCursor: string|null}>} `Page<Challenge>`
 */
export function listChallenges(query) {
  return request({ method: 'GET', path: '/challenges', query });
}

/**
 * A101 챌린지 상세.
 * @param {string} challengeId
 * @returns {Promise<object>} `Challenge`
 */
export function getChallenge(challengeId) {
  return request({ method: 'GET', path: `/challenges/${encodeURIComponent(challengeId)}` });
}

/**
 * A102 참여 신청 (멱등 필수). 기간의 날짜마다 미션이 생긴다.
 * @param {{challengeId: string, idempotencyKey: string}} input
 * @returns {Promise<object>} `MyChallenge`
 */
export function joinChallenge({ challengeId, idempotencyKey }) {
  return request({
    method: 'POST',
    path: `/challenges/${encodeURIComponent(challengeId)}/participations`,
    idempotent: true,
    idempotencyKey,
  });
}

/**
 * A103 중도 포기 (멱등 필수).
 * @param {{challengeId: string, idempotencyKey: string}} input
 * @returns {Promise<null>}
 */
export function leaveChallenge({ challengeId, idempotencyKey }) {
  return request({
    method: 'DELETE',
    path: `/challenges/${encodeURIComponent(challengeId)}/participations/me`,
    idempotent: true,
    idempotencyKey,
  });
}

/**
 * A104 내 챌린지.
 * @param {{status?: 'enrolled'|'completed'|'failed'|'withdrawn'}} [query]
 * @returns {Promise<object[]>} `MyChallenge[]`
 */
export function getMyChallenges(query) {
  return request({ method: 'GET', path: '/me/challenges', query });
}

/**
 * A105 순위.
 * @param {string} challengeId
 * @returns {Promise<object>} `ChallengeRanking`
 */
export function getChallengeRanking(challengeId) {
  return request({ method: 'GET', path: `/challenges/${encodeURIComponent(challengeId)}/rankings` });
}


/**
 * A107 내 챌린지 결과.
 * @param {string} challengeId
 * @returns {Promise<object>} `ChallengeResult`
 */
export function getChallengeResult(challengeId) {
  return request({ method: 'GET', path: `/me/challenges/${encodeURIComponent(challengeId)}/result` });
}

export default {
  listChallenges,
  getChallenge,
  joinChallenge,
  leaveChallenge,
  getMyChallenges,
  getChallengeRanking,
  getChallengeResult,
};
