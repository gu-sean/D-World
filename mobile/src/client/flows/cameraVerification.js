/**
 * 카메라 인증 흐름 (parts/mobile-client §6).
 *
 * 흐름은 **React 밖**(모듈 변수)에 산다. 화면을 떠나도 업로드가 멈추지 않아야 하고,
 * 같은 미션으로 돌아오면 하던 곳부터 보여야 하기 때문이다 (§6 마지막 줄).
 * `useCameraVerification(missionId)`는 그 흐름을 구독만 한다.
 *
 * 단계: `idle → starting → capturing → preparing → uploading → submitting → waiting → done|pending`
 * 어디서든 실패하면 `error`, 거기서 `retryUpload()` 또는 `start()`로 다시 간다.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import config from '../config.js';
import AppError from '../http/AppError.js';
import { newIdempotencyKey } from '../http/idempotency.js';
import { startRecord, abortRecord, submitRecord } from '../api/recordsApi.js';
import { getMission } from '../api/missionsApi.js';
import { captureVideo, capturePhoto, VIDEO_DURATION_LIMIT_SECONDS } from '../device/camera.js';
import { compressVideo, sha256OfFile, statFile, removeFile } from '../device/files.js';
import { uploadEvidence } from './uploadEvidence.js';
import { waitForDecision, POLL_INTERVAL_MS, DECISION_TIMEOUT_MS } from './waitForDecision.js';
import { afterVerificationDecided } from '../queries/invalidate.js';

/** 05 §11 파일 업로드 규격. */
export const MEDIA_LIMITS = {
  camera_video: 80 * 1024 * 1024,
  camera_photo: 10 * 1024 * 1024,
  sensor_raw: 5 * 1024 * 1024,
};

const IDLE_STATE = { phase: 'idle', progress: 0, record: null, result: null, error: null };

/**
 * 결과를 기다리는 간격·한계. 기본값은 parts/mobile-client §6 그대로이고,
 * 테스트에서만 짧게 바꾼다 (3분을 실제로 기다릴 수는 없으므로).
 */
export const flowTiming = {
  pollIntervalMs: POLL_INTERVAL_MS,
  decisionTimeoutMs: DECISION_TIMEOUT_MS,
};

/** @type {Map<string, ReturnType<typeof createEngine>>} */
const engines = new Map();

/** 미션 하나당 흐름 하나. */
export function getCameraVerification(missionId) {
  let engine = engines.get(missionId);
  if (!engine) {
    engine = createEngine(missionId);
    engines.set(missionId, engine);
  }
  return engine;
}

/** 테스트에서 모듈 상태를 되돌린다. */
export function __resetCameraFlowsForTests() {
  engines.clear();
}

