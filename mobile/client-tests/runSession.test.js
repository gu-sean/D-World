import test from 'node:test';
import assert from 'node:assert/strict';

import { installFakeFetch } from './helpers/fakeFetch.js';
import { resetTestEnv, testEnv } from './helpers/fakeModules.js';
import {
  grantPermissions, setPermission, stubFiles, stubUpload, stubLocation, stubPedometer,
  writtenFiles, removedFiles, keepAwakeLog,
} from './helpers/fakeDevice.js';
import * as session from '../src/client/auth/session.js';
import {
  getRunSession,
  __resetRunSessionsForTests,
  runTiming,
  READY_ACCURACY_M,
  MAX_RUN_SECONDS,
} from '../src/client/flows/runSession.js';

const MISSION_ID = 'mission-run';
const RECORD_ID = 'record-run';

const DEFAULT_TIMING = { ...runTiming };

function setup() {
  // 흐름을 먼저 치운다 — dispose가 화면 켜 두기를 끄면서 레지스트리에 기록을 남기므로,
  // 레지스트리를 비우는 건 그다음이어야 한다.
  __resetRunSessionsForTests();
  resetTestEnv();
  session.__resetSessionForTests();
  Object.assign(runTiming, DEFAULT_TIMING, {
    readyTimeoutMs: 30,
    tickMs: 5,
    pollIntervalMs: 1,
    decisionTimeoutMs: 40,
  });

  grantPermissions('location', 'activity');
  stubFiles({ sizeBytes: 4096, hash: 'c'.repeat(64) });

  const http = installFakeFetch();
  http.on('POST', '/missions/:missionId/records', () => ({ status: 201, body: { id: RECORD_ID, status: 'recording' } }));
  http.on('POST', '/mission-records/:recordId/media', () => ({
    status: 201,
    body: { mediaId: 'media-run', uploadUrl: 'https://storage.example.com/put', uploadMethod: 'PUT', uploadHeaders: { 'Content-Type': 'application/gzip' } },
  }));
  http.on('POST', '/media/:mediaId/complete', () => ({ status: 200, body: { mediaId: 'media-run', uploadStatus: 'uploaded' } }));
  http.on('POST', '/mission-records/:recordId/submit', () => ({ status: 202, body: { id: RECORD_ID, status: 'submitted' } }));
  http.on('POST', '/mission-records/:recordId/abort', () => ({ status: 204 }));
  http.on('GET', '/mission-records/:recordId', () => ({ status: 200, body: { id: RECORD_ID, status: 'approved', currentResult: { decision: 'approved' } } }));
  return http;
}

test('위치 권한이 없으면 prepare에서 PERMISSION_DENIED (GPS 없이는 러닝 인증 불가)', async () => {
  const http = setup();
  setPermission('location', 'blocked');
  stubLocation();

  const run = getRunSession(MISSION_ID);
  await run.prepare();

  assert.equal(run.getState().phase, 'error');
  assert.equal(run.getState().error.code, 'PERMISSION_DENIED');
  assert.equal(run.getState().error.details.kind, 'location');
  http.restore();
});

test('정확도 20m 이하 지점이 오면 ready', async () => {
  const http = setup();
  stubLocation({ first: { acc: READY_ACCURACY_M } });

  const run = getRunSession(MISSION_ID);
  await run.prepare();

  assert.equal(run.getState().phase, 'ready');
  assert.equal(run.getState().error, null);
  http.restore();
});

test('30초 안에 좋은 지점이 안 와도 ready로 가되 GPS_UNAVAILABLE을 달아 둔다 (§7.2)', async () => {
  const http = setup();
  stubLocation({ first: { acc: 48 } });

  const run = getRunSession(MISSION_ID);
  await run.prepare();

  assert.equal(run.getState().phase, 'ready', 'start()는 막지 않는다');
  assert.equal(run.getState().error.code, 'GPS_UNAVAILABLE');
  http.restore();
});

test('걸음 센서가 없어도 진행한다 (steps: [])', async () => {
  const http = setup();
  const loc = stubLocation({ first: { acc: 8 } });
  stubPedometer({ available: false });
  stubUpload();

  const run = getRunSession(MISSION_ID);
  await run.prepare();
  await run.start();
  loc.emit({ acc: 8, timestampMs: Date.now() });
  await run.finish();

  const written = writtenFiles();
  assert.equal(written.length, 1);
  assert.equal(run.getState().phase, 'done');

  const submit = http.find('POST', '/mission-records/:recordId/submit')[0];
  assert.equal(submit.body.clientMetrics.steps, 0);
  http.restore();
});

test('start → A40, 화면 켜 두기, running', async () => {
  const http = setup();
  stubLocation({ first: { acc: 8 } });
  stubPedometer();

  const run = getRunSession(MISSION_ID);
  await run.prepare();
  await run.start();

  assert.equal(run.getState().phase, 'running');
  assert.equal(run.getState().record.id, RECORD_ID);
  assert.equal(http.find('POST', '/missions/:missionId/records').length, 1);
  assert.deepEqual(keepAwakeLog()[0], ['on', 'run']);
  http.restore();
});

