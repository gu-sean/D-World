import { delay, http as mswHttp, HttpResponse } from 'msw';
import { server } from '../test/setup.js';
import { toAdminError } from './errors.js';

const BASE = '/admin/v1';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const makeSession = (accessToken) => ({
  admin: {
    id: '3f2c6a2e-0000-4000-8000-000000000001',
    loginId: 'dev_admin',
    email: 'd***@example.com',
  },
  accessToken,
  expiresAt: '2026-11-04T02:30:00.000Z',
});

const errorResponse = (status, code) =>
  HttpResponse.json({ error: { code, message: `message of ${code}`, details: null } }, { status });

let http;
let session;
let setOnAuthFailure;
let refreshCalls;

// M02 answering with a new session. The short delay lets parallel requests overlap.
const refreshSucceeds = (newToken) =>
  mswHttp.post(`${BASE}/auth/refresh`, async () => {
    refreshCalls += 1;
    await delay(20);
    return HttpResponse.json(makeSession(newToken));
  });

const refreshFails = () =>
  mswHttp.post(`${BASE}/auth/refresh`, () => {
    refreshCalls += 1;
    return errorResponse(401, 'AUTH_REFRESH_INVALID');
  });

beforeAll(async () => {
  // httpClient.js reads the base URL when it is loaded, so stub it before importing.
  vi.stubEnv('VITE_ADMIN_API_BASE_URL', BASE);
  ({ http, setOnAuthFailure } = await import('./httpClient.js'));
  session = await import('./session.js');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  refreshCalls = 0;
  session.clearSession();
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  setOnAuthFailure();
  vi.restoreAllMocks();
});

