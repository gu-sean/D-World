/**
 * 08 §1 계정 API 중 내 정보 쪽 (A11~A16).
 */
import { request } from '../http/httpClient.js';

/**
 * A11 내 정보.
 * @returns {Promise<object>} `Me`
 */
export function getMe() {
  return request({ method: 'GET', path: '/me' });
}

/**
 * A12 프로필 수정.
 * @param {{nickname?: string, notificationEnabled?: boolean}} input
 * @returns {Promise<object>} `Me`
 */
export function updateProfile(input) {
  return request({ method: 'PATCH', path: '/me/profile', body: input });
}

/** 난이도 추천은 Gemini 에이전트를 거쳐 기본 15초보다 오래 걸릴 수 있다 */
export const DIFFICULTY_TIMEOUT_MS = 45000;

/** 신체정보·최근 수행률을 세 에이전트가 차례로 검토해 난이도를 추천한다. */
export function recommendDifficulty(input) {
  return request({
    method: 'POST',
    path: '/me/difficulty-recommendations',
    body: input,
    timeoutMs: DIFFICULTY_TIMEOUT_MS,
  });
}

/**
 * A13 약관 재동의.
 * @param {{consents: Array<{documentVersionId: string, granted: boolean}>}} input
 * @returns {Promise<null>}
 */
export function submitConsents(input) {
  return request({ method: 'POST', path: '/me/consents', body: input });
}

/**
 * A14 탈퇴 신청. 성공하면 모든 로그인이 끊긴다.
 * @param {{reason?: string, idempotencyKey: string}} input
 * @returns {Promise<{requestId: string, status: string}>}
 */
export function requestWithdrawal({ reason, idempotencyKey }) {
  return request({
    method: 'POST',
    path: '/me/withdrawal-requests',
    body: { reason },
    idempotent: true,
    idempotencyKey,
  });
}

/**
 * A15 푸시 토큰 등록 (로그인 직후, `setup/pushRegistration.js`가 부른다).
 * @param {{platform: 'android'|'ios', token: string}} input
 * @returns {Promise<null>}
 */
export function registerPushDevice(input) {
  return request({ method: 'PUT', path: '/me/push-devices', body: input });
}

/**
 * A16 푸시 토큰 해제 (로그아웃 직전).
 * @param {string} token
 * @returns {Promise<null>}
 */
export function unregisterPushDevice(token) {
  return request({ method: 'POST', path: '/me/push-devices/unregister', body: { token } });
}

export default {
  getMe,
  updateProfile,
  recommendDifficulty,
  submitConsents,
  requestWithdrawal,
  registerPushDevice,
  unregisterPushDevice,
};
