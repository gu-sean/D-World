import test from 'node:test';
import assert from 'node:assert/strict';

import { installFakeFetch } from './helpers/fakeFetch.js';
import { resetTestEnv, testEnv } from './helpers/fakeModules.js';
import * as session from '../src/client/auth/session.js';
import { loadTokens, saveTokens, KEYCHAIN_SERVICE } from '../src/client/auth/tokenStore.js';
import { request } from '../src/client/http/httpClient.js';

const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: '2026-11-04T03:00:00.000Z' };
const NEW_TOKENS = { accessToken: 'access-2', refreshToken: 'refresh-2', expiresAt: '2026-11-04T03:30:00.000Z' };
const PROFILE = { id: 'u1', nickname: '개발유저' };

/** session.js를 import 하면 setAuthProvider가 걸린다 — 매 테스트마다 상태만 되돌린다. */
function setup() {
  resetTestEnv();
  session.__resetSessionForTests();
  return installFakeFetch();
}

test('restore: 저장된 토큰이 없으면 signedOut', async () => {
  const http = setup();

  const status = await session.restore();

  assert.equal(status, 'signedOut');
  assert.equal(session.getSnapshot().status, 'signedOut');
  assert.equal(http.requests.length, 0, '토큰이 없으면 /me를 부르지 않는다');
  http.restore();
});

test('restore: 토큰이 있고 A11이 성공하면 signedIn', async () => {
  const http = setup();
  await saveTokens(TOKENS);
  http.on('GET', '/me', () => ({ status: 200, body: { id: 'u1', nickname: '개발유저' } }));

  const status = await session.restore();

  assert.equal(status, 'signedIn');
  assert.deepEqual(session.getSnapshot().profile, PROFILE);
  assert.equal(http.requests[0].headers.Authorization, 'Bearer access-1');
  http.restore();
});

test('restore: A11이 401이면 갱신하고 다시 부른다', async () => {
  const http = setup();
  await saveTokens(TOKENS);
  http.on('GET', '/me', ({ callNo }) =>
    callNo === 0
      ? { status: 401, body: { error: { code: 'AUTH_TOKEN_EXPIRED' } } }
      : { status: 200, body: { id: 'u1', nickname: '개발유저' } });
  http.on('POST', '/auth/token/refresh', () => ({ status: 200, body: { profile: PROFILE, tokens: NEW_TOKENS } }));

  const status = await session.restore();

  assert.equal(status, 'signedIn');
  assert.equal(http.find('POST', '/auth/token/refresh').length, 1);
  assert.deepEqual(await loadTokens(), NEW_TOKENS, '새 토큰이 키체인에 저장된다');
  http.restore();
});

test('restore: 갱신까지 실패하면 signedOut + 키체인 비움', async () => {
  const http = setup();
  await saveTokens(TOKENS);
  http.on('GET', '/me', () => ({ status: 401, body: { error: { code: 'AUTH_TOKEN_EXPIRED' } } }));
  http.on('POST', '/auth/token/refresh', () => ({ status: 401, body: { error: { code: 'AUTH_REFRESH_INVALID' } } }));

  const status = await session.restore();

  assert.equal(status, 'signedOut');
  assert.equal(await loadTokens(), null);
  http.restore();
});

test('restore: 인터넷이 없으면 토큰을 버리지 않는다', async () => {
  const http = setup();
  await saveTokens(TOKENS);
  http.on('GET', '/me', () => ({ networkError: true }));

  const status = await session.restore();

  assert.equal(status, 'signedIn');
  assert.deepEqual(await loadTokens(), TOKENS);
  http.restore();
});

test('401 동시 3개 → 갱신 요청은 1번 (parts/mobile-client §3.4)', async () => {
  const http = setup();
  await saveTokens(TOKENS);
  await session.signIn({ profile: PROFILE, tokens: TOKENS });

  const expired = { status: 401, body: { error: { code: 'AUTH_TOKEN_EXPIRED' } } };
  http.on('GET', '/home', ({ headers }) =>
    (headers.Authorization === 'Bearer access-1' ? expired : { status: 200, body: { ok: 'home' } }));
  http.on('GET', '/me/points', ({ headers }) =>
    (headers.Authorization === 'Bearer access-1' ? expired : { status: 200, body: { ok: 'points' } }));
  http.on('GET', '/me/streak', ({ headers }) =>
    (headers.Authorization === 'Bearer access-1' ? expired : { status: 200, body: { ok: 'streak' } }));
  http.on('POST', '/auth/token/refresh', async () => {
    await new Promise((r) => setTimeout(r, 10));
    return { status: 200, body: { profile: PROFILE, tokens: NEW_TOKENS } };
  });

  const results = await Promise.all([
    request({ method: 'GET', path: '/home' }),
    request({ method: 'GET', path: '/me/points' }),
    request({ method: 'GET', path: '/me/streak' }),
  ]);

  assert.deepEqual(results.map((r) => r.ok), ['home', 'points', 'streak']);
  assert.equal(http.find('POST', '/auth/token/refresh').length, 1, '갱신은 한 번만');
  assert.equal(session.getAccessToken(), 'access-2');
  http.restore();
});

