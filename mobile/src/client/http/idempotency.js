/**
 * 멱등 키 (05 §5.1, parts/mobile-client §3.2).
 *
 * 키는 **사용자 동작 1번마다** 하나다. 네트워크 오류로 다시 보낼 때는 같은 키를 그대로 쓴다.
 * 그래서 키를 만드는 쪽은 `request()`가 아니라 **부르는 쪽(뮤테이션 훅)**이다.
 */
import { v4 as uuidv4 } from 'uuid';

/**
 * 새 멱등 키를 만든다.
 * @returns {string} UUID v4
 */
export function newIdempotencyKey() {
  return uuidv4();
}

/**
 * 요청마다 붙이는 추적 ID (`X-Request-Id`). 로그를 서버와 맞춰 보기 위한 값이다.
 * @returns {string} UUID v4
 */
export function newRequestId() {
  return uuidv4();
}

export default { newIdempotencyKey, newRequestId };
