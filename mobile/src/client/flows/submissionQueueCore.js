/**
 * 영상 제출 대기열의 핵심 규칙 (파일·네트워크는 밖에서 받는다 → 테스트하기 쉽다).
 *
 * 왜 필요한가: 운동하는 곳은 신호가 약하다. 촬영이 끝났는데 업로드가 끊기면 영상이 사라지거나
 * 사용자가 다시 찍어야 했다. 촬영한 영상을 **앱 전용 폴더에 먼저 보관**하고, 올라갈 때까지
 * 백그라운드에서 다시 시도한다. 올라간 영상은 기기에서 바로 지운다(서버가 보관).
 *
 * 항목 생명주기: `add`(보관) → 업로드 → `markUploaded` → 제출 → `complete`(기기에서 삭제)
 *  - 화면의 흐름(cameraVerification)이 올리는 동안은 "활성"이라 `flush`가 건드리지 않는다.
 *  - 앱이 꺼졌거나 흐름이 포기(`release`)한 항목은 `flush`가 이어서 올린다.
 *  - 멱등 키를 항목에 저장해 두므로 같은 키로 다시 보내도 서버에서 한 번만 처리된다.
 *
 * 일시 실패(네트워크·5xx·429·408)는 지수 백오프로 다시 시도하고,
 * 영구 실패(마감 지난 미션 등 4xx)와 7일 경과는 항목을 지우고 알린다.
 */

/** 항목을 보관하는 최대 기간. 넘으면 포기하고 알린다. */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** 다시 시도하는 간격(시도 횟수별). 마지막 값이 계속 쓰인다. */
export const BACKOFF_MS = [60_000, 120_000, 240_000, 480_000, 900_000, 1_800_000, 3_600_000];
/** 기기에 쌓아 둘 수 있는 대기 항목 수 (영상 용량 보호). */
export const MAX_ITEMS = 5;

export function backoffMs(attempts) {
  const index = Math.min(Math.max(attempts - 1, 0), BACKOFF_MS.length - 1);
  return BACKOFF_MS[index];
}

/** 잠깐 실패한 것인가 (다시 시도할 가치가 있는 실패). */
export function isTransientFailure(error) {
  if (!error) return false;
  if (error.isNetwork === true) return true;
  if (error.code === 'NETWORK_ERROR' || error.code === 'NETWORK_TIMEOUT') return true;
  if (error.code === 'UPLOAD_FAILED') return true;
  const status = Number(error.status ?? 0);
  return status >= 500 || status === 429 || status === 408;
}

/**
 * @typedef {object} QueueDeps
 * @property {{read: () => Promise<string|null>, write: (text: string) => Promise<void>}} storage
 * @property {{persist: (path: string, name: string) => Promise<string>, remove: (path: string) => Promise<void>}} files
 * @property {(item: object) => Promise<any>} upload 파일을 올리고 확인(A43~A44)
 * @property {(item: object) => Promise<any>} submit 제출(A45)
 * @property {() => string|null} getUserId 지금 로그인한 회원 ID
 * @property {() => number} [now]
 */

