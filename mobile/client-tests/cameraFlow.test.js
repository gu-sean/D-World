import test from 'node:test';
import assert from 'node:assert/strict';

import { installFakeFetch } from './helpers/fakeFetch.js';
import { resetTestEnv } from './helpers/fakeModules.js';
import { grantPermissions, stubCamera, stubFiles, stubUpload, removedFiles } from './helpers/fakeDevice.js';
import * as session from '../src/client/auth/session.js';
import {
  getCameraVerification,
  __resetCameraFlowsForTests,
  flowTiming,
  MEDIA_LIMITS,
} from '../src/client/flows/cameraVerification.js';

const MISSION_ID = 'mission-1';
const RECORD_ID = 'record-1';
const MEDIA_ID = 'media-1';
const UPLOAD_URL = 'https://storage.example.com/signed/put?x=1';

const DEFAULT_TIMING = { ...flowTiming };

function setup({ exerciseCode = 'squat' } = {}) {
  resetTestEnv();
  session.__resetSessionForTests();
  __resetCameraFlowsForTests();
  Object.assign(flowTiming, DEFAULT_TIMING, { pollIntervalMs: 1, decisionTimeoutMs: 50 });

  grantPermissions('camera');
  stubCamera({ path: '/cache/shot.mp4', sizeBytes: 2048, durationSeconds: 45 });
  stubFiles({ sizeBytes: 2048, hash: 'b'.repeat(64) });

  const http = installFakeFetch();
  http.on('GET', '/missions/:missionId', () => ({ status: 200, body: { id: MISSION_ID, exerciseCode } }));
  http.on('POST', '/missions/:missionId/records', () => ({ status: 201, body: { id: RECORD_ID, status: 'recording' } }));
  http.on('POST', '/mission-records/:recordId/media', () => ({
    status: 201,
    body: { mediaId: MEDIA_ID, uploadUrl: UPLOAD_URL, uploadMethod: 'PUT', uploadHeaders: { 'Content-Type': 'video/mp4' } },
  }));
  http.on('POST', '/media/:mediaId/complete', () => ({ status: 200, body: { mediaId: MEDIA_ID, uploadStatus: 'uploaded' } }));
  http.on('POST', '/mission-records/:recordId/submit', () => ({ status: 202, body: { id: RECORD_ID, status: 'submitted', pollAfterMs: 2000 } }));
  http.on('POST', '/mission-records/:recordId/abort', () => ({ status: 204 }));
  return http;
}

/** 요청 경로만 순서대로. PUT은 blob-util로 나가므로 따로 센다. */
const pathsOf = (http) => http.requests.map((r) => `${r.method} ${r.path}`);

test('단계 순서: A40 → A43 → PUT → A44 → A45 → A41 (parts/mobile-client §6)', async () => {
  const http = setup();
  const upload = stubUpload();
  http.on('GET', '/mission-records/:recordId', () => ({
    status: 200,
    body: { id: RECORD_ID, status: 'approved', currentResult: { decision: 'approved' } },
  }));

  const flow = getCameraVerification(MISSION_ID);
  await flow.start({ exerciseCode: 'squat' });

  assert.deepEqual(pathsOf(http), [
    'POST /missions/mission-1/records',
    'POST /mission-records/record-1/media',
    'POST /media/media-1/complete',
    'POST /mission-records/record-1/submit',
    'GET /mission-records/record-1',
  ]);
  assert.equal(upload.calls.length, 1, 'PUT은 A43과 A44 사이에 한 번');
  assert.equal(upload.calls[0].method, 'PUT');
  assert.equal(upload.calls[0].url, UPLOAD_URL);

  assert.equal(flow.getState().phase, 'done');
  assert.deepEqual(flow.getState().result, { decision: 'approved' });
  http.restore();
});

test('exerciseCode를 안 넘기면 A32로 미션을 먼저 본다', async () => {
  const http = setup({ exerciseCode: null });
  stubCamera({ path: '/cache/shot.jpg', sizeBytes: 512 });
  stubUpload();
  http.on('GET', '/mission-records/:recordId', () => ({
    status: 200, body: { id: RECORD_ID, status: 'approved', currentResult: { decision: 'approved' } },
  }));

  await getCameraVerification(MISSION_ID).start();

  assert.equal(pathsOf(http)[0], 'GET /missions/mission-1');
  const media = http.find('POST', '/mission-records/:recordId/media')[0];
  assert.equal(media.body.mediaKind, 'camera_photo', '운동이 아니면 사진');
  assert.equal(media.body.mimeType, 'image/jpeg');
  http.restore();
});

