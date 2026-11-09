/**
 * 러닝 인증 흐름 (parts/mobile-client §7).
 *
 * 카메라 흐름(§6)과 마찬가지로 **React 밖**에 산다 — 화면을 떠나도 기록이 끊기면 안 된다.
 *
 * 단계: `idle → preparing → ready → running ⇄ paused → finishing → uploading → submitting → waiting → done|pending`
 *
 * 러닝은 GPS가 없으면 인증할 수 없다. 걸음 센서는 없어도 진행한다 (서버가 감점만 한다).
 * 백그라운드 측정은 MVP 범위 밖이라, 앱이 내려가면 자동으로 일시정지한다.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import config from '../config.js';
import AppError from '../http/AppError.js';
import { newIdempotencyKey } from '../http/idempotency.js';
import { startRecord, abortRecord, submitRecord } from '../api/recordsApi.js';
import { ensure } from '../device/permissions.js';
import { watchPositions } from '../device/location.js';
import { isAvailable as pedometerAvailable, watchSteps } from '../device/pedometer.js';
import { activate as keepAwakeOn, deactivate as keepAwakeOff } from '../device/keepAwake.js';
import { cacheDir, writeGzipJson, removeFile, sha256OfFile } from '../device/files.js';
import { createDistanceTracker } from '../running/liveDistance.js';
import { buildRunFile, runFileName } from '../running/runFile.js';
import { uploadEvidence } from './uploadEvidence.js';
import { waitForDecision, POLL_INTERVAL_MS, DECISION_TIMEOUT_MS } from './waitForDecision.js';
import { afterVerificationDecided } from '../queries/invalidate.js';
import { MEDIA_LIMITS } from './cameraVerification.js';

/** §7.2의 기준값. */
export const READY_ACCURACY_M = 20;
export const READY_TIMEOUT_MS = 30 * 1000;
export const MAX_RUN_SECONDS = 7200;
const TICK_MS = 1000;

/** 테스트에서만 짧게 바꾼다 (3분·30초·2시간을 실제로 기다릴 수 없으므로). */
export const runTiming = {
  readyTimeoutMs: READY_TIMEOUT_MS,
  tickMs: TICK_MS,
  maxRunSeconds: MAX_RUN_SECONDS,
  pollIntervalMs: POLL_INTERVAL_MS,
  decisionTimeoutMs: DECISION_TIMEOUT_MS,
};

const IDLE_STATE = {
  phase: 'idle',
  elapsedSeconds: 0,
  activeSeconds: 0,
  distanceMeters: 0,
  steps: 0,
  gpsAccuracyM: null,
  paused: false,
  progress: 0,
  record: null,
  result: null,
  error: null,
};

/** @type {Map<string, ReturnType<typeof createEngine>>} */
const engines = new Map();

/** 미션 하나당 흐름 하나. */
export function getRunSession(missionId) {
  let engine = engines.get(missionId);
  if (!engine) {
    engine = createEngine(missionId);
    engines.set(missionId, engine);
  }
  return engine;
}

/** 테스트에서 모듈 상태를 되돌린다. */
export function __resetRunSessionsForTests() {
  for (const engine of engines.values()) engine.dispose();
  engines.clear();
}

