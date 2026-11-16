/**
 * 흔들림(가속도) 센서 — 러닝 중 탈것을 거르는 보조 신호.
 *
 * 원본(초당 20번)은 너무 커서 기록 파일에 넣지 않고, 1초마다 두 값만 만든다.
 *   amp  흔들림 크기: 가속도 크기(g)의 표준편차. 달리기 0.5~1.5, 걷기 0.2~0.4, 차 안 0.1 미만
 *   freq 흔들림 주기(Hz): 평균을 가로지른 횟수 ÷ 2. 달리기는 보통 2.5~3.2
 *
 * 센서가 없으면 흔들림 없이 진행한다 (서버는 걸음 수로 대신 본다).
 */
import { Accelerometer } from 'expo-sensors';

const SAMPLE_MS = 50;

export async function isAvailable() {
  try {
    return Boolean(await Accelerometer.isAvailableAsync());
  } catch {
    return false;
  }
}

/** 1초 동안 모은 가속도 크기로 요약값을 만든다 (테스트용으로 내보냄). */
export function summarize(magnitudes) {
  const n = magnitudes.length;
  if (n < 4) return null;
  const mean = magnitudes.reduce((s, v) => s + v, 0) / n;
  const variance = magnitudes.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  let crossings = 0;
  for (let i = 1; i < n; i++) {
    if ((magnitudes[i - 1] - mean) * (magnitudes[i] - mean) < 0) crossings += 1;
  }
  const seconds = (n * SAMPLE_MS) / 1000;
  return {
    amp: Number(Math.sqrt(variance).toFixed(3)),
    freq: Number((crossings / 2 / seconds).toFixed(2)),
  };
}

/**
 * 1초마다 요약값을 받는다.
 * @param {(summary: {timestampMs: number, amp: number, freq: number}) => void} onSummary
 * @returns {() => void} 멈추는 함수
 */
export function watchMotion(onSummary) {
  let buffer = [];
  let windowStart = Date.now();
  let subscription = null;
  try {
    Accelerometer.setUpdateInterval(SAMPLE_MS);
    subscription = Accelerometer.addListener(({ x, y, z }) => {
      buffer.push(Math.sqrt(x * x + y * y + z * z));
      const now = Date.now();
      if (now - windowStart >= 1000) {
        const summary = summarize(buffer);
        buffer = [];
        windowStart = now;
        if (summary) onSummary({ timestampMs: now, ...summary });
      }
    });
  } catch {
    return () => {};
  }
  return () => {
    try {
      subscription?.remove?.();
    } catch {
      // 이미 멈춤
    }
  };
}

export default { isAvailable, watchMotion, summarize };
