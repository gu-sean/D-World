import test from 'node:test';
import assert from 'node:assert/strict';

import { installFakeFetch } from './helpers/fakeFetch.js';
import { resetTestEnv } from './helpers/fakeModules.js';
import {
  request,
  buildQueryString,
  setAuthProvider,
  clearAuthProvider,
} from '../src/client/http/httpClient.js';
import AppError from '../src/client/http/AppError.js';

function setup() {
  resetTestEnv();
  clearAuthProvider();
  return installFakeFetch();
}

test('buildQueryString: 빈 값은 빼고, 배열은 쉼표로 잇는다 (05 §6)', () => {
  assert.equal(buildQueryString(), '');
  assert.equal(buildQueryString({}), '');
  assert.equal(
    buildQueryString({ date: '2026-11-04', goalId: undefined, note: null, empty: '' }),
    '?date=2026-11-04',
  );
  assert.equal(buildQueryString({ status: ['active', 'paused'] }), '?status=active%2Cpaused');
  assert.equal(buildQueryString({ status: [] }), '');
  assert.equal(buildQueryString({ limit: 20, unreadOnly: false }), '?limit=20&unreadOnly=false');
});

test('공통 헤더: Accept·X-Request-Id, 본문이 있으면 Content-Type', async () => {
  const http = setup();
  http.on('POST', '/goals', () => ({ status: 201, body: { id: 'g1' } }));

  await request({ method: 'POST', path: '/goals', body: { title: '목표' }, auth: false });

  const [req] = http.requests;
  assert.equal(req.headers.Accept, 'application/json');
  assert.equal(req.headers['Content-Type'], 'application/json');
  assert.match(req.headers['X-Request-Id'], /^uuid-\d{4}$/);
  assert.equal(req.headers.Authorization, undefined);
  assert.deepEqual(req.body, { title: '목표' });
  http.restore();
});

test('본문이 없으면 Content-Type을 붙이지 않는다', async () => {
  const http = setup();
  http.on('GET', '/me', () => ({ status: 200, body: { id: 'u1' } }));

  await request({ method: 'GET', path: '/me', auth: false });

  assert.equal(http.requests[0].headers['Content-Type'], undefined);
  http.restore();
});

test('auth 기본값은 true — 세션 토큰을 Authorization에 넣는다', async () => {
  const http = setup();
  setAuthProvider({
    getAccessToken: () => 'access-token-1',
    refresh: async () => false,
    endSession: async () => {},
  });
  http.on('GET', '/me', () => ({ status: 200, body: { id: 'u1' } }));

  await request({ method: 'GET', path: '/me' });

  assert.equal(http.requests[0].headers.Authorization, 'Bearer access-token-1');
  http.restore();
});

test('idempotent: 넘긴 키를 그대로 쓰고, 없으면 새로 만든다 (05 §5.1)', async () => {
  const http = setup();
  http.on('POST', '/goals', () => ({ status: 201, body: {} }));

  await request({ method: 'POST', path: '/goals', body: {}, auth: false, idempotent: true, idempotencyKey: 'key-1' });
  await request({ method: 'POST', path: '/goals', body: {}, auth: false, idempotent: true });
  await request({ method: 'POST', path: '/goals', body: {}, auth: false });

  assert.equal(http.requests[0].headers['Idempotency-Key'], 'key-1');
  assert.match(http.requests[1].headers['Idempotency-Key'], /^uuid-\d{4}$/);
  assert.equal(http.requests[2].headers['Idempotency-Key'], undefined);
  http.restore();
});

test('204는 null, 본문 없는 200도 null', async () => {
  const http = setup();
  http.on('POST', '/auth/logout', () => ({ status: 204 }));
  http.on('GET', '/empty', () => ({ status: 200 }));

  assert.equal(await request({ method: 'POST', path: '/auth/logout', auth: false }), null);
  assert.equal(await request({ method: 'GET', path: '/empty', auth: false }), null);
  http.restore();
});

test('오류 본문 → AppError (code·status·message·details)', async () => {
  const http = setup();
  http.on('POST', '/missions/m1/records', () => ({
    status: 409,
    body: { error: { code: 'MISSION_NOT_STARTABLE', message: '오늘 할 수 있는 미션이 아니에요.', details: { reason: 'not_today' } } },
  }));

  const error = await request({ method: 'POST', path: '/missions/m1/records', auth: false }).catch((e) => e);

  assert.ok(error instanceof AppError);
  assert.equal(error.code, 'MISSION_NOT_STARTABLE');
  assert.equal(error.status, 409);
  assert.equal(error.message, '오늘 할 수 있는 미션이 아니에요.');
  assert.deepEqual(error.details, { reason: 'not_today' });
  http.restore();
});

test('오류 본문 모양이 다르면 COMMON_INTERNAL (parts/mobile-client §3.1 5번)', async () => {
  const http = setup();
  http.on('GET', '/broken', () => ({ status: 500, body: { oops: true } }));
  http.on('GET', '/empty-error', () => ({ status: 503 }));

  const a = await request({ method: 'GET', path: '/broken', auth: false }).catch((e) => e);
  const b = await request({ method: 'GET', path: '/empty-error', auth: false }).catch((e) => e);

  assert.equal(a.code, 'COMMON_INTERNAL');
  assert.equal(a.status, 500);
  assert.equal(a.message, '잠시 후 다시 시도해 주세요.');
  assert.equal(b.code, 'COMMON_INTERNAL');
  http.restore();
});