test('갱신이 끝난 뒤에 온 401은 다시 갱신한다 (진행 중 공유만)', async () => {
  const http = setup();
  await session.signIn({ profile: PROFILE, tokens: TOKENS });
  http.on('POST', '/auth/token/refresh', () => ({ status: 200, body: { profile: PROFILE, tokens: NEW_TOKENS } }));

  assert.equal(await session.refresh(), true);
  assert.equal(await session.refresh(), true);

  assert.equal(http.find('POST', '/auth/token/refresh').length, 2);
  http.restore();
});

test('refresh: 리프레시 토큰이 없으면 false, 요청도 안 보낸다', async () => {
  const http = setup();

  assert.equal(await session.refresh(), false);
  assert.equal(http.requests.length, 0);
  http.restore();
});

test('signOut: 서버가 실패해도 로컬 토큰·캐시를 지우고 signedOut', async () => {
  const http = setup();
  const cleared = { count: 0 };
  session.attachQueryClient({ clear: () => { cleared.count += 1; } });
  await session.signIn({ profile: PROFILE, tokens: TOKENS });
  http.on('POST', '/auth/logout', () => ({ status: 500, body: { error: { code: 'COMMON_INTERNAL' } } }));

  await session.signOut();

  assert.equal(session.getSnapshot().status, 'signedOut');
  assert.equal(session.getSnapshot().profile, null);
  assert.equal(session.getAccessToken(), null);
  assert.equal(await loadTokens(), null);
  assert.equal(cleared.count, 1);
  assert.equal(http.find('POST', '/auth/logout').length, 1);
  http.restore();
});

test('signOut: 네트워크가 끊겨도 로그아웃된다', async () => {
  const http = setup();
  await session.signIn({ profile: PROFILE, tokens: TOKENS });
  http.on('POST', '/auth/logout', () => ({ networkError: true }));

  await session.signOut();

  assert.equal(session.getSnapshot().status, 'signedOut');
  assert.equal(await loadTokens(), null);
  http.restore();
});

test('subscribe: 상태가 바뀔 때마다 알려 주고, 해제하면 그친다', async () => {
  const http = setup();
  const seen = [];
  const unsubscribe = session.subscribe((snapshot) => seen.push(snapshot.status));

  await session.signIn({ profile: PROFILE, tokens: TOKENS });
  unsubscribe();
  await session.endSession();

  assert.deepEqual(seen, ['signedIn']);
  assert.equal(session.getSnapshot().status, 'signedOut');
  http.restore();
});

test('getSnapshot: 바뀌지 않으면 같은 객체를 돌려준다 (useSyncExternalStore 용)', async () => {
  setup();
  const a = session.getSnapshot();
  const b = session.getSnapshot();
  assert.equal(a, b);
  await session.signIn({ profile: PROFILE, tokens: TOKENS });
  assert.notEqual(session.getSnapshot(), a);
});

test('토큰은 키체인 서비스 dworld.session에 한 덩어리 JSON으로 저장한다', async () => {
  setup();
  await session.signIn({ profile: PROFILE, tokens: TOKENS });

  const entry = testEnv().keychain[KEYCHAIN_SERVICE];
  assert.ok(entry, '키체인에 저장되지 않았어요');
  assert.deepEqual(JSON.parse(entry.password), TOKENS);
});

test('키체인 값이 깨졌으면 지우고 signedOut', async () => {
  const http = setup();
  testEnv().keychain[KEYCHAIN_SERVICE] = { username: 'tokens', password: '{깨진 JSON' };

  const status = await session.restore();

  assert.equal(status, 'signedOut');
  assert.equal(testEnv().keychain[KEYCHAIN_SERVICE], undefined);
  http.restore();
});
