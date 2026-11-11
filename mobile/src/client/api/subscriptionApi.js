/**
 * 08 §13 구독 (A130) — 결제·구독은 MVP에서 껍데기다.
 * 서버가 항상 `501 COMMON_NOT_IMPLEMENTED`를 준다. 화면은 "준비 중"을 보여 준다.
 */
import { request } from '../http/httpClient.js';

/**
 * A130 내 구독.
 * @returns {Promise<object>} 지금은 항상 `COMMON_NOT_IMPLEMENTED`로 실패한다
 */
export function getSubscription() {
  return request({ method: 'GET', path: '/me/subscription' });
}

export default { getSubscription };
