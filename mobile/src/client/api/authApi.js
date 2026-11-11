/**
 * 08 §1 계정 API 중 로그인·가입 쪽 (A01~A10).
 *
 * 이 파일의 함수는 **요청을 보내는 일만** 한다. 세션 저장·상태 변경은 `auth/session.js`,
 * 캐시 무효화는 `queries/auth.js`가 한다.
 */
import { request } from '../http/httpClient.js';

/**
 * A01 휴대폰 인증번호 보내기.
 * @param {{phoneNumber: string, purpose: 'signup'|'reset_password'}} input `phoneNumber`는 숫자만 (11 §8.1)
 * @returns {Promise<object>} `PhoneVerificationStarted`
 */
export function requestPhoneVerification(input) {
  return request({ method: 'POST', path: '/auth/phone-verifications', body: input, auth: false });
}

/**
 * A02 인증번호 확인.
 * @param {{verificationId: string, code: string}} input
 * @returns {Promise<object>} `PhoneVerificationConfirmed`
 */
export function confirmPhoneVerification({ verificationId, code }) {
  return request({
    method: 'POST',
    path: `/auth/phone-verifications/${encodeURIComponent(verificationId)}/confirm`,
    body: { code },
    auth: false,
  });
}

/**
 * A03 닉네임 중복 확인.
 * @param {string} nickname
 * @returns {Promise<{available: boolean}>}
 */
export function checkNicknameAvailability(nickname) {
  return request({ method: 'GET', path: '/auth/nickname-availability', query: { nickname }, auth: false });
}

/**
 * A04 현재 약관 문서.
 * @returns {Promise<object[]>} `PolicyDocument[]` (terms·privacy·marketing 순)
 */
export function getCurrentPolicies() {
  return request({ method: 'GET', path: '/policy-documents/current', auth: false });
}

/**
 * A05 가입. 휴대폰 가입과 소셜 가입이 같은 엔드포인트다.
 * @param {{verificationToken?: string, password?: string, socialSignupToken?: string,
 *          nickname: string, consents: Array<{documentVersionId: string, granted: boolean}>}} input
 * @returns {Promise<object>} `Session`
 */
export function signup(input) {
  return request({ method: 'POST', path: '/auth/signup', body: input, auth: false });
}

/**
 * A06 휴대폰 로그인.
 * @param {{phoneNumber: string, password: string}} input
 * @returns {Promise<object>} `Session`
 */
export function login(input) {
  return request({ method: 'POST', path: '/auth/login', body: input, auth: false });
}

/**
 * A07 소셜 로그인.
 * @param {{provider: 'google'|'naver', credential: string}} input
 * @returns {Promise<object>} 기존 회원이면 `Session`, 신규면 `SocialSignupRequired`
 */
export function socialLogin({ provider, credential }) {
  return request({
    method: 'POST',
    path: `/auth/social/${encodeURIComponent(provider)}/login`,
    body: { credential },
    auth: false,
  });
}

/**
 * A08 비밀번호 재설정. 성공하면 그 사용자의 다른 로그인이 모두 끊긴다.
 * @param {{verificationToken: string, newPassword: string}} input
 * @returns {Promise<null>}
 */
export function resetPassword(input) {
  return request({ method: 'POST', path: '/auth/password-reset', body: input, auth: false });
}

/**
 * A09 토큰 갱신. 리프레시 토큰은 쓸 때마다 새로 발급된다(회전, 05 §4).
 * @param {string} refreshToken
 * @returns {Promise<object>} `Session`
 */
export function refreshSession(refreshToken) {
  return request({ method: 'POST', path: '/auth/token/refresh', body: { refreshToken }, auth: false });
}

/**
 * A10 로그아웃. 토큰이 없거나 이미 폐기여도 204다.
 * @param {string} refreshToken
 * @returns {Promise<null>}
 */
export function logout(refreshToken) {
  return request({ method: 'POST', path: '/auth/logout', body: { refreshToken }, auth: false });
}

export default {
  requestPhoneVerification,
  confirmPhoneVerification,
  checkNicknameAvailability,
  getCurrentPolicies,
  signup,
  login,
  socialLogin,
  resetPassword,
  refreshSession,
  logout,
};