test('pause·resume이 §8 events에 남는다', async () => {
  const http = setup();
  const loc = stubLocation({ first: { acc: 8 } });
  stubPedometer({ available: false });
  stubUpload();

  const run = getRunSession(MISSION_ID);
  await run.prepare();
  await run.start();
  run.pause();
  assert.equal(run.getState().phase, 'paused');
  assert.equal(run.getState().paused, true);
  run.resume();
  assert.equal(run.getState().phase, 'running');
  loc.emit({ acc: 8 });
  await run.finish();

  const zlib = await import('node:zlib');
  const payload = JSON.parse(zlib.gunzipSync(Buffer.from(writtenFiles()[0].data, 'base64')).toString('utf8'));
  assert.deepEqual(payload.events.map((e) => [e.type, e.reason]), [['pause', 'user'], ['resume', 'user']]);
  http.restore();
});

test('앱이 백그라운드로 가면 자동 일시정지 (reason: background), 자동 재개는 없다', async () => {
  const http = setup();
  stubLocation({ first: { acc: 8 } });
  stubPedometer({ available: false });

  const run = getRunSession(MISSION_ID);
  await run.prepare();
  await run.start();

  const env = testEnv();
  for (const entry of env.appState.listeners) entry.handler('background');
  assert.equal(run.getState().phase, 'paused');

  for (const entry of env.appState.listeners) entry.handler('active');
  assert.equal(run.getState().phase, 'paused', '돌아와도 사용자가 눌러야 재개한다');
  http.restore();
});

test('finish: sensor_raw·application/gzip으로 올리고 clientMetrics를 넣는다', async () => {
  const http = setup();
  const loc = stubLocation({ first: { acc: 8 } });
  const pedometer = stubPedometer();
  const upload = stubUpload();

  const run = getRunSession(MISSION_ID);
  await run.prepare();
  await run.start();
  loc.emit({ acc: 8, lat: 36.799, timestampMs: Date.now() });
  loc.emit({ acc: 8, lat: 36.7999, timestampMs: Date.now() + 2000 });
  pedometer.emit(120);
  await run.finish();

  const media = http.find('POST', '/mission-records/:recordId/media')[0];
  assert.equal(media.body.mediaKind, 'sensor_raw');
  assert.equal(media.body.mimeType, 'application/gzip');
  assert.equal(media.body.checksumSha256, 'c'.repeat(64));
  assert.equal(upload.calls.length, 1);

  const submit = http.find('POST', '/mission-records/:recordId/submit')[0];
  assert.equal(submit.body.evidenceKind, 'sensor_raw');
  assert.equal(submit.body.clientMetrics.appVersion, '0.1.0-test');
  assert.equal(typeof submit.body.clientMetrics.distanceMeters, 'number');
  assert.equal(submit.body.clientMetrics.steps, 120);

  assert.equal(run.getState().phase, 'done');
  assert.deepEqual(removedFiles(), [`/cache/run-${RECORD_ID}.json.gz`], '판정이 나면 캐시 파일을 지운다');
  http.restore();
});

test('파일이 5MB를 넘으면 FILE_TOO_LARGE (05 §11)', async () => {
  const http = setup();
  const loc = stubLocation({ first: { acc: 8 } });
  stubPedometer({ available: false });
  // writeGzipJson이 돌려주는 크기는 실제 gzip 길이라, 큰 좌표 묶음을 넣어 키우는 대신
  // 한계를 낮춰서 같은 길을 지나가게 한다.
  const run = getRunSession(MISSION_ID);
  await run.prepare();
  await run.start();
  loc.emit({ acc: 8 });

  const { MEDIA_LIMITS } = await import('../src/client/flows/cameraVerification.js');
  const original = MEDIA_LIMITS.sensor_raw;
  MEDIA_LIMITS.sensor_raw = 1;
  await run.finish();
  MEDIA_LIMITS.sensor_raw = original;

  assert.equal(run.getState().phase, 'error');
  assert.equal(run.getState().error.code, 'FILE_TOO_LARGE');
  http.restore();
});

test('받은 지점은 거르지 않고 모두 파일에 담는다 (§7.2)', async () => {
  const http = setup();
  const loc = stubLocation({ first: { acc: 8 } });
  stubPedometer({ available: false });
  stubUpload();

  const run = getRunSession(MISSION_ID);
  await run.prepare();
  await run.start();
  const t0 = Date.now();
  loc.emit({ acc: 8, lat: 36.799, timestampMs: t0 });
  loc.emit({ acc: 90, lat: 36.8, timestampMs: t0 + 1000 });   // 정확도 나쁨 — 그래도 저장
  loc.emit({ acc: 8, lat: 36.8001, timestampMs: t0 + 2000, mocked: true });
  await run.finish();

  const zlib = await import('node:zlib');
  const payload = JSON.parse(zlib.gunzipSync(Buffer.from(writtenFiles()[0].data, 'base64')).toString('utf8'));
  assert.equal(payload.points.length, 3);
  assert.equal(payload.points[1].acc, 90);
  assert.equal(payload.points[2].mocked, true);
  http.restore();
});

test('cancel: A42를 부르고 idle로 돌아간다', async () => {
  const http = setup();
  stubLocation({ first: { acc: 8 } });
  stubPedometer({ available: false });

  const run = getRunSession(MISSION_ID);
  await run.prepare();
  await run.start();
  await run.cancel();

  assert.equal(run.getState().phase, 'idle');
  assert.equal(http.find('POST', '/mission-records/:recordId/abort').length, 1);
  http.restore();
});

test('최대 측정 시간은 2시간 (§7.2)', () => {
  assert.equal(MAX_RUN_SECONDS, 7200);
});
