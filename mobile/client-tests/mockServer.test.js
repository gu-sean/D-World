import test from 'node:test';
import assert from 'node:assert/strict';

import { resetTestEnv } from './helpers/fakeModules.js';
import { mockServer } from '../src/client/mock/mockServer.js';
import { todayKst } from '../src/client/format/format.js';
import { decisionFor, DECISION_DELAY_MS } from '../src/client/mock/fixtures/records.js';

/**
 * 08에 적힌 GET 경로 전부. `{xxxId}` 자리는 실제로 불러 볼 값으로 채운다.
 * 여기 줄이 늘면 mockServer.js에도 응답을 더해야 한다.
 */
const GET_PATHS = [
  ['A03', '/auth/nickname-availability', { nickname: '새닉네임' }],
  ['A04', '/policy-documents/current'],
  ['A11', '/me'],
  ['A17', '/goal-categories'],
  ['A18', '/difficulty-levels'],
  ['A19', '/exercise-types'],
  ['A21', '/goals'],
  ['A23', '/goals/goal-0001'],
  ['A26', '/goals/goal-0001/plan-proposals/latest'],
  ['A29', '/home'],
  ['A30', '/missions'],
  ['A32', '/missions/mission-0001'],
  ['A35', '/mission-definitions'],
  ['A36', '/recommendations/next-missions'],
  ['A50', '/plan-adjustments'],
  ['A51', '/plan-adjustments/adjustment-0001'],
  ['A60', '/reports/summary'],
  ['A61', '/ai-reports'],
  ['A62', '/ai-reports/ai-report-0001'],
  ['A64', '/calendar', { month: '2026-11' }],
  ['A70', '/shop/items'],
  ['A72', '/me/inventory'],
  ['A73', '/me/points'],
  ['A74', '/me/point-transactions'],
  ['A75', '/me/streak'],
  ['A76', '/achievements'],
  ['A80', '/me/pets'],
  ['A81', '/pet-species'],
  ['A82', '/pet-species/species-0001'],
  ['A85', '/me/pets/pet-0001/evolution-events'],
  ['A93', '/recommendations/active'],
  ['A100', '/challenges'],
  ['A101', '/challenges/challenge-0001'],
  ['A104', '/me/challenges'],
  ['A105', '/challenges/challenge-0001/rankings'],
  ['A107', '/me/challenges/challenge-0001/result'],
  ['A110', '/me/notifications'],
  ['A113', '/notices'],
  ['A114', '/notices/notice-0001'],
  ['A121', '/me/support-tickets'],
  ['A122', '/support-tickets/ticket-0001'],
];

function setup() {
  resetTestEnv();
  mockServer.reset();
}

test('08의 모든 GET 경로에 가짜 응답이 있다', async () => {
  setup();
  for (const [id, path, query] of GET_PATHS) {
    const res = await mockServer.handle({ method: 'GET', path, query: query ?? {} });
    assert.equal(res.status, 200, `${id} GET ${path} → ${res.status} ${JSON.stringify(res.body)}`);
    assert.notEqual(res.body, undefined, `${id} GET ${path}: 본문이 없어요`);
  }
});

test('A130 구독만 501 COMMON_NOT_IMPLEMENTED', async () => {
  setup();
  const res = await mockServer.handle({ method: 'GET', path: '/me/subscription' });
  assert.equal(res.status, 501);
  assert.equal(res.body.error.code, 'COMMON_NOT_IMPLEMENTED');
});

test('모르는 경로는 404 COMMON_NOT_FOUND', async () => {
  setup();
  const res = await mockServer.handle({ method: 'GET', path: '/nope' });
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'COMMON_NOT_FOUND');
});

test('목록 응답은 Page<T> 모양 {items, nextCursor} (07 §1)', async () => {
  setup();
  const res = await mockServer.handle({ method: 'GET', path: '/missions', query: {} });
  assert.ok(Array.isArray(res.body.items));
  assert.ok('nextCursor' in res.body);
});