function createEngine(missionId) {
  let state = IDLE_STATE;
  const listeners = new Set();

  /** 이번 시도에서 쓰는 멱등 키들. 재시도할 때 **같은 키**를 써야 한다 (05 §5.1). */
  let keys = { start: null, upload: null, submit: null };
  /** 올릴 파일. `retryUpload()`가 다시 쓴다. */
  let prepared = null;
  /** 판정이 나면 알려 준다 (훅이 캐시 무효화에 쓴다). */
  const decidedListeners = new Set();
  let busy = false;

  function set(patch) {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener(state);
  }

  function fail(error) {
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

  /** 촬영 → 길이·크기 검사 → 해시. 올릴 준비가 끝난 파일을 돌려준다. */
  async function captureAndPrepare(exerciseCode) {
    set({ phase: 'capturing', error: null });
    const isVideo = Boolean(exerciseCode);
    const shot = isVideo ? await captureVideo() : await capturePhoto();

    set({ phase: 'preparing' });

    let path = shot.path;
    let durationSeconds = shot.durationSeconds;

    if (isVideo) {
      if (typeof durationSeconds === 'number' && durationSeconds > VIDEO_DURATION_LIMIT_SECONDS) {
        throw new AppError('VIDEO_TOO_LONG', 0, undefined, { durationSeconds });
      }
      path = await compressVideo(path);
    }

    const mediaKind = isVideo ? 'camera_video' : 'camera_photo';
    const { sizeBytes } = await statFile(path);
    if (sizeBytes > MEDIA_LIMITS[mediaKind]) {
      throw new AppError('FILE_TOO_LARGE', 0, undefined, { sizeBytes, limit: MEDIA_LIMITS[mediaKind] });
    }

    const checksumSha256 = await sha256OfFile(path);

    return {
      path,
      mediaKind,
      mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
      sizeBytes,
      checksumSha256,
      durationSeconds: isVideo ? durationSeconds : null,
    };
  }

  /** 업로드 → 제출 → 결과 기다리기. `retryUpload()`도 여기로 들어온다. */
  async function uploadSubmitWait(recordId) {
    set({ phase: 'uploading', progress: 0, error: null });
    await uploadEvidence(recordId, prepared, {
      idempotencyKey: keys.upload,
      onProgress: (progress) => set({ progress }),
    });

    set({ phase: 'submitting', progress: 1 });
    const clientMetrics = { appVersion: config.APP_VERSION };
    if (prepared.durationSeconds !== null && prepared.durationSeconds !== undefined) {
      clientMetrics.videoDurationSeconds = prepared.durationSeconds;
    }
    const submitted = await submitRecord({
      recordId,
      evidenceKind: 'camera_media',
      clientMetrics,
      idempotencyKey: keys.submit,
    });
    set({ record: submitted });

    set({ phase: 'waiting' });
    const { record, timedOut } = await waitForDecision(recordId, {
      intervalMs: flowTiming.pollIntervalMs,
      timeoutMs: flowTiming.decisionTimeoutMs,
    });
    if (timedOut) {
      set({ phase: 'pending', record, error: null });
      return;
    }

    const result = record?.currentResult ?? null;
    set({ phase: 'done', record, result, error: null });
    for (const listener of [...decidedListeners]) listener(record);

    // 승인·거절이면 임시 파일을 지운다 (§6 done 칸).
    if (record?.status === 'approved' || record?.status === 'rejected') {
      await removeFile(prepared?.path);
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onDecided(listener) {
      decidedListeners.add(listener);
      return () => decidedListeners.delete(listener);
    },

    /**
     * 회차를 시작하고 촬영부터 결과까지 간다.
     * @param {{exerciseCode?: string|null}} [options] 미션 정보를 이미 알면 넘긴다 (A32를 아낀다)
     */
    start(options = {}) {
      return run(async () => {
        keys = { start: newIdempotencyKey(), upload: newIdempotencyKey(), submit: newIdempotencyKey() };
        prepared = null;
        set({ ...IDLE_STATE, phase: 'starting' });

        let exerciseCode = options.exerciseCode;
        if (exerciseCode === undefined) {
          const mission = await getMission(missionId);
          exerciseCode = mission?.exerciseCode ?? null;
        }

        const record = await startRecord({ missionId, idempotencyKey: keys.start });
        set({ record });

        try {
          prepared = await captureAndPrepare(exerciseCode);
        } catch (error) {
          // 촬영을 취소하면 회차를 정리하고 처음으로 돌아간다 (§6 capturing 칸).
          if (error instanceof AppError && error.code === 'CAPTURE_CANCELLED') {
            await abortRecord(record.id).catch(() => {});
            set({ ...IDLE_STATE });
            return;
          }
          throw error;
        }

        await uploadSubmitWait(record.id);
      });
    },

    /** 업로드·제출이 실패한 뒤 **같은 파일·같은 멱등 키**로 다시 (§6 error 칸). */
    retryUpload() {
      return run(async () => {
        if (!prepared || !state.record?.id) {
          throw new AppError('UPLOAD_FAILED', 0);
        }
        await uploadSubmitWait(state.record.id);
      });
    },

    /** 그만하기 (A42). 회차가 이미 제출됐으면 서버가 409를 준다 — 조용히 넘긴다. */
    cancel() {
      return run(async () => {
        const recordId = state.record?.id;
        if (recordId) await abortRecord(recordId).catch(() => {});
        await removeFile(prepared?.path);
        prepared = null;
        set({ ...IDLE_STATE });
      });
    },
  };
}

/**
 * 카메라 인증 흐름 훅 (parts/mobile-client §4.2·§6).
 *
 * ```js
 * const v = useCameraVerification(missionId);
 * v.state.phase; v.start(); v.retryUpload(); v.cancel();
 * ```
 *
 * @param {string} missionId
 */
export function useCameraVerification(missionId) {
  const engine = getCameraVerification(missionId);
  const queryClient = useQueryClient();

  const state = useSyncExternalStore(engine.subscribe, engine.getState, engine.getState);

  useEffect(() => engine.onDecided(() => afterVerificationDecided(queryClient)), [engine, queryClient]);

  return {
    state,
    start: engine.start,
    retryUpload: engine.retryUpload,
    cancel: engine.cancel,
  };
}

export default useCameraVerification;