function createEngine(missionId) {
  let state = IDLE_STATE;
  const listeners = new Set();
  const decidedListeners = new Set();
  let busy = false;

  // 기록 중인 값들
  let stopLocation = null;
  let stopSteps = null;
  let appStateSub = null;
  let ticker = null;
  let tracker = createDistanceTracker();

  let startedAtMs = 0;
  let endedAtMs = 0;
  let pausedTotalMs = 0;
  let pausedAtMs = 0;
  let points = [];
  let steps = [];
  let events = [];

  let keys = { start: null, upload: null, submit: null };
  let prepared = null;

  function set(patch) {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener(state);
  }

  function fail(error) {
    stopRecording();
    set({ phase: 'error', error: AppError.wrap(error) });
  }

  async function run(fn) {
    if (busy) return;
    busy = true;
    try {
      await fn();
    } catch (error) {
      fail(error);
    } finally {
      busy = false;
    }
  }

  function nowMs() {
    return Date.now();
  }

  /** 화면에 보여 줄 시간. `activeSeconds`는 쉰 시간을 뺀 값이다. */
  function tick() {
    if (state.phase !== 'running') return;
    const elapsedMs = nowMs() - startedAtMs;
    const activeMs = elapsedMs - pausedTotalMs;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    set({
      elapsedSeconds,
      activeSeconds: Math.max(0, Math.floor(activeMs / 1000)),
      distanceMeters: tracker.meters,
    });
    if (elapsedSeconds >= runTiming.maxRunSeconds) {
      events.push({ timestampMs: nowMs(), type: 'pause', reason: 'auto_stop' });
      // 2시간이 넘으면 스스로 끝낸다 (§7.2).
      api.finish();
    }
  }

  function startTicker() {
    if (ticker) return;
    ticker = setInterval(tick, runTiming.tickMs);
    ticker.unref?.();
  }

  function stopTicker() {
    if (ticker) clearInterval(ticker);
    ticker = null;
  }

  function stopRecording() {
    stopLocation?.();
    stopLocation = null;
    stopSteps?.();
    stopSteps = null;
    appStateSub?.remove?.();
    appStateSub = null;
    stopTicker();
    keepAwakeOff();
  }

  function onPoint(point) {
    set({ gpsAccuracyM: point.acc });
    if (state.phase !== 'running' && state.phase !== 'paused') return;
    // 받은 지점은 **거르지 않고 모두** 저장한다 (§7.2). 거르기는 화면 거리 계산에서만 한다.
    points.push(point);
    if (state.phase === 'running') {
      tracker.add(point);
      set({ distanceMeters: tracker.meters });
    }
  }

  /**
   * `Pedometer.watchStepCount`가 주는 값은 **구독 시작 이후 누적**이다 (§7.2).
   * 그대로 저장한다 — 따로 기준값을 빼지 않는다.
   */
  function onSteps(cumulative) {
    if (state.phase !== 'running' && state.phase !== 'paused') return;
    const count = Math.max(0, Math.trunc(cumulative));
    steps.push({ timestampMs: nowMs(), count });
    set({ steps: count });
  }

  function pauseInternal(reason) {
    if (state.phase !== 'running') return;
    pausedAtMs = nowMs();
    events.push({ timestampMs: pausedAtMs, type: 'pause', reason });
    stopTicker();
    set({ phase: 'paused', paused: true });
  }

  const api = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onDecided(listener) {
      decidedListeners.add(listener);
      return () => decidedListeners.delete(listener);
    },
    dispose: stopRecording,

    /**
     * 권한을 확인하고 GPS를 잡는다.
     * 위치 권한이 없으면 여기서 끝난다 — GPS 없이는 러닝을 인증할 수 없다.
     */
    prepare() {
      return run(async () => {
        set({ ...IDLE_STATE, phase: 'preparing' });

        const location = await ensure('location');
        if (location !== 'granted') {
          throw new AppError('PERMISSION_DENIED', 0, undefined, { kind: 'location', status: location });
        }
        // 걸음 권한은 물어만 보고, 거절해도 걸음 없이 진행한다 (§7.2).
        await ensure('activity');

        tracker = createDistanceTracker();
        points = [];
        steps = [];
        events = [];

        stopLocation = watchPositions(onPoint, () => {});

        // 정확도 20m 이하 지점이 오면 ready. 30초 안에 안 오면 GPS_UNAVAILABLE —
        // 그래도 start()는 막지 않는다 (§7.2).
        const gotFix = await new Promise((resolve) => {
          let done = false;
          const timer = setTimeout(() => {
            if (done) return;
            done = true;
            unsubscribe();
            resolve(false);
          }, runTiming.readyTimeoutMs);

          const unsubscribe = api.subscribe((next) => {
            if (done) return;
            if (typeof next.gpsAccuracyM === 'number' && next.gpsAccuracyM <= READY_ACCURACY_M) {
              done = true;
              clearTimeout(timer);
              unsubscribe();
              resolve(true);
            }
          });
        });

        set({ phase: 'ready', error: gotFix ? null : new AppError('GPS_UNAVAILABLE', 0) });
      });
    },

    /** A40으로 회차를 열고 기록을 시작한다. */
    start() {
      return run(async () => {
        if (!stopLocation) throw new AppError('GPS_UNAVAILABLE', 0);

        keys = { start: newIdempotencyKey(), upload: newIdempotencyKey(), submit: newIdempotencyKey() };
        const record = await startRecord({ missionId, idempotencyKey: keys.start });

        startedAtMs = nowMs();
        endedAtMs = 0;
        pausedTotalMs = 0;
        pausedAtMs = 0;
        points = [];
        steps = [];
        events = [];
        tracker.reset();

        if (await pedometerAvailable()) {
          stopSteps = watchSteps(onSteps);
        }

        await keepAwakeOn();
        appStateSub = AppState.addEventListener('change', (next) => {
          if (next !== 'active') pauseInternal('background');
        });

        set({ ...IDLE_STATE, phase: 'running', record, error: null });
        startTicker();
      });
    },

    /** 사용자가 누른 일시정지. */
    pause() {
      pauseInternal('user');
    },

    /** 백그라운드에서 돌아와도 자동 재개는 하지 않는다 — 사용자가 누른다 (§7.2). */
    resume() {
      if (state.phase !== 'paused') return;
      const at = nowMs();
      pausedTotalMs += at - pausedAtMs;
      pausedAtMs = 0;
      events.push({ timestampMs: at, type: 'resume', reason: 'user' });
      set({ phase: 'running', paused: false });
      startTicker();
    },

    /** 기록을 끝내고 파일을 만들어 올린다. */
    finish() {
      return run(async () => {
        if (state.phase !== 'running' && state.phase !== 'paused') return;

        endedAtMs = nowMs();
        if (state.phase === 'paused' && pausedAtMs > 0) pausedTotalMs += endedAtMs - pausedAtMs;
        stopRecording();
        set({ phase: 'finishing', paused: false });

        const recordId = state.record?.id;
        const activeSeconds = Math.max(0, Math.floor((endedAtMs - startedAtMs - pausedTotalMs) / 1000));
        const runFile = buildRunFile({
          recordId,
          startedAtMs,
          endedAtMs,
          points,
          steps,
          events,
          summary: {
            distanceMeters: tracker.meters,
            activeSeconds,
            steps: steps.length > 0 ? steps.at(-1).count : 0,
          },
        });

        const path = `${cacheDir()}/${runFileName(recordId)}`;
        const { sizeBytes } = await writeGzipJson(path, runFile);
        if (sizeBytes > MEDIA_LIMITS.sensor_raw) {
          throw new AppError('FILE_TOO_LARGE', 0, undefined, { sizeBytes, limit: MEDIA_LIMITS.sensor_raw });
        }

        prepared = {
          path,
          mediaKind: 'sensor_raw',
          mimeType: 'application/gzip',
          sizeBytes,
          checksumSha256: await sha256OfFile(path),
          clientMetrics: {
            distanceMeters: runFile.clientSummary.distanceMeters,
            activeSeconds: runFile.clientSummary.activeSeconds,
            steps: runFile.clientSummary.steps,
            appVersion: config.APP_VERSION,
          },
        };

        await uploadSubmitWait(recordId);
      });
    },

    /** 업로드·제출이 실패한 뒤 **같은 파일·같은 키**로 다시. */
    retryUpload() {
      return run(async () => {
        if (!prepared || !state.record?.id) throw new AppError('UPLOAD_FAILED', 0);
        await uploadSubmitWait(state.record.id);
      });
    },

    /** 그만두기. 회차를 정리하고 파일을 지운다. */
    cancel() {
      return run(async () => {
        stopRecording();
        const recordId = state.record?.id;
        if (recordId) await abortRecord(recordId).catch(() => {});
        await removeFile(prepared?.path);
        prepared = null;
        set({ ...IDLE_STATE });
      });
    },
  };

  async function uploadSubmitWait(recordId) {
    set({ phase: 'uploading', progress: 0, error: null });
    await uploadEvidence(recordId, prepared, {
      idempotencyKey: keys.upload,
      onProgress: (progress) => set({ progress }),
    });

    set({ phase: 'submitting', progress: 1 });
    const submitted = await submitRecord({
      recordId,
      evidenceKind: 'sensor_raw',
      clientMetrics: prepared.clientMetrics,
      idempotencyKey: keys.submit,
    });
    set({ record: submitted });

    set({ phase: 'waiting' });
    const { record, timedOut } = await waitForDecision(recordId, {
      intervalMs: runTiming.pollIntervalMs,
      timeoutMs: runTiming.decisionTimeoutMs,
    });
    if (timedOut) {
      set({ phase: 'pending', record, error: null });
      return;
    }

    set({ phase: 'done', record, result: record?.currentResult ?? null, error: null });
    for (const listener of [...decidedListeners]) listener(record);

    if (record?.status === 'approved' || record?.status === 'rejected') {
      await removeFile(prepared?.path);
    }
  }

  return api;
}

/**
 * 러닝 흐름 훅 (parts/mobile-client §4.2·§7.1).
 *
 * ```js
 * const run = useRunSession(missionId);
 * run.prepare(); run.start(); run.pause(); run.resume(); run.finish(); run.cancel();
 * ```
 */
export function useRunSession(missionId) {
  const engine = getRunSession(missionId);
  const queryClient = useQueryClient();

  const state = useSyncExternalStore(engine.subscribe, engine.getState, engine.getState);

  useEffect(() => engine.onDecided(() => afterVerificationDecided(queryClient)), [engine, queryClient]);

  return {
    state,
    prepare: engine.prepare,
    start: engine.start,
    pause: engine.pause,
    resume: engine.resume,
    finish: engine.finish,
    retryUpload: engine.retryUpload,
    cancel: engine.cancel,
  };
}

export default useRunSession;