test('A110은 X-Unread-Count 헤더를 준다', async () => {
  setup();
  const res = await mockServer.handle({ method: 'GET', path: '/me/notifications', query: {} });
  assert.equal(res.headers['X-Unread-Count'], '1');
});

test('A06 로그인: 개발 계정이면 Session, 아니면 AUTH_INVALID_CREDENTIALS (12 §9)', async () => {
  setup();
  const good = await mockServer.handle({
    method: 'POST', path: '/auth/login', body: { phoneNumber: '01000000001', password: 'devuser1234' },
  });
  assert.equal(good.status, 200);
  assert.equal(good.body.profile.nickname, '개발유저');
  assert.ok(good.body.tokens.accessToken);

  const bad = await mockServer.handle({
    method: 'POST', path: '/auth/login', body: { phoneNumber: '01000000001', password: 'wrong' },
  });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error.code, 'AUTH_INVALID_CREDENTIALS');
});

test('A02 인증번호: 개발 고정값 000000만 통과', async () => {
  setup();
  const good = await mockServer.handle({ method: 'POST', path: '/auth/phone-verifications/v1/confirm', body: { code: '000000' } });
  assert.equal(good.status, 200);
  assert.equal(good.body.accountStatus, 'new');
  assert.ok(good.body.verificationToken);

  const bad = await mockServer.handle({ method: 'POST', path: '/auth/phone-verifications/v1/confirm', body: { code: '111111' } });
  assert.equal(bad.body.error.code, 'AUTH_OTP_INVALID');
});

test('A20 목표 등록 → A21 목록에 보인다', async () => {
  setup();
  const made = await mockServer.handle({
    method: 'POST', path: '/goals', body: { title: '새 목표', categoryCode: 'study', difficultyCode: 'easy' },
  });
  assert.equal(made.status, 201);

  const list = await mockServer.handle({ method: 'GET', path: '/goals', query: {} });
  assert.equal(list.body.items[0].title, '새 목표');
});

test('A31 미션 등록 → A30 목록·A29 홈에 보인다', async () => {
  setup();
  const today = todayKst();
  const made = await mockServer.handle({
    method: 'POST', path: '/missions',
    body: { title: '물 마시기', categoryCode: 'lifestyle', difficultyCode: 'easy', targetValue: 8, targetUnit: 'times', scheduledDate: today },
  });
  assert.equal(made.status, 201);

  const list = await mockServer.handle({ method: 'GET', path: '/missions', query: { date: today } });
  assert.ok(list.body.items.some((m) => m.title === '물 마시기'));

  const home = await mockServer.handle({ method: 'GET', path: '/home', query: {} });
  assert.ok(home.body.missions.some((m) => m.title === '물 마시기'));
  assert.equal(home.body.week.length, 7);
});

test('A40 → A43 → A44 → A45 → A41: 6초 전에는 판정이 없다', async () => {
  setup();
  const started = await mockServer.handle({ method: 'POST', path: '/missions/mission-0001/records' });
  assert.equal(started.status, 201);
  const recordId = started.body.id;

  const ticket = await mockServer.handle({
    method: 'POST', path: `/mission-records/${recordId}/media`,
    body: { mediaKind: 'camera_video', mimeType: 'video/mp4', sizeBytes: 1024, checksumSha256: 'a'.repeat(64) },
  });
  assert.equal(ticket.status, 201);
  assert.equal(ticket.body.uploadMethod, 'PUT');
  assert.deepEqual(ticket.body.uploadHeaders, { 'Content-Type': 'video/mp4' });

  const done = await mockServer.handle({ method: 'POST', path: `/media/${ticket.body.mediaId}/complete` });
  assert.equal(done.body.uploadStatus, 'uploaded');

  const submitted = await mockServer.handle({
    method: 'POST', path: `/mission-records/${recordId}/submit`,
    body: { evidenceKind: 'camera_media', clientMetrics: { appVersion: '0.1.0' } },
  });
  assert.equal(submitted.status, 202);
  assert.equal(submitted.body.status, 'submitted');
  assert.equal(submitted.body.pollAfterMs, 2000);

  const polled = await mockServer.handle({ method: 'GET', path: `/mission-records/${recordId}` });
  assert.equal(polled.body.status, 'submitted');
  assert.equal(polled.body.currentResult, null);
});

