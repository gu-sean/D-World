/**
 * 화면에 보여 주는 거리 (parts/mobile-client §7.3).
 *
 * **서버 판정과는 상관없다.** 판정은 AI 서버가 원시 파일(§8)을 보고 따로 한다.
 * 여기 값은 `clientSummary.distanceMeters`로도 올라가지만, 서버는 비교만 한다.
 *
 * 거르는 규칙 네 가지:
 *  1. 정확도 35m보다 나쁜 지점은 쓰지 않는다
 *  2. 직전 지점과 3m 미만이면 건너뛴다 (가만히 있을 때 GPS가 떠는 것)
 *  3. 구간 속도가 12m/s를 넘으면 그 구간은 버린다 (43km/h — 달리기가 아니다)
 *  4. 쉬는 중(`paused`) 지점은 빼고 센다
 */

/** §7.3의 기준값. */
export const MAX_ACCURACY_M = 35;
export const MIN_SEGMENT_M = 3;
export const MAX_SPEED_MPS = 12;

const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * 두 좌표 사이 거리 (하버사인, m).
 * @param {{lat: number, lng: number}} a
 * @param {{lat: number, lng: number}} b
 * @returns {number}
 */
export function haversineMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function usable(point) {
  if (!point) return false;
  if (point.paused === true) return false;
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false;
  if (!Number.isFinite(point.acc)) return false;
  return point.acc <= MAX_ACCURACY_M;
}

/**
 * 지점을 하나씩 받아 거리를 더해 가는 계산기. 러닝 중 화면이 쓴다.
 * @returns {{add: (point: object) => number, get meters(): number, reset: () => void}}
 */
export function createDistanceTracker() {
  let last = null;
  let total = 0;

  return {
    /**
     * 지점 하나를 넣는다.
     * @param {{lat: number, lng: number, acc: number, timestampMs?: number, paused?: boolean}} point
     * @returns {number} 지금까지의 거리(m)
     */
    add(point) {
      if (!usable(point)) return total;
      if (!last) {
        last = point;
        return total;
      }

      const meters = haversineMeters(last, point);
      if (meters < MIN_SEGMENT_M) return total;

      const seconds = (Number(point.timestampMs) - Number(last.timestampMs)) / 1000;
      const tooFast = Number.isFinite(seconds) && seconds > 0 && meters / seconds > MAX_SPEED_MPS;

      // 너무 빠른 구간은 거리만 버리고 기준점은 옮긴다.
      // (기준점을 두고 오면 다음 구간이 그만큼을 다시 세게 된다.)
      if (!tooFast) total += meters;
      last = point;
      return total;
    },
    get meters() {
      return total;
    },
    reset() {
      last = null;
      total = 0;
    },
  };
}

/**
 * 모아 둔 지점으로 한 번에 계산한다 (파일 만들 때·테스트용).
 * @param {Array<object>} points
 * @returns {number} 미터
 */
export function liveDistanceMeters(points) {
  const tracker = createDistanceTracker();
  for (const point of points ?? []) tracker.add(point);
  return tracker.meters;
}

export default { createDistanceTracker, liveDistanceMeters, haversineMeters, MAX_ACCURACY_M, MIN_SEGMENT_M, MAX_SPEED_MPS };
