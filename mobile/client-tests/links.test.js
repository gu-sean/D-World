import test from 'node:test';
import assert from 'node:assert/strict';

import { parseLinkScreen, LINK_SCREEN_NAMES } from '../src/client/links.js';

/** 07 §17 표 전부. `[linkScreen, name, params]` */
const TABLE = [
  ['home', 'home', {}],
  ['missions/7b2a6f0e-1c1d-4c55-9a51-2f7f0a1b9c33', 'missionDetail', { missionId: '7b2a6f0e-1c1d-4c55-9a51-2f7f0a1b9c33' }],
  ['records/aaaa1111-2222-4333-8444-555566667777', 'recordResult', { recordId: 'aaaa1111-2222-4333-8444-555566667777' }],
  ['reports', 'reports', {}],
  ['reports/ai/run-1', 'aiReport', { runId: 'run-1' }],
  ['adjustments/adj-1', 'planAdjustment', { adjustmentId: 'adj-1' }],
  ['pets', 'pets', {}],
  ['achievements', 'achievements', {}],
  ['streak', 'streak', {}],
  ['challenges/ch-1', 'challengeDetail', { challengeId: 'ch-1' }],
  ['challenges/ch-1/result', 'challengeResult', { challengeId: 'ch-1' }],
  ['notices/no-1', 'noticeDetail', { noticeId: 'no-1' }],
  ['support/tk-1', 'supportTicket', { ticketId: 'tk-1' }],
];

test('07 §17 표의 모든 linkScreen을 알아본다', () => {
  for (const [linkScreen, name, params] of TABLE) {
    assert.deepEqual(parseLinkScreen(linkScreen), { name, params }, linkScreen);
  }
});

test('07 §18 알림 event_key가 쓰는 linkScreen도 모두 들어 있다', () => {
  const used = ['records/r1', 'achievements', 'pets', 'streak', 'reports/ai/run-1', 'adjustments/a1', 'challenges/c1/result', 'support/t1', 'home'];
  for (const link of used) {
    assert.notEqual(parseLinkScreen(link).name, undefined, link);
  }
  assert.equal(parseLinkScreen('home').name, 'home');
});

test('표에 없는 값·빈 값·이상한 값은 모두 home (07 §17)', () => {
  const unknown = [
    'shop', 'missions', 'records', 'challenges', 'reports/ai',
    'missions/a/b', 'challenges/c1/ranking', '', '   ', '/', '//',
    null, undefined, 42, {}, [],
  ];
  for (const value of unknown) {
    assert.deepEqual(parseLinkScreen(value), { name: 'home', params: {} }, String(value));
  }
});

test('앞뒤 슬래시는 무시한다', () => {
  assert.deepEqual(parseLinkScreen('/pets'), { name: 'pets', params: {} });
  assert.deepEqual(parseLinkScreen('/missions/m1/'), { name: 'missionDetail', params: { missionId: 'm1' } });
});

test('challenges/{id}와 challenges/{id}/result를 헷갈리지 않는다', () => {
  assert.equal(parseLinkScreen('challenges/c1').name, 'challengeDetail');
  assert.equal(parseLinkScreen('challenges/c1/result').name, 'challengeResult');
});

test('돌려준 객체는 매번 새 것이다 (화면이 params를 고쳐도 안전)', () => {
  const a = parseLinkScreen('home');
  a.params.x = 1;
  assert.deepEqual(parseLinkScreen('home'), { name: 'home', params: {} });
});

test('LINK_SCREEN_NAMES가 07 §17의 화면 이름 전부', () => {
  const expected = [...new Set(TABLE.map(([, name]) => name))].sort();
  assert.deepEqual([...LINK_SCREEN_NAMES].sort(), expected);
});
