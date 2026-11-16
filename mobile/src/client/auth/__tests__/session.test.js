/**
 * 로그인 유지 규칙: 토큰이 정말 무효일 때만 로그아웃하고,
 * 인터넷 끊김·서버 일시 오류(5xx)로는 로그인을 풀지 않는다.
 *
 * fetch를 가짜로 바꿔 서버 응답을 흉내 낸다. 키체인·환경값 모듈은 가짜로 둔다.
 */
jest.mock('react-native-keychain', () => {
  let stored = null;
  return {
    setGenericPassword: jest.fn(async (_u, p) => {
      stored = p;
      return true;
    }),
    getGenericPassword: jest.fn(async () => (stored ? { username: 'tokens', password: stored } : false)),
    resetGenericPassword: jest.fn(async () => {
      stored = null;
      return true;
    }),
    ACCESSIBLE: {},
  };
}, { virtual: true });
jest.mock('react-native-config', () => ({ API_BASE_URL: 'http://test/api/v1' }), { virtual: true });
jest.mock('uuid', () => {
  let n = 0;
  return { v4: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` };
});

const tokens = { accessToken: 'old-access', refreshToken: 'refresh-1', expiresAt: '2099-01-01T00:00:00Z' };

function json(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}
const expired = () => json(401, { error: { code: 'AUTH_TOKEN_EXPIRED', message: '만료' } });
const me = () => json(200, { id: 'u1', nickname: '홍길동' });

let session;
let request;

beforeEach(async () => {
  jest.resetModules();
  global.fetch = jest.fn();
  session = require('../session.js');
  ({ request } = require('../../http/httpClient.js'));
  session.__resetSessionForTests();
  // 재설정이 지운 등록을 되살린다
  require('../../http/httpClient.js').setAuthProvider({
    getAccessToken: session.getAccessToken,
    refresh: session.refresh,
    endSession: session.endSession,
  });
  await session.signIn({ profile: { id: 'u1', nickname: '홍길동' }, tokens });
});

/** URL에 따라 응답을 고른다 */
function route(handlers) {
  global.fetch.mockImplementation(async (url) => {
    for (const [part, respond] of handlers) {
      if (String(url).includes(part)) return respond();
    }
    throw new Error(`예상하지 못한 요청: ${url}`);
  });
}

test('토큰 갱신 중 인터넷이 끊기면 로그인을 유지하고 연결 오류를 던진다', async () => {
  route([
    ['/auth/token/refresh', () => Promise.reject(new TypeError('Network request failed'))],
    ['/me', expired],
  ]);
  await expect(request({ method: 'GET', path: '/me' })).rejects.toMatchObject({ isNetwork: true });
  expect(session.getSnapshot().status).toBe('signedIn');
  expect(session.getAccessToken()).toBe('old-access');
});

test('토큰 갱신 때 서버가 5xx를 내도 로그인을 유지한다', async () => {
  route([
    ['/auth/token/refresh', () => json(503, { error: { code: 'COMMON_UNAVAILABLE', message: '점검' } })],
    ['/me', expired],
  ]);
  await expect(request({ method: 'GET', path: '/me' })).rejects.toMatchObject({ status: 503 });
  expect(session.getSnapshot().status).toBe('signedIn');
});

test('리프레시 토큰이 무효면 로그아웃한다', async () => {
  route([
    ['/auth/token/refresh', () => json(401, { error: { code: 'AUTH_REFRESH_INVALID', message: '무효' } })],
    ['/me', expired],
  ]);
  await expect(request({ method: 'GET', path: '/me' })).rejects.toMatchObject({
    code: 'AUTH_SESSION_EXPIRED',
  });
  expect(session.getSnapshot().status).toBe('signedOut');
});

test('갱신에 성공하면 같은 요청을 다시 보내 결과를 받는다', async () => {
  let meCalls = 0;
  route([
    ['/auth/token/refresh', () => json(200, { tokens: { ...tokens, accessToken: 'new-access' } })],
    ['/me', () => (++meCalls === 1 ? expired() : me())],
  ]);
  await expect(request({ method: 'GET', path: '/me' })).resolves.toMatchObject({ id: 'u1' });
  expect(session.getAccessToken()).toBe('new-access');
});

test('앱 시작 때 서버가 5xx를 내면 로그인을 유지한다', async () => {
  route([['/me', () => json(500, { error: { code: 'COMMON_INTERNAL', message: '오류' } })]]);
  await expect(session.restore()).resolves.toBe('signedIn');
});

test('앱 시작 때 인터넷이 없으면 로그인을 유지한다', async () => {
  route([['/me', () => Promise.reject(new TypeError('Network request failed'))]]);
  await expect(session.restore()).resolves.toBe('signedIn');
});

test('앱 시작 때 토큰이 무효면 로그아웃한다', async () => {
  route([['/me', () => json(401, { error: { code: 'AUTH_UNAUTHORIZED', message: '무효' } })]]);
  await expect(session.restore()).resolves.toBe('signedOut');
});