describe('request headers', () => {
  test('GET sends Authorization and X-Request-Id but no Idempotency-Key', async () => {
    session.setSession(makeSession('token-1'));
    let headers;
    server.use(
      mswHttp.get(`${BASE}/users`, ({ request }) => {
        headers = request.headers;
        return HttpResponse.json({ items: [] });
      }),
    );

    await http.get('/users');

    expect(headers.get('authorization')).toBe('Bearer token-1');
    expect(headers.get('x-request-id')).toMatch(UUID_V4);
    expect(headers.get('idempotency-key')).toBeNull();
  });

  test('login sends no Authorization and no Idempotency-Key, and does not warn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let headers;
    server.use(
      mswHttp.post(`${BASE}/auth/login`, ({ request }) => {
        headers = request.headers;
        return HttpResponse.json(makeSession('token-1'));
      }),
    );

    await http.post('/auth/login', { loginId: 'dev_admin', password: 'secret' });

    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('idempotency-key')).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  test('a mutating request sends the Idempotency-Key it was given', async () => {
    let headers;
    server.use(
      mswHttp.post(`${BASE}/users/u1/account-actions`, ({ request }) => {
        headers = request.headers;
        return HttpResponse.json({ id: 'a1' }, { status: 201 });
      }),
    );

    await http.post('/users/u1/account-actions', { reason: 'test' }, { idempotencyKey: 'key-1' });

    expect(headers.get('idempotency-key')).toBe('key-1');
  });

  test('a mutating request without a key gets a new UUID and warns in development', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let headers;
    server.use(
      mswHttp.patch(`${BASE}/notices/n1`, ({ request }) => {
        headers = request.headers;
        return HttpResponse.json({ id: 'n1' });
      }),
    );

    await http.patch('/notices/n1', { reason: 'test' });

    expect(headers.get('idempotency-key')).toMatch(UUID_V4);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('401 AUTH_TOKEN_EXPIRED', () => {
  test('refreshes the session once and repeats the request with the new token', async () => {
    session.setSession(makeSession('old-token'));
    const seenAuthorizations = [];
    server.use(
      mswHttp.get(`${BASE}/users`, ({ request }) => {
        const authorization = request.headers.get('authorization');
        seenAuthorizations.push(authorization);
        if (authorization === 'Bearer old-token') return errorResponse(401, 'AUTH_TOKEN_EXPIRED');
        return HttpResponse.json({ items: [] });
      }),
      refreshSucceeds('new-token'),
    );

    const response = await http.get('/users');

    expect(response.data).toEqual({ items: [] });
    expect(seenAuthorizations).toEqual(['Bearer old-token', 'Bearer new-token']);
    expect(refreshCalls).toBe(1);
    expect(session.getAccessToken()).toBe('new-token');
  });

  test('the repeated request keeps the same Idempotency-Key', async () => {
    session.setSession(makeSession('old-token'));
    const seenKeys = [];
    server.use(
      mswHttp.post(`${BASE}/notices`, ({ request }) => {
        seenKeys.push(request.headers.get('idempotency-key'));
        if (request.headers.get('authorization') === 'Bearer old-token') {
          return errorResponse(401, 'AUTH_TOKEN_EXPIRED');
        }
        return HttpResponse.json({ id: 'n1' }, { status: 201 });
      }),
      refreshSucceeds('new-token'),
    );

    await http.post('/notices', { reason: 'test' }, { idempotencyKey: 'key-1' });

    expect(seenKeys).toEqual(['key-1', 'key-1']);
  });

  test('parallel requests share a single refresh', async () => {
    session.setSession(makeSession('old-token'));
    const handleRequest = ({ request }) => {
      if (request.headers.get('authorization') === 'Bearer old-token') {
        return errorResponse(401, 'AUTH_TOKEN_EXPIRED');
      }
      return HttpResponse.json({ ok: true });
    };
    server.use(
      mswHttp.get(`${BASE}/users`, handleRequest),
      mswHttp.get(`${BASE}/notices`, handleRequest),
      refreshSucceeds('new-token'),
    );

    const [users, notices] = await Promise.all([http.get('/users'), http.get('/notices')]);

    expect(users.data).toEqual({ ok: true });
    expect(notices.data).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
  });

  test('a second AUTH_TOKEN_EXPIRED after refreshing is not repeated again', async () => {
    session.setSession(makeSession('old-token'));
    server.use(
      mswHttp.get(`${BASE}/users`, () => errorResponse(401, 'AUTH_TOKEN_EXPIRED')),
      refreshSucceeds('new-token'),
    );

    await expect(http.get('/users')).rejects.toMatchObject({
      code: 'AUTH_TOKEN_EXPIRED',
      status: 401,
    });
    expect(refreshCalls).toBe(1);
  });

  test('refresh failure clears the session and goes to /login with the current path', async () => {
    window.history.pushState({}, '', '/users?page=2');
    const onAuthFailure = vi.fn();
    setOnAuthFailure(onAuthFailure);
    session.setSession(makeSession('old-token'));
    server.use(
      mswHttp.get(`${BASE}/users`, () => errorResponse(401, 'AUTH_TOKEN_EXPIRED')),
      refreshFails(),
    );

    await expect(http.get('/users')).rejects.toMatchObject({
      code: 'AUTH_REFRESH_INVALID',
      status: 401,
    });

    expect(session.getAccessToken()).toBeNull();
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).toHaveBeenCalledWith('/login?next=%2Fusers%3Fpage%3D2');
  });

  test('refresh failure on the login page does not redirect again', async () => {
    window.history.pushState({}, '', '/login');
    const onAuthFailure = vi.fn();
    setOnAuthFailure(onAuthFailure);
    session.setSession(makeSession('old-token'));
    server.use(
      mswHttp.get(`${BASE}/me`, () => errorResponse(401, 'AUTH_TOKEN_EXPIRED')),
      refreshFails(),
    );

    await expect(http.get('/me')).rejects.toMatchObject({ code: 'AUTH_REFRESH_INVALID' });

    expect(onAuthFailure).not.toHaveBeenCalled();
  });
});

describe('other errors', () => {
  test('a 401 with another code does not refresh', async () => {
    server.use(
      mswHttp.get(`${BASE}/users`, () => errorResponse(401, 'COMMON_UNAUTHORIZED')),
      refreshSucceeds('new-token'),
    );

    await expect(http.get('/users')).rejects.toMatchObject({ code: 'COMMON_UNAUTHORIZED' });
    expect(refreshCalls).toBe(0);
  });

  test('a server error body becomes {code, message, details, status}', async () => {
    server.use(
      mswHttp.post(`${BASE}/users/u1/account-actions`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'ADMIN_REASON_REQUIRED',
              message: '사유를 입력해 주세요.',
              details: { fields: { reason: 'required' } },
            },
          },
          { status: 400 },
        ),
      ),
    );

    await expect(
      http.post('/users/u1/account-actions', {}, { idempotencyKey: 'key-1' }),
    ).rejects.toMatchObject({
      code: 'ADMIN_REASON_REQUIRED',
      message: '사유를 입력해 주세요.',
      details: { fields: { reason: 'required' } },
      status: 400,
    });
  });

  test('a network failure becomes NETWORK_ERROR with status 0', async () => {
    server.use(mswHttp.get(`${BASE}/users`, () => HttpResponse.error()));

    await expect(http.get('/users')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });
});

describe('toAdminError', () => {
  test('uses the standard error body', () => {
    const error = toAdminError({
      response: {
        status: 409,
        data: { error: { code: 'ADMIN_STATE_CONFLICT', message: 'conflict', details: null } },
      },
    });

    expect(error).toMatchObject({
      code: 'ADMIN_STATE_CONFLICT',
      message: 'conflict',
      details: null,
      status: 409,
    });
  });

  test('maps a response without an error body to a COMMON_* code', () => {
    expect(toAdminError({ response: { status: 403, data: '' } })).toMatchObject({
      code: 'COMMON_FORBIDDEN',
      status: 403,
    });
    expect(toAdminError({ response: { status: 502, data: '<html></html>' } })).toMatchObject({
      code: 'COMMON_INTERNAL',
      status: 502,
    });
  });

  test('maps a timeout to NETWORK_TIMEOUT', () => {
    expect(toAdminError({ code: 'ECONNABORTED' })).toMatchObject({
      code: 'NETWORK_TIMEOUT',
      status: 0,
    });
  });

  test('returns an AdminError unchanged', () => {
    const error = toAdminError({ code: 'ECONNABORTED' });

    expect(toAdminError(error)).toBe(error);
  });
});
