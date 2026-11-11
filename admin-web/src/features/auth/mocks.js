import { delay, http as mswHttp, HttpResponse } from 'msw';

// MSW handlers for M01~M04 (docs/09 §1). Used with VITE_USE_MSW=true, no backend needed.
const BASE = import.meta.env.VITE_ADMIN_API_BASE_URL ?? '/admin/v1';

// Development account of docs/12 §9.
const DEV_LOGIN_ID = 'dev_admin';
const DEV_PASSWORD = 'devadmin1234';
const ADMIN = {
  id: '3f2c6a2e-0000-4000-8000-000000000001',
  loginId: DEV_LOGIN_ID,
  email: 'd***@dworld.example',
};

// Stands in for the HttpOnly refresh cookie (a mock cannot set a real one). It survives a page
// reload but not closing the tab, like a session cookie.
const COOKIE_FLAG = 'dw_mock_admin_refresh';
const hasRefreshCookie = () => {
  try {
    return sessionStorage.getItem(COOKIE_FLAG) === '1';
  } catch {
    return false;
  }
};
const setRefreshCookie = (on) => {
  try {
    if (on) sessionStorage.setItem(COOKIE_FLAG, '1');
    else sessionStorage.removeItem(COOKIE_FLAG);
  } catch {
    // Storage is unavailable: the mock simply forgets the cookie.
  }
};

const makeSession = () => ({
  admin: ADMIN,
  accessToken: `mock-access-${Date.now()}`,
  expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
});

const errorResponse = (status, code, message) =>
  HttpResponse.json({ error: { code, message, details: null } }, { status });

export const handlers = [
  mswHttp.post(`${BASE}/auth/login`, async ({ request }) => {
    await delay(300);
    const body = await request.json();
    if (body.loginId === DEV_LOGIN_ID && body.password === DEV_PASSWORD) {
      setRefreshCookie(true);
      return HttpResponse.json(makeSession());
    }
    return errorResponse(
      401,
      'AUTH_INVALID_CREDENTIALS',
      '휴대폰 번호 또는 비밀번호가 맞지 않아요.',
    );
  }),

  mswHttp.post(`${BASE}/auth/refresh`, () => {
    if (!hasRefreshCookie()) {
      return errorResponse(401, 'AUTH_REFRESH_INVALID', '다시 로그인해 주세요.');
    }
    return HttpResponse.json(makeSession());
  }),

  mswHttp.post(`${BASE}/auth/logout`, () => {
    setRefreshCookie(false);
    return new HttpResponse(null, { status: 204 });
  }),

  mswHttp.get(`${BASE}/me`, ({ request }) => {
    if (!request.headers.get('authorization')) {
      return errorResponse(401, 'COMMON_UNAUTHORIZED', '로그인이 필요해요.');
    }
    return HttpResponse.json(ADMIN);
  }),
];
