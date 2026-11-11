import { http } from '../../api/httpClient.js';

// M02 (refresh) is session.refresh() in src/api/session.js.

/**
 * M01 POST /auth/login
 * @param {{loginId: string, password: string}} body
 * @returns {Promise<object>} AdminSession `{admin, accessToken, expiresAt}` (docs/07 §16)
 */
export const login = (body) => http.post('/auth/login', body).then((response) => response.data);

/** M03 POST /auth/logout (204 No Content) */
export const logout = () => http.post('/auth/logout').then(() => undefined);

/**
 * M04 GET /me
 * @returns {Promise<{id: string, loginId: string, email: string}>}
 */
export const fetchMe = () => http.get('/me').then((response) => response.data);
