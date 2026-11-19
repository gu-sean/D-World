import { RULES, analyzeRun, haversineMeters } from './run-rules.js';

/**
 * 러닝 기록 파일(dworld-run v1)을 관리자 웹이 그릴 경로로 바꾼다 (저장하지 않고 요청 때마다 계산).
 *
 * - 판정과 같은 규칙으로 점을 거른다: 모의 위치·정확도 나쁜 점·순간이동 같은 점은 뺀다
 * - 30초 구간 판정(run-rules의 windows)에서 탈것으로 본 구간은 kind='vehicle'로 나눈다 (거리에서 빠진 구간)
 * - 이동거리 표시는 판정이 쓴 유효 거리(탈것 구간 제외)를 기준으로 일정 간격마다 찍는다
 */

const MAX_POINTS = 600;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** 총 거리에 따라 표시 간격(m)을 고른다 — 표시가 너무 많거나 적지 않게 */
export function markerStepMeters(totalMeters) {
  if (totalMeters <= 600) return 100;
  if (totalMeters <= 2500) return 250;
  if (totalMeters <= 6000) return 500;
  return 1000;
}

/** 점이 너무 많으면 줄인다. 처음·끝과 종류가 바뀌는 점은 남긴다 */
function thin(points) {
  if (points.length <= MAX_POINTS) return points;
  const every = Math.ceil(points.length / MAX_POINTS);
  return points.filter(
    (p, i) =>
      i === 0 ||
      i === points.length - 1 ||
      i % every === 0 ||
      p.kind !== points[i - 1].kind ||
      p.kind !== points[i + 1]?.kind,
  );
}

/**
 * @param {object} file dworld-run 파일
 * @returns {{distanceMeters:number, vehicleMeters:number, durationSeconds:number, startedAt:?string, endedAt:?string,
 *            markerEveryMeters:number, start:?{lat:number,lng:number}, end:?{lat:number,lng:number},
 *            segments:Array<{kind:'run'|'vehicle', points:number[][]}>, markers:Array<{meters:number,lat:number,lng:number}>}}
 */
export function buildRunRoute(file) {
  const { windows, summary } = analyzeRun(file);
  const raw = [...(file?.points ?? [])]
    .filter((p) => num(p.t) !== null)
    .sort((a, b) => a.t - b.t);
  const isVehicle = (t) =>
    windows.some((w) => w.kind === 'vehicle' && t > w.from && t <= w.to);

  const usable = [];
  let last = null;
  let cumulative = 0;
  for (const p of raw) {
    if (p.mocked === true) continue;
    const acc = num(p.acc);
    if (num(p.lat) === null || num(p.lng) === null || acc === null) continue;
    if (acc > RULES.maxAccuracyM) continue;
    if (last) {
      const meters = haversineMeters(last, p);
      const seconds = p.t - last.t;
      if (meters < RULES.minSegmentM) continue;
      if (seconds > 0 && meters / seconds > RULES.jumpSpeedMps) continue;
      const vehicle = isVehicle(p.t);
      if (!vehicle) cumulative += meters;
      usable.push({
        lat: p.lat,
        lng: p.lng,
        kind: vehicle ? 'vehicle' : 'run',
        cumulative,
      });
    } else {
      usable.push({ lat: p.lat, lng: p.lng, kind: 'run', cumulative: 0 });
    }
    last = p;
  }

  const total = summary.validMeters;
  const step = markerStepMeters(total);
  // 점으로 센 거리와 판정 거리의 작은 차이를 맞춰, 표시가 판정 거리 기준이 되게 한다
  const scale = cumulative > 0 ? total / cumulative : 1;
  const markers = [];
  for (let target = step; target < total - step * 0.2; target += step) {
    const hit = usable.find(
      (p) => p.kind !== 'vehicle' && p.cumulative * scale >= target,
    );
    if (hit) markers.push({ meters: target, lat: hit.lat, lng: hit.lng });
  }

  const points = thin(usable);
  const segments = [];
  for (const p of points) {
    const current = segments.at(-1);
    if (current && current.kind === p.kind) {
      current.points.push([p.lat, p.lng]);
    } else {
      // 종류가 바뀌는 곳은 앞 구간의 마지막 점에서 이어서 그린다
      const joint = current ? current.points.at(-1) : null;
      segments.push({
        kind: p.kind,
        points: joint ? [joint, [p.lat, p.lng]] : [[p.lat, p.lng]],
      });
    }
  }

  return {
    distanceMeters: Math.round(total),
    vehicleMeters: Math.round(summary.vehicleMeters),
    durationSeconds: Math.round(summary.activeSeconds),
    startedAt: file?.startedAt ?? null,
    endedAt: file?.endedAt ?? null,
    markerEveryMeters: step,
    start: usable.length ? { lat: usable[0].lat, lng: usable[0].lng } : null,
    end: usable.length
      ? { lat: usable.at(-1).lat, lng: usable.at(-1).lng }
      : null,
    segments: segments.filter((s) => s.points.length >= 2),
    markers,
  };
}
