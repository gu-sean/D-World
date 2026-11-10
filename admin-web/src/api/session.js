import axios from 'axios';
import { toAdminError } from './errors.js';

// Plain client without interceptors: refreshing the token must never trigger another refresh.
const authClient = axios.create({
  baseURL: import.meta.env.VITE_ADMIN_API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
});

// AdminSession `{admin, accessToken, expiresAt}` (docs/07 §16). Memory only: never put the
// access token in localStorage or sessionStorage (docs/05 §4). The refresh token is an
// HttpOnly cookie, so the browser keeps it and this code never sees it.
let session = null;
let refreshPromise = null;

/** @returns {string|null} */
export const getAccessToken = () => session?.accessToken ?? null;

/** @returns {{id: string, loginId: string, email: string}|null} */
export const getAdmin = () => session?.admin ?? null;

/** @param {{admin: object, accessToken: string, expiresAt: string}} nextSession */
export function setSession(nextSession) {
  session = nextSession;
}

export function clearSession() {
  session = null;
}

/**
 * M02 POST /auth/refresh (uses the refresh cookie). Only one refresh runs at a time:
 * callers that arrive while it is running get the same promise.
 * On failure the session is cleared and an AdminError is thrown.
 * @returns {Promise<{admin: object, accessToken: string, expiresAt: string}>}
 */
export function refresh() {
  if (!refreshPromise) {
    refreshPromise = authClient
      .post('/auth/refresh')
      .then((response) => {
        setSession(response.data);
        return response.data;
      })
      .catch((error) => {
        clearSession();
        throw toAdminError(error);
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}
