/**
 * 세션 상태와 토큰 갱신 (parts/mobile-client §3.4).
 *
 * 앱에 세션은 하나뿐이므로 모듈 변수로 둔다. 화면은 `useSession()`으로 상태만 본다.
 *
 * 상태: `'restoring'`(앱 시작 직후) → `'signedOut'` 또는 `'signedIn'`.
 *
 * `httpClient`와 서로 import 하면 고리가 생기므로, 여기서 `setAuthProvider()`로
 * 자기를 등록한다. 그래서 이 모듈을 한 번이라도 import 하면 토큰 주입이 켜진다.
 */
import { setAuthProvider } from '../http/httpClient.js';
import { saveTokens, loadTokens, clearTokens } from './tokenStore.js';
import { refreshSession as apiRefresh, logout as apiLogout } from '../api/authApi.js';
import { getMe } from '../api/meApi.js';

/** @typedef {'restoring'|'signedOut'|'signedIn'} SessionStatus */

const state = {
  /** @type {SessionStatus} */
  status: 'restoring',
  /** @type {import('./tokenStore.js').Tokens|null} */
  tokens: null,
  /** @type {{id: string, nickname: string}|null} 로그인 응답의 `profile` */
  profile: null,
};

/** @type {Set<(snapshot: {status: SessionStatus, profile: object|null}) => void>} */
const listeners = new Set();

/** `useSyncExternalStore`가 같은 값인지 비교할 수 있도록 바뀔 때만 새 객체를 만든다. */
let snapshot = { status: state.status, profile: state.profile };

function publish() {
  snapshot = { status: state.status, profile: state.profile };
  for (const listener of [...listeners]) listener(snapshot);
}

/** 지금 상태. */
export function getSnapshot() {
  return snapshot;
}

/**
 * 상태가 바뀔 때 알려 준다.
 * @param {(snapshot: {status: SessionStatus, profile: object|null}) => void} listener
 * @returns {() => void} 구독 해제
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `httpClient`가 요청마다 꺼내 쓰는 값. 없으면 `Authorization`을 붙이지 않는다. */
export function getAccessToken() {
  return state.tokens?.accessToken ?? null;
}

/** 캐시를 비우기 위해 `ClientProvider`가 넘겨 준다. */
let queryClient = null;
export function attachQueryClient(client) {
  queryClient = client;
}

/**
 * 로그인·가입 성공 응답(`Session`)을 받아 세션을 연다.
 * @param {{profile: {id: string, nickname: string}, tokens: import('./tokenStore.js').Tokens}} session
 */
export async function signIn(session) {
  await saveTokens(session.tokens);
  state.tokens = session.tokens;
  state.profile = session.profile ?? null;
  state.status = 'signedIn';
  publish();
}

/**
 * 서버를 부르지 않고 로컬 세션만 끊는다 (갱신 실패·탈퇴 신청 후).
 */
export async function endSession() {
  await clearTokens();
  state.tokens = null;
  state.profile = null;
  state.status = 'signedOut';
  queryClient?.clear();
  publish();
}

/**
 * A10 로그아웃. **서버 호출이 실패해도** 로컬 토큰은 지운다 (§3.4).
 */
export async function signOut() {
  const refreshToken = state.tokens?.refreshToken;
  if (refreshToken) {
    try {
      await apiLogout(refreshToken);
    } catch {
      // 네트워크가 없어도 로그아웃은 되어야 한다.
    }
  }
  await endSession();
}

/** 진행 중인 갱신 요청. 동시에 여러 요청이 401을 받아도 갱신은 1번만 (§3.4). */
let refreshInFlight = null;

/**
 * A09 토큰 갱신.
 * @returns {Promise<boolean>} 새 토큰을 받았으면 true
 */
export function refresh() {
  if (refreshInFlight) return refreshInFlight;

  const run = (async () => {
    const refreshToken = state.tokens?.refreshToken;
    if (!refreshToken) return false;
    try {
      const session = await apiRefresh(refreshToken);
      if (!session?.tokens?.accessToken) return false;
      await saveTokens(session.tokens);
      state.tokens = session.tokens;
      if (session.profile) state.profile = session.profile;
      return true;
    } catch {
      // AUTH_REFRESH_INVALID도, 네트워크 오류도 "갱신 못 함"이다.
      // 로그인 화면으로 보낼지는 부르는 쪽(httpClient)이 정한다.
      return false;
    }
  })();

  refreshInFlight = run.finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/**
 * 앱 시작 때 한 번. 키체인의 토큰으로 세션을 되살린다 (§3.4).
 *
 * 인터넷이 없어서 `/me`를 못 부른 경우는 로그아웃시키지 않고 토큰을 믿는다.
 * (문서가 정한 것은 "성공 → signedIn", "갱신 실패 → signedOut"까지다.
 *  오프라인으로 30일짜리 리프레시 토큰을 버리면 손해만 크다.)
 *
 * @returns {Promise<SessionStatus>}
 */
export async function restore() {
  state.status = 'restoring';
  publish();

  const tokens = await loadTokens();
  if (!tokens) {
    state.tokens = null;
    state.profile = null;
    state.status = 'signedOut';
    publish();
    return state.status;
  }

  state.tokens = tokens;

  try {
    // 401 AUTH_TOKEN_EXPIRED면 httpClient가 refresh()를 부른 뒤 한 번 더 보낸다.
    const me = await getMe();
    state.profile = { id: me.id, nickname: me.nickname };
    state.status = 'signedIn';
  } catch (error) {
    if (error?.isNetwork) {
      state.status = 'signedIn';
    } else {
      await clearTokens();
      state.tokens = null;
      state.profile = null;
      state.status = 'signedOut';
      queryClient?.clear();
    }
  }
  publish();
  return state.status;
}

/** 테스트에서 모듈 상태를 되돌린다. */
export function __resetSessionForTests() {
  state.status = 'restoring';
  state.tokens = null;
  state.profile = null;
  refreshInFlight = null;
  queryClient = null;
  listeners.clear();
  snapshot = { status: state.status, profile: state.profile };
}

// httpClient에 자기를 등록한다 (import 고리를 피하는 방법).
setAuthProvider({ getAccessToken, refresh, endSession });

export const session = {
  getSnapshot,
  subscribe,
  getAccessToken,
  attachQueryClient,
  signIn,
  signOut,
  endSession,
  refresh,
  restore,
};

export default session;
