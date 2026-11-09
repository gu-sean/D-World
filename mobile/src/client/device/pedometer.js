/**
 * 걸음 센서 (parts/mobile-client §7.2).
 *
 * 센서가 없거나 권한이 없으면 **걸음 없이 진행한다** (`steps: []`).
 * 러닝 인증은 GPS가 필수이고 걸음은 교차 검증용이라 서버가 감점만 한다 (parts/ai §7.3).
 */
import { Pedometer } from 'expo-sensors';

/**
 * 이 기기에 걸음 센서가 있는지.
 * @returns {Promise<boolean>}
 */
export async function isAvailable() {
  try {
    return Boolean(await Pedometer.isAvailableAsync());
  } catch {
    return false;
  }
}

/**
 * 걸음 수를 계속 받는다. 값은 **구독 시작 이후 누적**이다.
 * @param {(steps: number) => void} onSteps
 * @returns {() => void} 멈추는 함수
 */
export function watchSteps(onSteps) {
  let subscription = null;
  try {
    subscription = Pedometer.watchStepCount((result) => {
      const steps = Number(result?.steps);
      if (Number.isFinite(steps)) onSteps(steps);
    });
  } catch {
    return () => {};
  }

  return () => {
    try {
      subscription?.remove?.();
    } catch {
      // 이미 떼어졌으면 그만이다.
    }
    subscription = null;
  };
}

export default { isAvailable, watchSteps };
