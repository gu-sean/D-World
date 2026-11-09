/**
 * React Native 전용 모듈의 가짜 구현 (parts/mobile-client §9).
 *
 * 이 파일은 두 가지로 쓰인다.
 *  1) `register.js`가 모듈 해석 훅(`resolve`·`load`)으로 등록한다 — 로더 스레드에서 동작하며,
 *     아래 `SOURCES`의 소스 문자열을 가상 모듈로 내어 준다.
 *  2) 테스트가 `testEnv`·`resetTestEnv`를 가져다 쓴다 — 메인 스레드에서 동작한다.
 *
 * 두 스레드가 공유하는 것은 `globalThis.__dworldTest` 레지스트리뿐이다.
 * 가짜 모듈들은 이 레지스트리를 **쓸 때마다** 읽으므로, 테스트가 중간에 바꿔도 반영된다.
 */

const PREFIX = 'dworld-fake:';

/** 테스트마다 초기화되는 레지스트리의 기본값. */
function emptyEnv() {
  return {
    /** uuid v4 가짜 값의 일련번호. */
    uuidCounter: 0,
    /** 키체인 저장소: service → password 문자열. */
    keychain: {},
    /** react-native Platform. */
    platform: { OS: 'android', Version: 34, constants: { Release: '14', Model: 'SM-S911N' } },
    /** AppState 현재 값과 구독자. */
    appState: { current: 'active', listeners: [] },
    /** Linking.openSettings 호출 횟수. */
    openSettingsCount: 0,
    /** 기기 래퍼 가짜 동작 (fakeDevice.js가 채운다). */
    device: {},
    /** 저장소 PUT·파일 접근 기록 (fakeDevice.js가 채운다). */
    blob: {},
  };
}

/** 메인 스레드에서 쓰는 레지스트리 접근자. */
export function testEnv() {
  if (!globalThis.__dworldTest) globalThis.__dworldTest = emptyEnv();
  return globalThis.__dworldTest;
}

/** 테스트 시작마다 부른다. 이전 테스트가 남긴 상태를 지운다. */
export function resetTestEnv() {
  globalThis.__dworldTest = emptyEnv();
  return globalThis.__dworldTest;
}

const ENV = `globalThis.__dworldTest ?? (globalThis.__dworldTest = {
  uuidCounter: 0, keychain: {}, platform: { OS: 'android', Version: 34, constants: { Release: '14', Model: 'SM-S911N' } },
  appState: { current: 'active', listeners: [] }, openSettingsCount: 0, device: {}, blob: {},
})`;