test('사진 제출에는 videoDurationSeconds를 넣지 않는다 (§6 submitting 칸)', async () => {
  const http = setup({ exerciseCode: null });
  stubCamera({ path: '/cache/shot.jpg', sizeBytes: 512 });
  stubUpload();
  http.on('GET', '/mission-records/:recordId', () => ({ status: 200, body: { id: RECORD_ID, status: 'approved', currentResult: {} } }));

  await getCameraVerification(MISSION_ID).start({ exerciseCode: null });

  const submit = http.find('POST', '/mission-records/:recordId/submit')[0];
  assert.equal(submit.body.evidenceKind, 'camera_media');
  assert.equal(submit.body.clientMetrics.videoDurationSeconds, undefined);
  assert.equal(submit.body.clientMetrics.appVersion, '0.1.0-test');
  http.restore();
});

test('영상 제출에는 videoDurationSeconds를 넣는다', async () => {
  const http = setup();
  stubUpload();
  http.on('GET', '/mission-records/:recordId', () => ({ status: 200, body: { id: RECORD_ID, status: 'approved', currentResult: {} } }));

  await getCameraVerification(MISSION_ID).start({ exerciseCode: 'squat' });

  const submit = http.find('POST', '/mission-records/:recordId/submit')[0];
  assert.equal(submit.body.clientMetrics.videoDurationSeconds, 45);
  http.restore();
});

test('업로드 403 → A43을 다시 불러 새 URL로 한 번 더 (§6)', async () => {
  const http = setup();
  const upload = stubUpload({ statuses: [403, 200] });
  http.on('GET', '/mission-records/:recordId', () => ({ status: 200, body: { id: RECORD_ID, status: 'approved', currentResult: {} } }));

  const flow = getCameraVerification(MISSION_ID);
  await flow.start({ exerciseCode: 'squat' });

  assert.equal(http.find('POST', '/mission-records/:recordId/media').length, 2, 'A43을 두 번');
  assert.equal(upload.calls.length, 2, 'PUT도 두 번');
  assert.equal(flow.getState().phase, 'done');
  http.restore();
});

test('두 번째 PUT도 실패하면 UPLOAD_FAILED로 error, retryUpload로 되살아난다', async () => {
  const http = setup();
  stubUpload({ statuses: [500, 500] });
  http.on('GET', '/mission-records/:recordId', () => ({ status: 200, body: { id: RECORD_ID, status: 'approved', currentResult: {} } }));

  const flow = getCameraVerification(MISSION_ID);
  await flow.start({ exerciseCode: 'squat' });

  assert.equal(flow.getState().phase, 'error');
  assert.equal(flow.getState().error.code, 'UPLOAD_FAILED');

  // 이번에는 저장소가 받아 준다
  stubUpload({ status: 200 });
  await flow.retryUpload();

  assert.equal(flow.getState().phase, 'done');
  assert.equal(http.find('POST', '/missions/:missionId/records').length, 1, '회차를 다시 만들지 않는다');
  http.restore();
});

test('멱등 키: A40·A43·A45는 각자 하나, retryUpload는 같은 키를 다시 쓴다 (05 §5.1)', async () => {
  const http = setup();
  stubUpload({ statuses: [500] });
  http.on('GET', '/mission-records/:recordId', () => ({ status: 200, body: { id: RECORD_ID, status: 'approved', currentResult: {} } }));

  const flow = getCameraVerification(MISSION_ID);
  await flow.start({ exerciseCode: 'squat' });
  const firstMediaKey = http.find('POST', '/mission-records/:recordId/media')[0].headers['Idempotency-Key'];

  stubUpload({ status: 200 });
  await flow.retryUpload();

  const mediaCalls = http.find('POST', '/mission-records/:recordId/media');
  assert.equal(mediaCalls.length, 2);
  assert.equal(mediaCalls[1].headers['Idempotency-Key'], firstMediaKey, 'A43은 같은 키로 다시');

  const startCalls = http.find('POST', '/missions/:missionId/records');
  assert.equal(startCalls.length, 1);
  assert.ok(startCalls[0].headers['Idempotency-Key']);

  const submitCalls = http.find('POST', '/mission-records/:recordId/submit');
  assert.equal(submitCalls.length, 1);
  assert.notEqual(submitCalls[0].headers['Idempotency-Key'], firstMediaKey, 'A45는 A43과 다른 키');
  http.restore();
});

