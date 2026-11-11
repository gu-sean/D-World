/**
 * 기기 가짜 동작 (tasks/mobile-client MC-07).
 *
 * `fakeModules.js`의 가짜 모듈들은 `globalThis.__dworldTest.device`·`.blob`을 본다.
 * 테스트는 여기 함수로 그 값을 채운다.
 *
 * ```js
 * resetTestEnv();
 * grantPermissions('camera');
 * stubCamera({ path: '/cache/a.mp4', durationSeconds: 40, sizeBytes: 1024 });
 * const upload = stubUpload();
 * ```
 */
import { testEnv } from './fakeModules.js';

const ANDROID = {
  camera: 'android.permission.CAMERA',
  location: 'android.permission.ACCESS_FINE_LOCATION',
  activity: 'android.permission.ACTIVITY_RECOGNITION',
  notifications: 'notifications',
};

/** 권한을 미리 허용 상태로 둔다. */
export function grantPermissions(...kinds) {
  const env = testEnv();
  env.device.permissions ??= {};
  for (const kind of kinds) env.device.permissions[ANDROID[kind] ?? kind] = 'granted';
}

/** 권한을 특정 상태로 둔다. `'denied'` · `'blocked'` · `'unavailable'` */
export function setPermission(kind, status) {
  const env = testEnv();
  env.device.permissions ??= {};
  env.device.permissions[ANDROID[kind] ?? kind] = status;
}

/** 요청하면 이 값으로 바뀌게 한다 (팝업에서 사용자가 누른 결과). */
export function setPermissionOnRequest(kind, status) {
  const env = testEnv();
  env.device.permissionOnRequest ??= {};
  env.device.permissionOnRequest[ANDROID[kind] ?? kind] = status;
}

/** 지금까지 요청한 권한 목록. */
export function permissionRequests() {
  return testEnv().device.permissionRequests ?? [];
}

/**
 * 촬영 결과를 정한다.
 * @param {{path: string, sizeBytes?: number, durationSeconds?: number}|{didCancel: true}|{errorCode: string}} asset
 */
export function stubCamera(asset) {
  const env = testEnv();
  env.device.launchCamera = async () => {
    if (asset.didCancel) return { didCancel: true };
    if (asset.errorCode) return { errorCode: asset.errorCode };
    return {
      assets: [{
        uri: `file://${asset.path}`,
        fileSize: asset.sizeBytes ?? 1024,
        duration: asset.durationSeconds ?? null,
        width: asset.width ?? 1920,
        height: asset.height ?? 1080,
      }],
    };
  };
}

/** 영상 줄이기 결과 경로를 정한다 (기본: 원본 그대로). */
export function stubCompress(nextPath) {
  testEnv().device.compressVideo = async (path) => nextPath ?? path;
}

/** 파일 크기·해시를 정한다. */
export function stubFiles({ sizeBytes = 1024, hash = 'a'.repeat(64), exists = true } = {}) {
  const env = testEnv();
  env.blob.stat = async () => ({ size: sizeBytes });
  env.blob.hash = async () => hash;
  env.blob.exists = async () => exists;
}

/**
 * 저장소 PUT 결과를 정한다.
 * @param {{status?: number, statuses?: number[]}} [options] `statuses`는 호출 순서대로
 * @returns {{calls: Array<{method: string, url: string, headers: object, body: any}>}}
 */
export function stubUpload({ status = 200, statuses } = {}) {
  const env = testEnv();
  const calls = [];
  let index = 0;
  env.blob.fetch = async (call) => {
    calls.push(call);
    const code = statuses ? (statuses[index] ?? statuses.at(-1)) : status;
    index += 1;
    return { info: () => ({ status: code }), respInfo: { status: code }, text: () => '' };
  };
  return { calls };
}

/** 걸음 센서가 있는 것으로 둔다. 돌려받은 `emit(n)`으로 걸음 수를 흘려보낸다. */
export function stubPedometer({ available = true } = {}) {
  const env = testEnv();
  env.device.pedometerAvailable = () => available;
  let handler = null;
  env.device.watchStepCount = (fn) => {
    handler = fn;
    return { remove() { handler = null; } };
  };
  return {
    emit(steps) { handler?.({ steps }); },
    get watching() { return handler !== null; },
  };
}

/**
 * 위치를 흘려보낼 수 있게 한다.
 * @returns {{emit: (point: object) => void, fail: () => void, cleared: () => any[]}}
 */
export function stubLocation({ first } = {}) {
  const env = testEnv();
  let success = null;
  let failure = null;
  const toPosition = ({ lat = 36.799, lng = 127.074, acc = 8, alt = null, spd = null, mocked = false, timestampMs = Date.now() }) =>
    ({ coords: { latitude: lat, longitude: lng, accuracy: acc, altitude: alt, speed: spd }, timestamp: timestampMs, mocked });

  env.device.watchPosition = (onSuccess, onError) => {
    success = onSuccess;
    failure = onError;
    // `first`를 주면 구독하자마자 한 점을 흘려보낸다 (prepare()가 ready로 갈 수 있게).
    if (first) setTimeout(() => onSuccess(toPosition(first)), 0);
    return 1;
  };
  env.device.getCurrentPosition = (onSuccess, onError) => {
    if (env.device.quickFix) onSuccess(env.device.quickFix);
    else onError?.({ code: 2 });
  };
  return {
    emit(point) {
      success?.(toPosition(point ?? {}));
    },
    fail() { failure?.({ code: 2, message: 'no fix' }); },
    setQuickFix(point) { env.device.quickFix = point; },
    cleared() { return env.device.clearedWatches ?? []; },
  };
}

/** gzip으로 쓴 파일들. */
export function writtenFiles() {
  return testEnv().blob.written ?? [];
}

/** 지운 파일 경로들. */
export function removedFiles() {
  return testEnv().blob.removed ?? [];
}

/** 화면 켜 두기 기록 (`['on','run']` · `['off','run']`). */
export function keepAwakeLog() {
  return testEnv().device.keepAwake ?? [];
}

export default {
  grantPermissions,
  setPermission,
  setPermissionOnRequest,
  permissionRequests,
  stubCamera,
  stubCompress,
  stubFiles,
  stubUpload,
  stubPedometer,
  stubLocation,
  writtenFiles,
  removedFiles,
  keepAwakeLog,
};
