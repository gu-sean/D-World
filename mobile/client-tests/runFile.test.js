import test from 'node:test';
import assert from 'node:assert/strict';

import { resetTestEnv, testEnv } from './helpers/fakeModules.js';
import { buildRunFile, runFileName, toKstIso, deviceInfo } from '../src/client/running/runFile.js';

/** 2026-11-04 07:00:00 KST */
const START = Date.parse('2026-11-03T22:00:00.000Z');

function session(overrides = {}) {
  return {
    recordId: '7b2a6f0e-1c1d-4c55-9a51-2f7f0a1b9c33',
    startedAtMs: START,
    endedAtMs: START + 1520 * 1000,
    points: [],
    steps: [],
    events: [],
    summary: { distanceMeters: 3120.5, activeSeconds: 1450, steps: 3950 },
    ...overrides,
  };
}

test('§8 머리 부분: format·version·recordId·시각(+09:00)', () => {
  resetTestEnv();
  const file = buildRunFile(session());

  assert.equal(file.format, 'dworld-run');
  assert.equal(file.version, 1);
  assert.equal(file.recordId, '7b2a6f0e-1c1d-4c55-9a51-2f7f0a1b9c33');
  assert.equal(file.startedAt, '2026-11-04T07:00:00.000+09:00');
  assert.equal(file.endedAt, '2026-11-04T07:25:20.000+09:00');
});

test('§8 device: Platform.constants에서 OS 버전·모델을 가져온다', () => {
  resetTestEnv();
  const file = buildRunFile(session());

  assert.deepEqual(file.device, {
    platform: 'android',
    osVersion: '14',
    model: 'SM-S911N',
    appVersion: '0.1.0-test',
  });
  assert.deepEqual(deviceInfo(), file.device);
});

test('§8 points: t는 시작부터 초(소수 2자리), 좌표는 소수 6자리', () => {
  resetTestEnv();
  const file = buildRunFile(session({
    points: [
      { timestampMs: START + 1020, lat: 36.799012345, lng: 127.074019876, acc: 8.5, alt: 52.1, spd: 2.9, mocked: false },
      { timestampMs: START + 2000, lat: 36.8, lng: 127.075, acc: 12.345678, alt: null, spd: null, mocked: true },
    ],
  }));

  assert.deepEqual(file.points[0], {
    t: 1.02, lat: 36.799012, lng: 127.07402, acc: 8.5, alt: 52.1, spd: 2.9, mocked: false,
  });
  assert.deepEqual(file.points[1], {
    t: 2, lat: 36.8, lng: 127.075, acc: 12.35, alt: null, spd: null, mocked: true,
  });
});

test('§8 points: alt·spd가 없으면 null, mocked가 없으면 false', () => {
  resetTestEnv();
  const file = buildRunFile(session({
    points: [{ timestampMs: START, lat: 36.799, lng: 127.074, acc: 8 }],
  }));

  assert.equal(file.points[0].alt, null);
  assert.equal(file.points[0].spd, null);
  assert.equal(file.points[0].mocked, false);
});

test('§8 steps: 시작 이후 누적 걸음. 센서가 없으면 빈 배열', () => {
  resetTestEnv();
  const withSteps = buildRunFile(session({
    steps: [{ timestampMs: START + 5000, count: 12 }, { timestampMs: START + 10000, count: 30 }],
  }));
  assert.deepEqual(withSteps.steps, [{ t: 5, count: 12 }, { t: 10, count: 30 }]);

  const noSensor = buildRunFile(session({ steps: [] }));
  assert.deepEqual(noSensor.steps, []);
});

test('§8 events: pause·resume이 시간 순으로', () => {
  resetTestEnv();
  const file = buildRunFile(session({
    events: [
      { timestampMs: START + 720000, type: 'pause', reason: 'user' },
      { timestampMs: START + 790000, type: 'resume', reason: 'user' },
      { timestampMs: START + 900000, type: 'pause', reason: 'background' },
    ],
  }));

  assert.deepEqual(file.events, [
    { t: 720, type: 'pause', reason: 'user' },
    { t: 790, type: 'resume', reason: 'user' },
    { t: 900, type: 'pause', reason: 'background' },
  ]);
});

test('§8 clientSummary: 거리 소수 1자리, 나머지는 정수', () => {
  resetTestEnv();
  const file = buildRunFile(session({
    summary: { distanceMeters: 3120.5432, activeSeconds: 1450.9, steps: 3950.4 },
  }));

  assert.deepEqual(file.clientSummary, { distanceMeters: 3120.5, activeSeconds: 1450, steps: 3950 });
});

test('§8 clientSummary: 값이 없으면 0', () => {
  resetTestEnv();
  const file = buildRunFile(session({ summary: undefined }));
  assert.deepEqual(file.clientSummary, { distanceMeters: 0, activeSeconds: 0, steps: 0 });
});

test('§8 전체 모양에 더 들어간 키가 없다', () => {
  resetTestEnv();
  const file = buildRunFile(session());
  assert.deepEqual(Object.keys(file).sort(), [
    'clientSummary', 'device', 'endedAt', 'events', 'format', 'points', 'recordId', 'startedAt', 'steps', 'version',
  ]);
});

test('파일 이름은 run-{recordId}.json.gz', () => {
  assert.equal(runFileName('abc-123'), 'run-abc-123.json.gz');
});

test('toKstIso: 기기 시간대와 상관없이 +09:00으로 적는다', () => {
  assert.equal(toKstIso(Date.parse('2026-01-01T00:00:00.000Z')), '2026-01-01T09:00:00.000+09:00');
  assert.equal(toKstIso(Date.parse('2026-11-03T15:00:00.000Z')), '2026-11-04T00:00:00.000+09:00');
  assert.equal(toKstIso(Date.parse('2026-11-03T14:59:59.999Z')), '2026-11-03T23:59:59.999+09:00');
});

test('iOS에서는 Platform.Version을 OS 버전으로 쓴다', () => {
  const env = resetTestEnv();
  env.platform = { OS: 'ios', Version: '18.2', constants: {} };

  const file = buildRunFile(session());
  assert.equal(file.device.platform, 'ios');
  assert.equal(file.device.osVersion, '18.2');
  assert.equal(file.device.model, 'unknown');

  testEnv().platform = { OS: 'android', Version: 34, constants: { Release: '14', Model: 'SM-S911N' } };
});