const SOURCES = {
  // crypto.getRandomValues는 Node에 이미 있다. 부작용 없는 빈 모듈.
  'react-native-get-random-values': 'export default undefined;',

  // 환경 변수. config.js가 import 할 때 한 번 읽으므로 값은 고정이다.
  'react-native-config': `export default {
    API_BASE_URL: 'http://test.local/api/v1',
    APP_ENV: 'test',
    USE_MOCK_API: 'false',
    SOCIAL_LOGIN_MODE: 'mock',
    APP_VERSION: '0.1.0-test',
  };`,

  // 멱등 키·X-Request-Id가 테스트에서 예측 가능하도록 일련번호를 쓴다.
  uuid: `export function v4() {
    const env = ${ENV};
    env.uuidCounter += 1;
    return 'uuid-' + String(env.uuidCounter).padStart(4, '0');
  }
  export default { v4 };`,

  // src/client/이 쓸 수 있는 것은 Platform·AppState·Linking뿐이다 (parts/mobile-client §2).
  'react-native': `const env = () => (${ENV});
  export const Platform = new Proxy({}, { get: (_t, k) => env().platform[k] });
  export const AppState = {
    get currentState() { return env().appState.current; },
    addEventListener(type, handler) {
      const entry = { type, handler };
      env().appState.listeners.push(entry);
      return { remove() {
        const list = env().appState.listeners;
        const i = list.indexOf(entry);
        if (i >= 0) list.splice(i, 1);
      } };
    },
  };
  export const Linking = {
    async openSettings() { env().openSettingsCount += 1; },
    async openURL() {},
  };
  export default { Platform, AppState, Linking };`,

  'react-native-keychain': `const env = () => (${ENV});
  export async function setGenericPassword(username, password, options = {}) {
    env().keychain[options.service ?? 'default'] = { username, password };
    return true;
  }
  export async function getGenericPassword(options = {}) {
    return env().keychain[options.service ?? 'default'] ?? false;
  }
  export async function resetGenericPassword(options = {}) {
    delete env().keychain[options.service ?? 'default'];
    return true;
  }
  export const ACCESSIBLE = { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly' };
  export default { setGenericPassword, getGenericPassword, resetGenericPassword, ACCESSIBLE };`,

  // 실제 pako와 같은 결과를 내도록 Node의 zlib을 쓴다.
  pako: `import { gzipSync, gunzipSync } from 'node:zlib';
  export function gzip(input) {
    const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
    return new Uint8Array(gzipSync(buf));
  }
  export function ungzip(input, options = {}) {
    const out = gunzipSync(Buffer.from(input));
    return options.to === 'string' ? out.toString('utf8') : new Uint8Array(out);
  }
  export default { gzip, ungzip };`,

  'react-native-permissions': `const env = () => (${ENV});
  export const RESULTS = { UNAVAILABLE: 'unavailable', DENIED: 'denied', LIMITED: 'limited', GRANTED: 'granted', BLOCKED: 'blocked' };
  export const PERMISSIONS = {
    ANDROID: { CAMERA: 'android.permission.CAMERA', ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION', ACTIVITY_RECOGNITION: 'android.permission.ACTIVITY_RECOGNITION' },
    IOS: { CAMERA: 'ios.permission.CAMERA', LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE', MOTION: 'ios.permission.MOTION' },
  };
  const table = () => (env().device.permissions ??= {});
  export async function check(permission) { return table()[permission] ?? RESULTS.DENIED; }
  export async function request(permission) {
    const asked = (env().device.permissionRequests ??= []);
    asked.push(permission);
    const next = env().device.permissionOnRequest?.[permission];
    if (next) table()[permission] = next;
    return table()[permission] ?? RESULTS.DENIED;
  }
  export async function checkNotifications() { return { status: table().notifications ?? RESULTS.DENIED, settings: {} }; }
  export async function requestNotifications() {
    (env().device.permissionRequests ??= []).push('notifications');
    const next = env().device.permissionOnRequest?.notifications;
    if (next) table().notifications = next;
    return { status: table().notifications ?? RESULTS.DENIED, settings: {} };
  }
  export async function openSettings() { env().openSettingsCount += 1; }
  export default { RESULTS, PERMISSIONS, check, request, checkNotifications, requestNotifications, openSettings };`,

  'react-native-image-picker': `const env = () => (${ENV});
  export async function launchCamera(options) {
    const fn = env().device.launchCamera;
    if (!fn) throw new Error('fakeDevice: launchCamera가 준비되지 않았어요.');
    return fn(options);
  }
  export async function launchImageLibrary(options) {
    const fn = env().device.launchImageLibrary;
    if (!fn) throw new Error('fakeDevice: launchImageLibrary가 준비되지 않았어요.');
    return fn(options);
  }
  export default { launchCamera, launchImageLibrary };`,

  'react-native-compressor': `const env = () => (${ENV});
  export const Video = {
    async compress(path, options) {
      const fn = env().device.compressVideo;
      return fn ? fn(path, options) : path;
    },
  };
  export default { Video };`,

  'react-native-blob-util': `const env = () => (${ENV});
  const api = {
    fs: {
      dirs: { CacheDir: '/cache', DocumentDir: '/docs' },
      async writeFile(path, data, encoding) {
        (env().blob.written ??= []).push({ path, data, encoding });
        return path;
      },
      async readFile(path, encoding) {
        const fn = env().blob.readFile;
        return fn ? fn(path, encoding) : '';
      },
      async stat(path) {
        const fn = env().blob.stat;
        if (!fn) throw new Error('fakeDevice: stat이 준비되지 않았어요.');
        return fn(path);
      },
      async unlink(path) { (env().blob.removed ??= []).push(path); },
      async exists(path) {
        const fn = env().blob.exists;
        return fn ? fn(path) : true;
      },
      async hash(path, algorithm) {
        const fn = env().blob.hash;
        return fn ? fn(path, algorithm) : 'sha256-of-' + path;
      },
    },
    wrap(path) { return 'RNFetchBlob-wrap://' + path; },
    fetch(method, url, headers, body) {
      const fn = env().blob.fetch;
      if (!fn) throw new Error('fakeDevice: blob fetch가 준비되지 않았어요.');
      const task = Promise.resolve(fn({ method, url, headers, body }));
      task.uploadProgress = (handler) => { env().blob.lastProgressHandler = handler; return task; };
      return task;
    },
  };
  export default api;`,

  '@react-native-community/geolocation': `const env = () => (${ENV});
  const api = {
    getCurrentPosition(success, error, options) {
      const fn = env().device.getCurrentPosition;
      if (!fn) { error?.({ code: 2, message: 'fakeDevice 미설정' }); return; }
      fn(success, error, options);
    },
    watchPosition(success, error, options) {
      const fn = env().device.watchPosition;
      if (!fn) { error?.({ code: 2, message: 'fakeDevice 미설정' }); return 0; }
      return fn(success, error, options);
    },
    clearWatch(id) { (env().device.clearedWatches ??= []).push(id); },
    setRNConfiguration() {},
    requestAuthorization(success) { success?.(); },
  };
  export default api;`,

  'expo-sensors': `const env = () => (${ENV});
  export const Pedometer = {
    async isAvailableAsync() {
      const fn = env().device.pedometerAvailable;
      return fn ? fn() : false;
    },
    watchStepCount(handler) {
      const fn = env().device.watchStepCount;
      return fn ? fn(handler) : { remove() {} };
    },
  };
  export default { Pedometer };`,

  'expo-keep-awake': `const env = () => (${ENV});
  export async function activateKeepAwakeAsync(tag) { (env().device.keepAwake ??= []).push(['on', tag]); }
  export async function deactivateKeepAwake(tag) { (env().device.keepAwake ??= []).push(['off', tag]); }
  export default { activateKeepAwakeAsync, deactivateKeepAwake };`,

  // 훅 파일이 import 될 때 터지지 않을 정도의 최소 구현.
  // 훅 자체의 동작은 화면 테스트(최정훈 Jest)에서 확인한다.
  react: `export function useState(initial) {
    let value = typeof initial === 'function' ? initial() : initial;
    return [value, (next) => { value = typeof next === 'function' ? next(value) : next; }];
  }
  export function useEffect() {}
  export function useMemo(factory) { return factory(); }
  export function useCallback(fn) { return fn; }
  export function useRef(initial) { return { current: initial }; }
  export function useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); }
  export function createElement(type, props, ...children) { return { type, props, children }; }
  export default { useState, useEffect, useMemo, useCallback, useRef, useSyncExternalStore, createElement };`,

  '@tanstack/react-query': `export class QueryClient {
    constructor(options = {}) { this.options = options; this.invalidated = []; this.cleared = 0; }
    invalidateQueries(filters) { this.invalidated.push(filters); }
    clear() { this.cleared += 1; }
    getQueryData() { return undefined; }
    setQueryData() {}
  }
  export function QueryClientProvider(props) { return props.children; }
  export function useQueryClient() { return new QueryClient(); }
  export function useQuery(options) { return { data: undefined, isLoading: true, isError: false, error: null, refetch() {}, options }; }
  export function useInfiniteQuery(options) {
    return { data: undefined, isLoading: true, isError: false, error: null, refetch() {}, fetchNextPage() {}, hasNextPage: false, options };
  }
  export function useMutation(options) {
    return { mutate() {}, mutateAsync: async () => undefined, isPending: false, isError: false, error: null, reset() {}, options };
  }
  export const focusManager = { setEventListener() {}, setFocused() {} };
  export default { QueryClient, QueryClientProvider, useQueryClient, useQuery, useInfiniteQuery, useMutation, focusManager };`,
};

/** 가짜로 바꿀 모듈이면 가상 URL로, 아니면 원래 해석기로. */
export async function resolve(specifier, context, nextResolve) {
  if (Object.prototype.hasOwnProperty.call(SOURCES, specifier)) {
    return { url: PREFIX + specifier, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

/** 가상 URL이면 위 소스 문자열을 그대로 모듈로 내어 준다. */
export async function load(url, context, nextLoad) {
  if (url.startsWith(PREFIX)) {
    return { format: 'module', source: SOURCES[url.slice(PREFIX.length)], shortCircuit: true };
  }
  return nextLoad(url, context);
}
