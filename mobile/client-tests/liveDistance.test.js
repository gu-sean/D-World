import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDistanceTracker,
  liveDistanceMeters,
  haversineMeters,
  MAX_ACCURACY_M,
  MIN_SEGMENT_M,
  MAX_SPEED_MPS,
} from '../src/client/running/liveDistance.js';

const BASE = Date.parse('2026-11-04T07:00:00.000Z');

/** 북쪽으로 `meters`만큼 간 지점. 위도 1도 ≈ 111,320m. */
function north(meters, { seconds = 1, acc = 8, paused = false } = {}) {
  return {
    lat: 36.799 + meters / 111320,
    lng: 127.074,
    acc,
    timestampMs: BASE + seconds * 1000,
    paused,
  };
}

test('하버사인: 북쪽으로 100m는 약 100m', () => {
  const d = haversineMeters({ lat: 36.799, lng: 127.074 }, { lat: 36.799 + 100 / 111320, lng: 127.074 });
  assert.ok(Math.abs(d - 100) < 1, `${d}m`);
});

test('기준값은 §7.3 그대로', () => {
  assert.equal(MAX_ACCURACY_M, 35);
  assert.equal(MIN_SEGMENT_M, 3);
  assert.equal(MAX_SPEED_MPS, 12);
});

test('곧게 달리면 구간 거리가 더해진다', () => {
  const points = [north(0, { seconds: 0 }), north(10, { seconds: 2 }), north(20, { seconds: 4 })];
  const meters = liveDistanceMeters(points);
  assert.ok(Math.abs(meters - 20) < 0.5, `${meters}m`);
});

test('정확도 35m보다 나쁜 지점은 쓰지 않는다', () => {
  const points = [
    north(0, { seconds: 0, acc: 8 }),
    north(50, { seconds: 2, acc: 36 }),   // 버림
    north(10, { seconds: 4, acc: 8 }),
  ];
  const meters = liveDistanceMeters(points);
  assert.ok(Math.abs(meters - 10) < 0.5, `${meters}m`);
});

test('정확도 35m는 경계 안쪽 — 쓴다', () => {
  const points = [north(0, { seconds: 0, acc: 35 }), north(10, { seconds: 2, acc: 35 })];
  assert.ok(liveDistanceMeters(points) > 9);
});

test('직전 지점과 3m 미만이면 건너뛴다 (가만히 있을 때 GPS 떨림)', () => {
  const points = [
    north(0, { seconds: 0 }),
    north(2, { seconds: 1 }),
    north(4, { seconds: 2 }),
    north(5, { seconds: 3 }),
  ];
  // 0→2(2m) 건너뜀, 0→4(4m) 더함, 4→5(1m) 건너뜀
  const meters = liveDistanceMeters(points);
  assert.ok(Math.abs(meters - 4) < 0.5, `${meters}m`);
});

test('3m 떨림이 이어져도 거리가 늘지 않는다', () => {
  const tracker = createDistanceTracker();
  for (let i = 0; i < 50; i += 1) {
    tracker.add({ lat: 36.799 + (i % 2) * 0.000009, lng: 127.074, acc: 8, timestampMs: BASE + i * 1000 });
  }
  assert.equal(tracker.meters, 0);
});

test('속도 12m/s를 넘는 구간은 버린다 (순간 이동)', () => {
  const points = [
    north(0, { seconds: 0 }),
    north(10, { seconds: 2 }),      // 5m/s — 더함
    north(1000, { seconds: 3 }),    // 990m/s — 버림
    north(1010, { seconds: 5 }),    // 5m/s — 더함
  ];
  const meters = liveDistanceMeters(points);
  assert.ok(Math.abs(meters - 20) < 1, `${meters}m`);
});

test('12m/s 정확히는 버리지 않는다 (초과만 버림)', () => {
  const points = [north(0, { seconds: 0 }), north(12, { seconds: 1 })];
  const meters = liveDistanceMeters(points);
  assert.ok(meters > 11, `${meters}m`);
});

test('쉬는 중 지점은 빼고 센다', () => {
  const points = [
    north(0, { seconds: 0 }),
    north(10, { seconds: 2 }),
    north(500, { seconds: 100, paused: true }),  // 쉬는 중 — 무시
    north(20, { seconds: 200 }),
  ];
  const meters = liveDistanceMeters(points);
  assert.ok(Math.abs(meters - 20) < 1, `${meters}m`);
});

test('좌표나 정확도가 없는 지점은 무시한다', () => {
  const points = [
    north(0, { seconds: 0 }),
    { lat: null, lng: 127.074, acc: 8, timestampMs: BASE + 1000 },
    { lat: 36.8, lng: 127.074, acc: null, timestampMs: BASE + 2000 },
    north(10, { seconds: 3 }),
  ];
  const meters = liveDistanceMeters(points);
  assert.ok(Math.abs(meters - 10) < 0.5, `${meters}m`);
});

test('빈 목록·한 점은 0m', () => {
  assert.equal(liveDistanceMeters([]), 0);
  assert.equal(liveDistanceMeters(undefined), 0);
  assert.equal(liveDistanceMeters([north(0, { seconds: 0 })]), 0);
});

test('tracker: add가 지금까지의 거리를 돌려주고 reset이 0으로 되돌린다', () => {
  const tracker = createDistanceTracker();
  tracker.add(north(0, { seconds: 0 }));
  const after = tracker.add(north(10, { seconds: 2 }));
  assert.ok(after > 9);
  assert.equal(after, tracker.meters);
  tracker.reset();
  assert.equal(tracker.meters, 0);
});