/** @param {QueueDeps} deps */
export function createSubmissionQueue(deps) {
  const now = deps.now ?? Date.now;
  /** @type {Array<object>|null} */
  let items = null;
  const active = new Set();
  const listeners = new Set();
  let saving = Promise.resolve();
  let flushing = null;

  async function load() {
    if (items) return items;
    try {
      const text = await deps.storage.read();
      const parsed = text ? JSON.parse(text) : [];
      items = Array.isArray(parsed) ? parsed : [];
    } catch {
      items = [];
    }
    return items;
  }

  /** 저장은 순서대로 한 번에 하나씩 (동시에 쓰면 파일이 섞일 수 있다). */
  function save() {
    saving = saving
      .catch(() => {})
      .then(() => deps.storage.write(JSON.stringify(items ?? [])));
    return saving;
  }

  function emit(event) {
    for (const listener of [...listeners]) {
      try {
        listener(event);
      } catch {
        // 듣는 쪽 오류가 대기열을 멈추게 하지 않는다.
      }
    }
  }

  async function drop(item, reason, error) {
    const list = await load();
    items = list.filter((entry) => entry.recordId !== item.recordId);
    active.delete(item.recordId);
    await save();
    await deps.files.remove(item.file?.path).catch(() => {});
    emit({ type: 'dropped', reason, item, error });
  }

  const api = {
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** 촬영한 파일을 앱 전용 폴더로 옮겨 두고 항목을 만든다. 이후 올릴 때는 돌려준 경로를 쓴다. */
    async add({ recordId, missionId, file, keys, appVersion }) {
      const list = await load();
      if (list.length >= MAX_ITEMS && !list.some((entry) => entry.recordId === recordId)) {
        // 가장 오래된 항목을 밀어낸다 (영상이 기기에 무한정 쌓이지 않게)
        await drop(list[0], 'overflow');
      }
      const ext = file.mimeType === 'image/jpeg' ? 'jpg' : 'mp4';
      const path = await deps.files.persist(file.path, `${recordId}.${ext}`);
      const item = {
        recordId,
        missionId,
        userId: deps.getUserId(),
        file: { ...file, path },
        keys,
        appVersion: appVersion ?? null,
        createdAt: now(),
        attempts: 0,
        nextAttemptAt: 0,
        uploaded: false,
      };
      items = (await load()).filter((entry) => entry.recordId !== recordId);
      items.push(item);
      active.add(recordId);
      await save();
      return item;
    },

    async markUploaded(recordId) {
      const entry = (await load()).find((it) => it.recordId === recordId);
      if (!entry) return;
      entry.uploaded = true;
      await save();
    },

    /** 화면 흐름이 손을 뗀다 (일시 실패). 다음 `flush`가 백오프 뒤에 이어서 올린다. */
    async release(recordId) {
      active.delete(recordId);
      const entry = (await load()).find((it) => it.recordId === recordId);
      if (!entry) return;
      entry.attempts += 1;
      entry.nextAttemptAt = now() + backoffMs(entry.attempts);
      await save();
      emit({ type: 'queued', item: entry });
    },

    /** 제출까지 끝났다 → 기기에서 지운다. */
    async complete(recordId) {
      const list = await load();
      const entry = list.find((it) => it.recordId === recordId);
      active.delete(recordId);
      if (!entry) return;
      items = list.filter((it) => it.recordId !== recordId);
      await save();
      await deps.files.remove(entry.file?.path).catch(() => {});
    },

    /** 사용자가 그만뒀다 → 항목과 파일을 지운다 (알리지 않는다). */
    async discard(recordId) {
      await api.complete(recordId);
    },

    /**
     * 대기 중인 항목을 올려 본다. 동시에 한 번만 돈다.
     * @returns {Promise<{sent: number, retry: number, dropped: number}>}
     */
    flush() {
      if (flushing) return flushing;
      flushing = (async () => {
        const summary = { sent: 0, retry: 0, dropped: 0 };
        const userId = deps.getUserId();
        for (const item of [...(await load())]) {
          if (active.has(item.recordId)) continue;
          if (now() - item.createdAt > MAX_AGE_MS) {
            await drop(item, 'expired');
            summary.dropped += 1;
            continue;
          }
          // 다른 회원의 항목은 건드리지 않는다 (그 회원이 로그인하면 올라간다)
          if (item.userId && userId && item.userId !== userId) continue;
          if (!userId || item.nextAttemptAt > now()) continue;

          active.add(item.recordId);
          try {
            if (!item.uploaded) {
              await deps.upload(item);
              item.uploaded = true;
              await save();
            }
            await deps.submit(item);
            await api.complete(item.recordId);
            summary.sent += 1;
            emit({ type: 'submitted', item });
          } catch (error) {
            if (isTransientFailure(error)) {
              item.attempts += 1;
              item.nextAttemptAt = now() + backoffMs(item.attempts);
              active.delete(item.recordId);
              await save();
              summary.retry += 1;
            } else {
              await drop(item, 'rejected', error);
              summary.dropped += 1;
            }
          }
        }
        return summary;
      })().finally(() => {
        flushing = null;
      });
      return flushing;
    },

    /** 다음 시도까지 남은 시간(ms). 대기 항목이 없으면 null. */
    async nextDelayMs() {
      const waiting = (await load()).filter((it) => !active.has(it.recordId));
      if (waiting.length === 0) return null;
      const soonest = Math.min(...waiting.map((it) => it.nextAttemptAt));
      return Math.max(0, soonest - now());
    },

    async pendingCount() {
      return (await load()).length;
    },
  };
  return api;
}