test('서버 message가 없으면 errorMessages.js 문구를 쓴다', async () => {
  const http = setup();
  http.on('GET', '/x', () => ({ status: 404, body: { error: { code: 'COMMON_NOT_FOUND' } } }));

  const error = await request({ method: 'GET', path: '/x', auth: false }).catch((e) => e);

  assert.equal(error.message, '찾을 수 없어요.');
  assert.deepEqual(error.details, {});
  http.restore();
});

test('네트워크 오류 → NETWORK_ERROR(status 0)', async () => {
  const http = setup();
  http.on('GET', '/me', () => ({ networkError: true }));

  const error = await request({ method: 'GET', path: '/me', auth: false }).catch((e) => e);

  assert.equal(error.code, 'NETWORK_ERROR');
  assert.equal(error.status, 0);
  assert.equal(error.isNetwork, true);
  http.restore();
});

test('타임아웃 → NETWORK_TIMEOUT(status 0)', async () => {
  const http = setup();
  http.on('GET', '/slow', () => ({ hang: true }));

  const error = await request({ method: 'GET', path: '/slow', auth: false, timeoutMs: 20 }).catch((e) => e);

  assert.equal(error.code, 'NETWORK_TIMEOUT');
  assert.equal(error.status, 0);
  http.restore();
});

test('401 AUTH_TOKEN_EXPIRED → 갱신 후 한 번만 재시도', async () => {
  const http = setup();
  let token = 'old';
  let refreshCalls = 0;
  setAuthProvider({
    getAccessToken: () => token,
    refresh: async () => { refreshCalls += 1; token = 'new'; return true; },
    endSession: async () => {},
  });
  http.on('GET', '/me', ({ callNo }) =>
    callNo === 0
      ? { status: 401, body: { error: { code: 'AUTH_TOKEN_EXPIRED' } } }
      : { status: 200, body: { id: 'u1' } });

  const me = await request({ method: 'GET', path: '/me' });

  assert.deepEqual(me, { id: 'u1' });
  assert.equal(refreshCalls, 1);
  assert.equal(http.requests.length, 2);
  assert.equal(http.requests[0].headers.Authorization, 'Bearer old');
  assert.equal(http.requests[1].headers.Authorization, 'Bearer new');
  http.restore();
});

test('갱신 실패 → 세션 종료 + AUTH_SESSION_EXPIRED', async () => {
  const http = setup();
  let ended = 0;
  setAuthProvider({
    getAccessToken: () => 'old',
    refresh: async () => false,
    endSession: async () => { ended += 1; },
  });
  http.on('GET', '/me', () => ({ status: 401, body: { error: { code: 'AUTH_TOKEN_EXPIRED' } } }));

  const error = await request({ method: 'GET', path: '/me' }).catch((e) => e);

  assert.equal(error.code, 'AUTH_SESSION_EXPIRED');
  assert.equal(ended, 1);
  assert.equal(http.requests.length, 1);
  http.restore();
});

test('재시도한 요청이 또 401이면 더는 갱신하지 않는다', async () => {
  const http = setup();
  let refreshCalls = 0;
  setAuthProvider({
    getAccessToken: () => 'tok',
    refresh: async () => { refreshCalls += 1; return true; },
    endSession: async () => {},
  });
  http.on('GET', '/me', () => ({ status: 401, body: { error: { code: 'AUTH_TOKEN_EXPIRED' } } }));

  const error = await request({ method: 'GET', path: '/me' }).catch((e) => e);

  assert.equal(error.code, 'AUTH_TOKEN_EXPIRED');
  assert.equal(refreshCalls, 1);
  assert.equal(http.requests.length, 2);
  http.restore();
});

test('401이어도 코드가 AUTH_TOKEN_EXPIRED가 아니면 갱신하지 않는다', async () => {
  const http = setup();
  let refreshCalls = 0;
  setAuthProvider({
    getAccessToken: () => 'tok',
    refresh: async () => { refreshCalls += 1; return true; },
    endSession: async () => {},
  });
  http.on('GET', '/me', () => ({ status: 401, body: { error: { code: 'COMMON_UNAUTHORIZED' } } }));

  const error = await request({ method: 'GET', path: '/me' }).catch((e) => e);

  assert.equal(error.code, 'COMMON_UNAUTHORIZED');
  assert.equal(refreshCalls, 0);
  http.restore();
});

test('withHeaders: 응답 헤더를 함께 돌려준다 (A110 X-Unread-Count)', async () => {
  const http = setup();
  http.on('GET', '/me/notifications', () => ({
    status: 200,
    body: { items: [], nextCursor: null },
    headers: { 'X-Unread-Count': '7' },
  }));

  const { data, headers } = await request({
    method: 'GET', path: '/me/notifications', auth: false, withHeaders: true,
  });

  assert.deepEqual(data, { items: [], nextCursor: null });
  assert.equal(headers('X-Unread-Count'), '7');
  assert.equal(headers('x-unread-count'), '7');
  http.restore();
});

test('주소는 API_BASE_URL + path + 쿼리', async () => {
  const http = setup();
  http.on('GET', '/missions', () => ({ status: 200, body: { items: [], nextCursor: null } }));

  await request({ method: 'GET', path: '/missions', query: { date: '2026-11-04', limit: 50 }, auth: false });

  assert.equal(http.requests[0].url, 'http://test.local/api/v1/missions?date=2026-11-04&limit=50');
  http.restore();
});
