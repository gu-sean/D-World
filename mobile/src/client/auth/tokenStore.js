/**
 * 토큰 보관 (parts/mobile-client §3.4).
 *
 * `Session.tokens`(`{accessToken, refreshToken, expiresAt}`)를 **한 덩어리 JSON**으로
 * 키체인 서비스 `dworld.session`에 넣는다. AsyncStorage가 아니라 키체인을 쓰는 이유는
 * 리프레시 토큰이 30일짜리 자격 증명이기 때문이다 (05 §4).
 *
 * 토큰 값을 로그로 남기지 않는다 (parts/mobile-client §1.4).
 */
import * as Keychain from 'react-native-keychain';

/** 키체인 서비스 이름. 바꾸면 기존 로그인이 모두 풀린다. */
export const KEYCHAIN_SERVICE = 'dworld.session';

/** 키체인은 username/password 두 칸짜리라, 한쪽에 고정 값을 넣는다. */
const USERNAME = 'tokens';

/**
 * @typedef {object} Tokens
 * @property {string} accessToken JWT, 30분
 * @property {string} refreshToken 불투명 문자열, 30일
 * @property {string} expiresAt 액세스 토큰 만료 시각 (ISO datetime)
 */

/** 저장된 값이 쓸 수 있는 모양인지. */
function isTokens(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof value.accessToken === 'string' && value.accessToken !== ''
    && typeof value.refreshToken === 'string' && value.refreshToken !== '',
  );
}

/**
 * 토큰을 저장한다.
 * @param {Tokens} tokens
 * @returns {Promise<void>}
 */
export async function saveTokens(tokens) {
  if (!isTokens(tokens)) throw new Error('saveTokens: 토큰 모양이 올바르지 않아요.');
  await Keychain.setGenericPassword(USERNAME, JSON.stringify(tokens), {
    service: KEYCHAIN_SERVICE,
  });
}

/**
 * 저장된 토큰을 읽는다. 없거나 깨졌으면 `null`.
 * @returns {Promise<Tokens|null>}
 */
export async function loadTokens() {
  let entry;
  try {
    entry = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  } catch {
    // 키체인을 열지 못하는 기기 상태(잠금 등)도 "로그인 안 됨"으로 본다.
    return null;
  }
  if (!entry || typeof entry.password !== 'string') return null;

  let parsed;
  try {
    parsed = JSON.parse(entry.password);
  } catch {
    await clearTokens();
    return null;
  }
  if (!isTokens(parsed)) {
    await clearTokens();
    return null;
  }
  return parsed;
}

/**
 * 토큰을 지운다. 로그아웃·갱신 실패 때.
 * @returns {Promise<void>}
 */
export async function clearTokens() {
  try {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  } catch {
    // 지우지 못해도 메모리 세션은 끊어야 하므로 삼킨다.
  }
}

export default { saveTokens, loadTokens, clearTokens, KEYCHAIN_SERVICE };
