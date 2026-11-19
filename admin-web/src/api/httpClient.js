import axios from 'axios';
import { toAdminError } from './errors.js';
import { newIdempotencyKey } from './idempotency.js';
import { clearSession, getAccessToken, refresh } from './session.js';

export const http = axios.create({
  baseURL: import.meta.env.VITE_ADMIN_API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
});

const MUTATING_METHODS = ['post', 'patch', 'put', 'delete'];

// Login, refresh and logout (M01~M03) are the only mutating calls without an Idempotency-Key
// (docs/05 §5.2).
const isAuthRequest = (config) => config.url?.startsWith('/auth/') ?? false;

// Called when the session cannot be renewed. It receives the login URL to go to.
// AW-03 can replace it with a router navigation through setOnAuthFailure().
const defaultOnAuthFailure = (loginUrl) => window.location.assign(loginUrl);
let onAuthFailure = defaultOnAuthFailure;

/** @param {((loginUrl: string) => void)=} handler call without arguments to restore the default */
export function setOnAuthFailure(handler) {
  onAuthFailure = handler ?? defaultOnAuthFailure;
}

function redirectToLogin() {
  const { pathname, search } = window.location;
  if (pathname.startsWith('/login')) return;
  onAuthFailure(`/login?next=${encodeURIComponent(pathname + search)}`);
}

// Request: Bearer token, request id, Idempotency-Key.
http.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  config.headers.set('X-Request-Id', crypto.randomUUID());

  if (MUTATING_METHODS.includes((config.method ?? 'get').toLowerCase())) {
    let key = config.idempotencyKey;
    if (!key && !isAuthRequest(config)) {
      if (import.meta.env.DEV) {
        console.warn(`[http] ${config.method} ${config.url} has no idempotencyKey. Pass one.`);
      }
      key = newIdempotencyKey();
      // Stored on the config so that the repeat after a token refresh uses the same key.
      config.idempotencyKey = key;
    }
    if (key) config.headers.set('Idempotency-Key', key);
  }
  return config;
});

// Response: any 401 on a normal request (expired or otherwise not accepted token, e.g. after the
// server restarted) -> refresh -> repeat the request once (docs/05 §4). If the refresh fails, or the
// repeated request is refused again, the session is over and the admin goes to the login page.
// Other errors become AdminError. Failed 429/5xx requests are never repeated automatically
// (docs/05 §5.3).
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isCancel(error)) throw error;

    const adminError = toAdminError(error);
    const config = error.config;
    const isUnauthorized = adminError.status === 401 && config && !isAuthRequest(config);

    if (isUnauthorized && config.hasRetried) {
      // A fresh token was refused too: the account or its session is no longer valid.
      clearSession();
      redirectToLogin();
      throw adminError;
    }
    if (isUnauthorized) {
      config.hasRetried = true;
      try {
        await refresh();
      } catch (refreshError) {
        // refresh() has already cleared the session.
        redirectToLogin();
        throw toAdminError(refreshError);
      }
      return http.request(config);
    }
    throw adminError;
  },
);