test('start()를 다시 부르면 새 멱등 키로 처음부터', async () => {
  const http = setup();
  stubUpload();
  http.on('GET', '/mission-records/:recordId', () => ({ status: 200, body: { id: RECORD_ID, status: 'approved', currentResult: {} } }));

  const flow = getCameraVerification(MISSION_ID);
  await flow.start({ exerciseCode: 'squat' });
  await flow.start({ exerciseCode: 'squat' });

  const startCalls = http.find('POST', '/missions/:missionId/records');
  assert.equal(startCalls.length, 2);
  assert.notEqual(
    startCalls[0].headers['Idempotency-Key'],
    startCalls[1].headers['Idempotency-Key'],
    '새 시도는 새 키',
  );
  http.restore();
});

test('3분이 지나도 판정이 없으면 오류가 아니라 pending (§6 waiting 칸)', async () => {
  const http = setup();
  stubUpload();
  http.on('GET', '/mission-records/:recordId', () => ({ status: 200, body: { id: RECORD_ID, status: 'submitted' } }));

  const flow = getCameraVerification(MISSION_ID);
  await flow.start({ exerciseCode: 'squat' });

  assert.equal(flow.getState().phase, 'pending');
  assert.equal(flow.getState().error, null);
  assert.ok(http.find('GET', '/mission-records/:recordId').length >= 2, '2초마다 여러 번 본다');
  http.restore();
});

test('review_required도 기다림을 끝낸다 (성공은 아니다)', async () => {
  const http = setup();
  stubUpload();
  http.on('GET', '/mission-records/:recordId', () => ({
    status: 200, body: { id: RECORD_ID, status: 'review_required', currentResult: { decision: 'review_required' } },
  }));

  const flow = getCameraVerification(MISSION_ID);
  await flow.start({ exerciseCode: 'squat' });

  assert.equal(flow.getState().phase, 'done');
  assert.equal(flow.getState().record.status, 'review_required');
  assert.deepEqual(removedFiles(), [], 'review_required면 파일을 아직 지우지 않는다');
  http.restore();
});

test('승인·거절이면 임시 파일을 지운다 (§6 done 칸)', async () => {
  const http = setup();
  stubUpload();
  http.on('GET', '/mission-records/:recordId', () => ({ status: 200, body: { id: RECORD_ID, status: 'rejected', currentResult: { decision: 'rejected' } } }));

  await getCameraVerification(MISSION_ID).start({ exerciseCode: 'squat' });

  assert.deepEqual(removedFiles(), ['/cache/shot.mp4']);
  http.restore();
});

test('촬영 취소 → A42로 회차를 정리하고 idle로', async () => {
  const http = setup();
  stubCamera({ didCancel: true });

  const flow = getCameraVerification(MISSION_ID);
  await flow.start({ exerciseCode: 'squat' });

  assert.equal(flow.getState().phase, 'idle');
  assert.equal(flow.getState().error, null);
  assert.equal(http.find('POST', '/mission-records/:recordId/abort').length, 1);
  http.restore();
});

test('영상이 120초를 넘으면 VIDEO_TOO_LONG', async () => {
  const http = setup();
  stubCamera({ path: '/cache/long.mp4', sizeBytes: 1024, durationSeconds: 121 });

  const flow = getCameraVerification(MISSION_ID);
  await flow.start({ exerciseCode: 'squat' });

  assert.equal(flow.getState().phase, 'error');
  assert.equal(flow.getState().error.code, 'VIDEO_TOO_LONG');
  assert.equal(flow.getState().error.message, '영상은 2분까지 찍을 수 있어요.');
  http.restore();
});

