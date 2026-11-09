/**
 * 판정 결과 기다리기 (parts/mobile-client §6 `waiting` 칸, 08 §9).
 *
 * A41을 2초마다 부르고, 회차 `status`가 `approved`·`rejected`·`review_required`가 되면 끝낸다.
 * 3분이 지나면 **오류가 아니라** `DECISION_TIMEOUT`으로 끝낸다 — 결과는 알림으로 온다.
 */
import { getRecord } from '../api/recordsApi.js';
import AppError from '../http/AppError.js';

/** A45 응답의 `pollAfterMs`와 같은 값 (08 A45). */
export const POLL_INTERVAL_MS = 2000;
/** 최대 3분 (parts/mobile-client §6). */
export const DECISION_TIMEOUT_MS = 3 * 60 * 1000;

/** 더 기다릴 필요가 없는 상태 (04 §5 `mission_records.status`). */
export const FINAL_STATUSES = ['approved', 'rejected', 'review_required'];

const sleep = (ms, signal) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener?.('abort', () => {
    clearTimeout(timer);
    resolve();
  }, { once: true });
});

/**
 * 판정이 날 때까지 기다린다.
 *
 * @param {string} recordId
 * @param {object} [options]
 * @param {AbortSignal} [options.signal] 화면을 떠나도 흐름은 이어지므로, 정말 멈출 때만 넘긴다
 * @param {number} [options.intervalMs=2000]
 * @param {number} [options.timeoutMs=180000]
 * @param {() => number} [options.now] 테스트용 시계
 * @param {(record: object) => void} [options.onPoll] 부를 때마다 받은 회차
 * @returns {Promise<{record: object|null, timedOut: boolean}>}
 *          `timedOut: true`면 화면은 `pending`으로 간다 (오류 아님)
 */
export async function waitForDecision(recordId, {
  signal,
  intervalMs = POLL_INTERVAL_MS,
  timeoutMs = DECISION_TIMEOUT_MS,
  now = () => Date.now(),
  onPoll,
} = {}) {
  const startedAt = now();
  let last = null;

  for (;;) {
    if (signal?.aborted) return { record: last, timedOut: false };

    try {
      last = await getRecord(recordId, { signal });
      onPoll?.(last);
      if (FINAL_STATUSES.includes(last?.status)) {
        return { record: last, timedOut: false };
      }
    } catch (error) {
      // 네트워크가 잠깐 끊긴 것뿐일 수 있으니 계속 기다린다.
      // 그 밖의 오류(404·401 등)는 더 기다려도 달라지지 않는다.
      if (!(error instanceof AppError) || !error.isNetwork) throw error;
    }

    if (now() - startedAt >= timeoutMs) {
      return { record: last, timedOut: true };
    }

    await sleep(intervalMs, signal);
  }
}

export default waitForDecision;
