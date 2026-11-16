/**
 * 영상 제출 대기열 (실제 연결). 규칙은 `submissionQueueCore.js`에 있다.
 *
 * - 항목 목록: 앱 전용 폴더의 `pending-submissions.json` (키체인·AsyncStorage 없이 blob-util만 쓴다)
 * - 영상 파일: 앱 전용 폴더 `pending-evidence/` (OS가 캐시를 비워도 남는다)
 * - 새 네이티브 모듈이 없어서 앱을 다시 빌드하지 않아도 된다
 *
 * `startSubmissionSync()`는 로그인된 동안 켜 둔다: 앱을 열 때·앞으로 올 때·다음 시도 시각이 되면
 * 대기열을 비운다. 사용자 화면에는 아무것도 더하지 않고, 포기한 경우에만 `onDropped`로 알린다.
 */
import { AppState } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { getSnapshot } from '../auth/session.js';
import { submitRecord } from '../api/recordsApi.js';
import { uploadEvidence } from './uploadEvidence.js';
import { createSubmissionQueue } from './submissionQueueCore.js';

const fs = ReactNativeBlobUtil.fs;
const dataDir = () => fs.dirs.DocumentDir;
const listPath = () => `${dataDir()}/pending-submissions.json`;
const evidenceDir = () => `${dataDir()}/pending-evidence`;

const storage = {
  async read() {
    if (!(await fs.exists(listPath()))) return null;
    return fs.readFile(listPath(), 'utf8');
  },
  async write(text) {
    await fs.writeFile(listPath(), text, 'utf8');
  },
};

const files = {
  /** 파일을 보관 폴더로 옮긴다. 이미 보관 폴더 안이면 그대로 쓴다. */
  async persist(path, name) {
    const dir = evidenceDir();
    if (path.startsWith(`${dir}/`)) return path;
    if (!(await fs.exists(dir))) await fs.mkdir(dir);
    const target = `${dir}/${name}`;
    await fs.cp(path, target);
    await fs.unlink(path).catch(() => {});
    return target;
  },
  async remove(path) {
    if (!path) return;
    await fs.unlink(path).catch(() => {});
  },
};

export const submissionQueue = createSubmissionQueue({
  storage,
  files,
  getUserId: () => getSnapshot().profile?.id ?? null,
  upload: (item) =>
    uploadEvidence(item.recordId, item.file, { idempotencyKey: item.keys.upload }),
  submit: (item) => {
    const clientMetrics = { appVersion: item.appVersion };
    if (item.file.durationSeconds !== null && item.file.durationSeconds !== undefined) {
      clientMetrics.videoDurationSeconds = item.file.durationSeconds;
    }
    return submitRecord({
      recordId: item.recordId,
      evidenceKind: 'camera_media',
      clientMetrics,
      idempotencyKey: item.keys.submit,
    });
  },
});

const MIN_DELAY_MS = 30_000;
const MAX_DELAY_MS = 3_600_000;

/** 포기한 이유를 사용자에게 보여 줄 문장으로. */
export function droppedMessage(event) {
  if (event.reason === 'expired') return '7일이 지나 인증 영상을 올리지 못했어요. 다시 인증해 주세요.';
  if (event.reason === 'overflow') return '대기 중인 영상이 너무 많아 오래된 영상을 지웠어요.';
  return event.error?.message ?? '인증 영상을 제출하지 못했어요. 다시 인증해 주세요.';
}

/**
 * 로그인된 동안 대기열을 돌본다.
 * @param {object} options
 * @param {() => void} [options.onSubmitted] 영상이 올라가 제출됐을 때 (목록 새로 읽기용)
 * @param {(message: string) => void} [options.onDropped] 포기했을 때 (알림 띠용)
 * @returns {() => void} 멈추기
 */
export function startSubmissionSync({ onSubmitted, onDropped } = {}) {
  let stopped = false;
  let timer = null;

  const offEvents = submissionQueue.onEvent((event) => {
    if (event.type === 'submitted') onSubmitted?.();
    if (event.type === 'queued') tick();
    if (event.type === 'dropped' && event.reason !== 'overflow') onDropped?.(droppedMessage(event));
  });

  async function tick() {
    if (stopped) return;
    clearTimeout(timer);
    try {
      await submissionQueue.flush();
    } catch {
      // 대기열 오류가 앱을 멈추게 하지 않는다. 다음 시도에 다시 본다.
    }
    if (stopped) return;
    const delay = await submissionQueue.nextDelayMs().catch(() => null);
    if (delay !== null && !stopped) {
      timer = setTimeout(tick, Math.min(Math.max(delay, MIN_DELAY_MS), MAX_DELAY_MS));
    }
  }

  const appState = AppState.addEventListener('change', (next) => {
    if (next === 'active') tick();
  });
  tick();

  return () => {
    stopped = true;
    clearTimeout(timer);
    appState.remove();
    offEvents();
  };
}

export default submissionQueue;