test('판정은 목표값 끝자리로 정한다 (12 §9)', () => {
  assert.equal(decisionFor(20), 'approved');
  assert.equal(decisionFor(13), 'rejected');
  assert.equal(decisionFor(3), 'rejected');
  assert.equal(decisionFor(24), 'review_required');
  assert.equal(decisionFor(50), 'approved');
  assert.equal(DECISION_DELAY_MS, 6000);
});

test('6초가 지나면 판정이 붙고 미션 상태도 바뀐다', async () => {
  setup();
  const started = await mockServer.handle({ method: 'POST', path: '/missions/mission-0001/records' });
  const recordId = started.body.id;
  await mockServer.handle({
    method: 'POST', path: `/mission-records/${recordId}/submit`, body: { evidenceKind: 'camera_media' },
  });

  // 제출 시각을 6초 전으로 돌린다
  const { mockServer: server } = await import('../src/client/mock/mockServer.js');
  const polledBefore = await server.handle({ method: 'GET', path: `/mission-records/${recordId}` });
  assert.equal(polledBefore.body.currentResult, null);

  // 시계를 앞으로 돌릴 수 없으므로, 6초 뒤에 해당하는 상태를 직접 확인한다.
  const realNow = Date.now;
  Date.now = () => realNow() + DECISION_DELAY_MS + 1;
  const polledAfter = await server.handle({ method: 'GET', path: `/mission-records/${recordId}` });
  Date.now = realNow;

  assert.equal(polledAfter.body.status, 'approved', '목표값 20 → 승인');
  assert.equal(polledAfter.body.currentResult.decision, 'approved');
  assert.equal(polledAfter.body.mission.status, 'completed');
  assert.ok(polledAfter.body.rewards, '승인이면 보상이 붙는다');
  assert.equal(polledAfter.body.pollAfterMs, null);
});

test('목표값 끝자리가 3인 미션은 거절된다', async () => {
  setup();
  const today = todayKst();
  const made = await mockServer.handle({
    method: 'POST', path: '/missions',
    body: { title: '스쿼트 13개', categoryCode: 'exercise', difficultyCode: 'normal', exerciseCode: 'squat', targetValue: 13, targetUnit: 'reps', scheduledDate: today },
  });
  const started = await mockServer.handle({ method: 'POST', path: `/missions/${made.body.id}/records` });
  await mockServer.handle({
    method: 'POST', path: `/mission-records/${started.body.id}/submit`, body: { evidenceKind: 'camera_media' },
  });

  const realNow = Date.now;
  Date.now = () => realNow() + DECISION_DELAY_MS + 1;
  const polled = await mockServer.handle({ method: 'GET', path: `/mission-records/${started.body.id}` });
  Date.now = realNow;

  assert.equal(polled.body.currentResult.decision, 'rejected');
  assert.equal(polled.body.mission.status, 'failed');
  assert.equal(polled.body.canAppeal, true);
  assert.equal(polled.body.rewards, null);
});

test('오늘이 아닌 미션은 A40에서 MISSION_NOT_STARTABLE', async () => {
  setup();
  const res = await mockServer.handle({ method: 'POST', path: '/missions/mission-0004/records' });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'MISSION_NOT_STARTABLE');
  assert.equal(res.body.error.details.reason, 'not_today');
});

test('reset()으로 상태가 처음으로 돌아간다', async () => {
  setup();
  await mockServer.handle({ method: 'POST', path: '/goals', body: { title: '임시 목표' } });
  const before = await mockServer.handle({ method: 'GET', path: '/goals', query: {} });
  assert.equal(before.body.items.length, 2);

  mockServer.reset();
  const after = await mockServer.handle({ method: 'GET', path: '/goals', query: {} });
  assert.equal(after.body.items.length, 1);
});