test('영상이 80MB를 넘으면 FILE_TOO_LARGE (05 §11)', async () => {
  const http = setup();
  stubFiles({ sizeBytes: MEDIA_LIMITS.camera_video + 1 });

  const flow = getCameraVerification(MISSION_ID);
  await flow.start({ exerciseCode: 'squat' });

  assert.equal(flow.getState().phase, 'error');
  assert.equal(flow.getState().error.code, 'FILE_TOO_LARGE');
  http.restore();
});

test('사진이 10MB를 넘으면 FILE_TOO_LARGE', async () => {
  const http = setup({ exerciseCode: null });
  stubCamera({ path: '/cache/big.jpg', sizeBytes: 1 });
  stubFiles({ sizeBytes: MEDIA_LIMITS.camera_photo + 1 });

  const flow = getCameraVerification(MISSION_ID);
  await flow.start({ exerciseCode: null });

  assert.equal(flow.getState().error.code, 'FILE_TOO_LARGE');
  http.restore();
});

test('카메라 권한이 없으면 PERMISSION_DENIED', async () => {
  const http = setup();
  resetTestEnv();
  __resetCameraFlowsForTests();
  stubCamera({ path: '/cache/shot.mp4' });

  const flow = getCameraVerification(MISSION_ID);
  await flow.start({ exerciseCode: 'squat' });

  assert.equal(flow.getState().phase, 'error');
  assert.equal(flow.getState().error.code, 'PERMISSION_DENIED');
  http.restore();
});

test('A40이 거절되면 그 코드가 그대로 error에 담긴다', async () => {
  const http = setup();
  http.on('POST', '/missions/:missionId/records', () => ({
    status: 409,
    body: { error: { code: 'MISSION_NOT_STARTABLE', message: '오늘 할 수 있는 미션이 아니에요.', details: { reason: 'not_today' } } },
  }));

  const flow = getCameraVerification(MISSION_ID);
  await flow.start({ exerciseCode: 'squat' });

  assert.equal(flow.getState().phase, 'error');
  assert.equal(flow.getState().error.code, 'MISSION_NOT_STARTABLE');
  assert.deepEqual(flow.getState().error.details, { reason: 'not_today' });
  http.restore();
});

test('흐름은 미션별로 하나이고, 화면을 떠났다 와도 상태가 남아 있다 (§6)', async () => {
  const http = setup();
  stubUpload();
  http.on('GET', '/mission-records/:recordId', () => ({ status: 200, body: { id: RECORD_ID, status: 'approved', currentResult: {} } }));

  const first = getCameraVerification(MISSION_ID);
  await first.start({ exerciseCode: 'squat' });

  const again = getCameraVerification(MISSION_ID);
  assert.equal(again, first, '같은 미션이면 같은 흐름');
  assert.equal(again.getState().phase, 'done');
  assert.notEqual(getCameraVerification('mission-2'), first, '다른 미션이면 다른 흐름');
  http.restore();
});

test('진행률이 0 → 1로 올라간다', async () => {
  const http = setup();
  stubUpload();
  http.on('GET', '/mission-records/:recordId', () => ({ status: 200, body: { id: RECORD_ID, status: 'approved', currentResult: {} } }));

  const flow = getCameraVerification(MISSION_ID);
  const seen = [];
  flow.subscribe((s) => seen.push(`${s.phase}:${s.progress}`));

  await flow.start({ exerciseCode: 'squat' });

  assert.ok(seen.includes('uploading:0'));
  assert.ok(seen.includes('submitting:1'));
  http.restore();
});

test('cancel(): A42를 부르고 파일을 지우고 idle로', async () => {
  const http = setup();
  stubUpload({ statuses: [500] });
  http.on('GET', '/mission-records/:recordId', () => ({ status: 200, body: { id: RECORD_ID, status: 'approved', currentResult: {} } }));

  const flow = getCameraVerification(MISSION_ID);
  await flow.start({ exerciseCode: 'squat' });
  assert.equal(flow.getState().phase, 'error');

  await flow.cancel();

  assert.equal(flow.getState().phase, 'idle');
  assert.equal(http.find('POST', '/mission-records/:recordId/abort').length, 1);
  assert.deepEqual(removedFiles(), ['/cache/shot.mp4']);
  http.restore();
});
