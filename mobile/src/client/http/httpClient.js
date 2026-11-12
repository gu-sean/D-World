/**
 * 앱 API(`/api/v1`) 호출기 (parts/mobile-client §3.1).
 *
 * 모든 API 함수는 이 `request()` 하나만 쓴다. 여기서 공통으로 하는 일:
 *  - 주소·쿼리 만들기, 공통 헤더(토큰·`X-Request-Id`·`Idempotency-Key`) 붙이기
 *  - 타임아웃 끊기
 *  - 401 `AUTH_TOKEN_EXPIRED`면 토큰을 갱신하고 **한 번만** 다시 보내기
 *  - 어떤 실패든 `AppError`로 바꿔서 던지기
 *
 * 세션(`auth/session.js`)은 서로 import 하면 고리가 생기므로
 * `setAuthProvider()`로 자기를 등록한다.
 */
import config from '../config.js';
import AppError from './AppError.js';
import { newRequestId } from './idempotency.js';

/** 기본 타임아웃 15초. A25는 70초, A90은 30초로 부르는 쪽이 지정한다. */
export const DEFAULT_TIMEOUT_MS = 15000;

/**
 * @typedef {object} AuthProvider
 * @property {() => string|null} getAccessToken 지금 쓸 액세스 토큰
 * @property {() => Promise<boolean>} refresh 토큰 갱신 (동시에 불려도 요청은 1개)
 * @property {() => Promise<void>} endSession 갱신 실패 → 로컬 세션 정리
 */

/** @type {AuthProvider|null} */
let authProvider = null;

/** `auth/session.js`가 자기를 등록한다. */
export function setAuthProvider(provider) {
  authProvider = provider;
}

/** 테스트에서 상태를 되돌릴 때 쓴다. */
export function clearAuthProvider() {
  authProvider = null;
}

/**
 * 쿼리 문자열을 만든다.
 * - 값이 `undefined`·`null`·`''`면 뺀다.
 * - 배열은 쉼표로 잇는다 (05 §6 "여러 값 필터 `?status=a,b`").
 * @param {object} [query]
 * @returns {string} `''` 또는 `'?a=1&b=2'`
 */
export function buildQueryString(query) {
  if (!query) return '';
  const parts = [];
  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined || raw === null || raw === '') continue;
    const value = Array.isArray(raw)
      ? raw.filter((v) => v !== undefined && v !== null && v !== '').join(',')
      : String(raw);
    if (value === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/**
 * @typedef {object} RequestOptions
 * @property {'GET'|'POST'|'PATCH'|'PUT'|'DELETE'} method
 * @property {string} path `/goals/123`처럼 `/api/v1` 뒤의 경로
 * @property {object} [query]
 * @property {object} [body]
 * @property {boolean} [auth=true] `Authorization` 헤더를 붙일지
 * @property {boolean} [idempotent=false] `Idempotency-Key` 헤더를 붙일지
 * @property {string} [idempotencyKey] 부르는 쪽이 만든 키 (재시도 때 같은 값, §3.2)
 * @property {number} [timeoutMs=15000]
 * @property {boolean} [withHeaders=false] `{data, headers}` 모양으로 받을지
 * @property {AbortSignal} [signal] 바깥에서 끊을 수 있게
 */

/**
 * 앱 API를 부른다.
 * @param {RequestOptions} opts
 * @returns {Promise<any>} 응답 JSON (204면 `null`). `withHeaders`면 `{data, headers}`
 * @throws {AppError}
 */
export async function request(opts) {
  return send(opts, true);
}

async function send(opts, mayRefresh) {
  const {
    method,
    path,
    query,
    body,
    auth = true,
    idempotent = false,
    idempotencyKey,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    withHeaders = false,
    signal,
  } = opts;

  const url = config.API_BASE_URL + path + buildQueryString(query);

  const headers = { Accept: 'application/json', 'X-Request-Id': newRequestId() };
  if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';
  if (idempotent) headers['Idempotency-Key'] = idempotencyKey ?? newRequestId();
  if (auth) {
    const token = authProvider?.getAccessToken() ?? null;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const { status, payload, getHeader } = await callFetch({
    method, url, headers, body, timeoutMs, signal,
  });

  // 성공을 먼저 가른다. 본문이 없는 5xx를 성공으로 보면 안 된다.
  if (status >= 200 && status < 300) {
    const data = status === 204 || payload === undefined ? null : payload;
    return withHeaders ? { data, headers: getHeader } : data;
  }

  const error = AppError.fromResponse(status, payload);

  // 401 AUTH_TOKEN_EXPIRED → 갱신 후 같은 요청을 한 번만 더 (05 §4)
  if (mayRefresh && auth && status === 401 && error.code === 'AUTH_TOKEN_EXPIRED' && authProvider) {
    const renewed = await authProvider.refresh();
    if (renewed) return send(opts, false);
    await authProvider.endSession();
    throw new AppError('AUTH_SESSION_EXPIRED', 401);
  }

  throw error;
}

/** 진짜 네트워크 호출. 실패는 모두 `AppError`로 바꾼다. */
async function callFetch({ method, url, headers, body, timeoutMs, signal }) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined || body === null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) throw new AppError('NETWORK_TIMEOUT', 0);
    if (signal?.aborted) throw new AppError('NETWORK_ERROR', 0);
    throw new AppError('NETWORK_ERROR', 0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }

  const status = response.status;
  let payload;
  if (status === 204) {
    payload = undefined;
  } else {
    const text = await response.text().catch(() => '');
    if (text === '') payload = undefined;
    else {
      try { payload = JSON.parse(text); } catch { payload = undefined; }
    }
  }

  return { status, payload, getHeader: (name) => response.headers.get(name) };
}

export default request;
