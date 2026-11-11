/**
 * 위치 (parts/mobile-client §7.2).
 *
 * **좌표는 러닝 원시 파일(§8)에만 들어간다.** 로그로 찍거나 다른 곳에 저장하지 않는다.
 */
import Geolocation from '@react-native-community/geolocation';

import AppError from '../http/AppError.js';

/** A90 상황 추천이 위치를 기다리는 시간 (tasks/mobile-client MC-10). */
export const QUICK_FIX_TIMEOUT_MS = 5000;

/** 러닝 기록용 watch 설정 — 받은 지점을 걸러내지 않고 모두 저장한다. */
export const RUN_WATCH_OPTIONS = {
  enableHighAccuracy: true,
  distanceFilter: 0,
  interval: 1000,
  fastestInterval: 1000,
};

/**
 * 기기 위치 객체를 우리 모양으로 바꾼다.
 * `mocked`(모의 위치)는 Android만 주므로 없으면 `false`로 둔다 (§7.2).
 */
export function toPoint(position) {
  const c = position?.coords ?? {};
  return {
    timestampMs: typeof position?.timestamp === 'number' ? position.timestamp : Date.now(),
    lat: c.latitude,
    lng: c.longitude,
    acc: typeof c.accuracy === 'number' ? c.accuracy : null,
    alt: typeof c.altitude === 'number' ? c.altitude : null,
    spd: typeof c.speed === 'number' ? c.speed : null,
    mocked: position?.mocked === true || c.mocked === true,
  };
}

/**
 * 지금 위치 한 번. 시간 안에 못 잡으면 `GPS_UNAVAILABLE`.
 * @param {{timeoutMs?: number}} [options]
 * @returns {Promise<{lat: number, lng: number, acc: number|null}>}
 * @throws {AppError} `GPS_UNAVAILABLE`
 */
export function getCurrentPosition({ timeoutMs = QUICK_FIX_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new AppError('GPS_UNAVAILABLE', 0));
    }, timeoutMs);

    Geolocation.getCurrentPosition(
      (position) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(toPoint(position));
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new AppError('GPS_UNAVAILABLE', 0));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

/**
 * 러닝 동안 위치를 계속 받는다.
 * @param {(point: ReturnType<typeof toPoint>) => void} onPoint
 * @param {(error: AppError) => void} [onError]
 * @returns {() => void} 멈추는 함수
 */
export function watchPositions(onPoint, onError) {
  let watchId = null;
  try {
    watchId = Geolocation.watchPosition(
      (position) => onPoint(toPoint(position)),
      () => onError?.(new AppError('GPS_UNAVAILABLE', 0)),
      RUN_WATCH_OPTIONS,
    );
  } catch {
    onError?.(new AppError('GPS_UNAVAILABLE', 0));
  }

  return () => {
    if (watchId === null || watchId === undefined) return;
    try {
      Geolocation.clearWatch(watchId);
    } catch {
      // 이미 멈췄으면 그만이다.
    }
    watchId = null;
  };
}

export default { getCurrentPosition, watchPositions, toPoint, QUICK_FIX_TIMEOUT_MS, RUN_WATCH_OPTIONS };
