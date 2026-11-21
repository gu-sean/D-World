/**
 * 러닝 규칙 판정 (run-rule) — 앱의 실시간 화면과 서버의 최종 판정이 같은 규칙을 쓴다.
 *
 * ⚠ 같은 파일이 두 곳에 있다. 고치면 둘 다 똑같이 고친다.
 *   - backend/src/verification/run-rules/run-rules.js (서버 최종 판정)
 *   - mobile/src/client/running/runRules.js (앱 실시간 화면)
 *
 * 입력은 앱의 러닝 기록 파일(dworld-run v1)과 같은 모양이다.
 *   points: [{t, lat, lng, acc, spd, mocked}]   t = 시작 후 초
 *   steps:  [{t, count}]                          시작 후 누적 걸음 (센서 없으면 [])
 *   motion: [{t, amp, freq}]                      1초마다 흔들림 크기(g)·주기(Hz) (없으면 [])
 *   events: [{t, type: 'pause'|'resume'}]
 *
 * 30초 구간마다 속도(GPS)·케이던스(걸음)·흔들림(가속도)을 같이 보고,
 * GPS로는 움직이는데 달리는 몸의 신호가 없으면 탈것으로 보고 그 구간 거리를 뺀다.
 * 심박수는 폰으로 잴 수 없어 쓰지 않는다.
 */

export const RUN_RULE_VERSION = 'run-rule@1.1.0';

export const RULES = {
  maxAccuracyM: 35, // 이보다 나쁜 GPS 점은 거리에서 뺀다
  minSegmentM: 3, // 가만히 있을 때 GPS가 떠는 것
  jumpSpeedMps: 50, // 한 구간이 이보다 빠르면(180km/h) GPS 튐으로 보고 버린다. 차는 아래 구간 규칙이 잡는다
  windowSeconds: 30,
  movingSpeedMps: 0.5, // 이보다 느리면 멈춘 구간
  maxRunSpeedMps: 6.5, // 30초 평균이 이보다 빠르면 사람이 아니다 (1km 2분 34초)
  startZoneMeters: 200, // 뛰기 시작해서 이 거리까지는 오버페이스로 달릴 수 있어 상한을 높인다
  startMaxRunSpeedMps: 12, // 시작 구간의 상한. 사람 최고 속도(초속 10.4m)보다 높아 차는 여전히 걸린다
  checkSpeedMps: 2.0, // 이보다 빠를 때만 몸의 신호를 확인한다 (걷기는 통과)
  minCadenceSpm: 60, // 위 속도에서 분당 걸음이 이보다 적으면 탈것
  minMotionG: 0.12, // 위 속도에서 흔들림이 이보다 작으면 탈것
  maxVehicleRatio: 0.2, // 움직인 거리 중 탈것 구간이 이 비율을 넘으면 반려
  minPoints: 10,
  maxMockedPoints: 2, // 모의 위치 점이 이보다 많으면 반려
};

const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

export function haversineMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** 쉬는 구간 [{from, to}] */
function pausedRanges(events, endT) {
  const ranges = [];
  let from = null;
  for (const e of [...(events ?? [])].sort((a, b) => a.t - b.t)) {
    if (e.type === 'pause' && from === null) from = e.t;
    if (e.type === 'resume' && from !== null) {
      ranges.push({ from, to: e.t });
      from = null;
    }
  }
  if (from !== null) ranges.push({ from, to: endT });
  return ranges;
}

const inRanges = (t, ranges) => ranges.some((r) => t >= r.from && t < r.to);

/** GPS 점을 거리 구간으로: [{t0, t1, meters}] (거를 점은 거른다) */
function segmentsOf(points, paused) {
  const segments = [];
  let last = null;
  for (const p of points) {
    if (p.mocked === true) continue;
    const acc = num(p.acc);
    if (num(p.lat) === null || num(p.lng) === null || acc === null) continue;
    if (acc > RULES.maxAccuracyM) continue;
    if (inRanges(p.t, paused)) {
      last = null; // 쉬는 동안 옮긴 거리는 세지 않는다
      continue;
    }
    if (!last) {
      last = p;
      continue;
    }
    const meters = haversineMeters(last, p);
    if (meters < RULES.minSegmentM) continue;
    const seconds = p.t - last.t;
    if (seconds > 0 && meters / seconds <= RULES.jumpSpeedMps) {
      segments.push({ t0: last.t, t1: p.t, meters });
    }
    last = p;
  }
  return segments;
}

/** 누적 걸음에서 [from, to) 사이 걸음 수. 데이터가 없으면 null (2시간 기록도 화면에서 자주 다시 계산하므로 이분 탐색) */
function stepsBetween(steps, from, to) {
  if (!steps.length) return null;
  const at = (t) => {
    let lo = 0;
    let hi = steps.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (steps[mid].t <= t) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found < 0 ? 0 : steps[found].count;
  };
  return Math.max(0, at(to) - at(from));
}

/** [from, to) 사이 흔들림 평균. 데이터가 없으면 null */
function motionBetween(motion, from, to) {
  const inside = motion.filter(
    (m) => m.t >= from && m.t < to && num(m.amp) !== null,
  );
  if (!inside.length) return null;
  const amp = inside.reduce((sum, m) => sum + m.amp, 0) / inside.length;
  const freqs = inside.map((m) => num(m.freq)).filter((f) => f !== null);
  const freq = freqs.length
    ? freqs.reduce((a, b) => a + b, 0) / freqs.length
    : null;
  return { amp, freq };
}

/**
 * ACSM 공식으로 칼로리 (kcal). 몸무게가 없으면 null.
 * 달리기(분당 134m 이상): VO2 = 0.2 × 속도 + 3.5, 걷기: VO2 = 0.1 × 속도 + 3.5 (ml/kg/분)
 * 산소 1L ≈ 5kcal. 경사·심박은 반영하지 않는다.
 */
export function caloriesOf(speedMps, seconds, weightKg) {
  if (!(weightKg > 0) || !(seconds > 0)) return null;
  const metersPerMin = speedMps * 60;
  const vo2 =
    metersPerMin >= 134 ? 0.2 * metersPerMin + 3.5 : 0.1 * metersPerMin + 3.5;
  return (vo2 * weightKg * (seconds / 60) * 5) / 1000;
}

/**
 * 구간별로 나눠 본다.
 * @returns {{windows: Array, summary: object}}
 */
export function analyzeRun(file, { weightKg = null } = {}) {
  const points = [...(file?.points ?? [])]
    .filter((p) => num(p.t) !== null)
    .sort((a, b) => a.t - b.t);
  const steps = [...(file?.steps ?? [])]
    .filter((s) => num(s.t) !== null)
    .sort((a, b) => a.t - b.t);
  const motion = [...(file?.motion ?? [])]
    .filter((m) => num(m.t) !== null)
    .sort((a, b) => a.t - b.t);
  const endT = points.length ? points[points.length - 1].t : 0;
  const paused = pausedRanges(file?.events, endT);
  const segments = segmentsOf(points, paused);

  const windows = [];
  const size = RULES.windowSeconds;
  let metersBefore = 0; // 이 구간 앞까지 달린 거리 (시작 구간 판단용)
  for (let from = 0; from < endT; from += size) {
    const to = Math.min(from + size, endT);
    const span = to - from;
    if (span <= 0) break;
    const meters = segments
      .filter((s) => s.t1 > from && s.t1 <= to)
      .reduce((sum, s) => sum + s.meters, 0);
    const pausedSeconds = paused.reduce(
      (sum, r) =>
        sum + Math.max(0, Math.min(r.to, to) - Math.max(r.from, from)),
      0,
    );
    const activeSeconds = Math.max(0, span - pausedSeconds);
    const speed = activeSeconds > 0 ? meters / activeSeconds : 0;
    const stepCount = stepsBetween(steps, from, to);
    const cadence =
      stepCount === null || activeSeconds <= 0
        ? null
        : (stepCount / activeSeconds) * 60;
    const shake = motionBetween(motion, from, to);

    let kind = 'run';
    let reason = null;
    if (activeSeconds <= 0) kind = 'paused';
    else if (speed < RULES.movingSpeedMps) kind = 'still';
    else if (
      speed >
      (metersBefore < RULES.startZoneMeters
        ? RULES.startMaxRunSpeedMps
        : RULES.maxRunSpeedMps)
    ) {
      kind = 'vehicle';
      reason = 'speed';
    } else if (speed > RULES.checkSpeedMps) {
      if (cadence !== null && cadence < RULES.minCadenceSpm) {
        kind = 'vehicle';
        reason = 'cadence';
      } else if (shake && shake.amp < RULES.minMotionG) {
        kind = 'vehicle';
        reason = 'motion';
      }
    }
    if (kind !== 'vehicle') metersBefore += meters;
    windows.push({
      from,
      to,
      meters,
      activeSeconds,
      speed,
      cadence,
      motion: shake,
      kind,
      reason,
    });
  }

  const sum = (list, key) => list.reduce((s, w) => s + w[key], 0);
  const counted = windows.filter((w) => w.kind === 'run' || w.kind === 'still');
  const vehicle = windows.filter((w) => w.kind === 'vehicle');
  const validMeters = sum(counted, 'meters');
  const vehicleMeters = sum(vehicle, 'meters');
  const movingMeters = validMeters + vehicleMeters;
  const activeSeconds = sum(counted, 'activeSeconds');
  const totalSteps = steps.length ? steps[steps.length - 1].count : null;
  const cadenceWindows = counted.filter(
    (w) => w.cadence !== null && w.kind === 'run',
  );
  const avgCadence = cadenceWindows.length
    ? cadenceWindows.reduce((s, w) => s + w.cadence * w.activeSeconds, 0) /
      Math.max(1, sum(cadenceWindows, 'activeSeconds'))
    : null;
  let calories = null;
  if (weightKg > 0) {
    calories = counted.reduce(
      (s, w) => s + (caloriesOf(w.speed, w.activeSeconds, weightKg) ?? 0),
      0,
    );
  }
  const usablePoints = points.filter(
    (p) => num(p.acc) !== null && p.acc <= RULES.maxAccuracyM,
  ).length;

  return {
    windows,
    summary: {
      validMeters,
      vehicleMeters,
      vehicleRatio: movingMeters > 0 ? vehicleMeters / movingMeters : 0,
      activeSeconds,
      paceSecondsPerKm:
        validMeters >= 10 ? (activeSeconds / validMeters) * 1000 : null,
      avgCadenceSpm: avgCadence,
      steps: totalSteps,
      calories,
      pointCount: points.length,
      validPointRatio: points.length ? usablePoints / points.length : 0,
      mockedPoints: points.filter((p) => p.mocked === true).length,
      hasSteps: steps.length > 0,
      hasMotion: motion.length > 0,
    },
  };
}

const fmtKm = (m) => `${(m / 1000).toFixed(2)}km`;
const fmtMin = (s) => `${Math.floor(s / 60)}분 ${Math.round(s % 60)}초`;

/**
 * 최종 판정. 서버가 원본 파일로 다시 계산해 쓴다.
 * @param {object} file dworld-run 파일
 * @param {{targetValue: number, targetUnit: 'meters'|'seconds', weightKg?: number}} target
 * @returns {{decision: 'approved'|'rejected'|'review_required', reason: string, confidence: number,
 *           flags: string[], summary: object, windows: Array}}
 */
export function judgeRun(file, { targetValue, targetUnit, weightKg = null }) {
  const { windows, summary } = analyzeRun(file, { weightKg });
  const flags = [];
  const result = (decision, reason, confidence) => ({
    decision,
    reason,
    confidence,
    flags,
    summary,
    windows,
  });

  if (summary.mockedPoints > RULES.maxMockedPoints) {
    flags.push('mock_location');
    return result('rejected', '가짜 위치(모의 GPS)가 감지됐어요.', 0.95);
  }
  if (summary.pointCount < RULES.minPoints) {
    flags.push('too_few_points');
    return result(
      'rejected',
      'GPS 기록이 너무 적어요. 하늘이 보이는 곳에서 다시 뛰어 주세요.',
      0.9,
    );
  }
  if (summary.vehicleRatio > RULES.maxVehicleRatio) {
    flags.push('vehicle_detected');
    const pct = Math.round(summary.vehicleRatio * 100);
    return result(
      'rejected',
      `이동 거리의 ${pct}%가 탈것으로 이동한 것으로 보여요 (${fmtKm(summary.vehicleMeters)}).`,
      0.85,
    );
  }
  if (summary.vehicleMeters > 0) flags.push('vehicle_segments_excluded');
  if (!summary.hasSteps && !summary.hasMotion) {
    flags.push('no_body_signal');
    return result(
      'review_required',
      '걸음·흔들림 정보가 없어 사람이 확인해야 해요.',
      0.5,
    );
  }

  const target = Number(targetValue);
  if (targetUnit === 'seconds') {
    if (summary.activeSeconds >= target) {
      return result(
        'approved',
        `${fmtMin(summary.activeSeconds)} 달렸어요.`,
        0.9,
      );
    }
    flags.push('below_target');
    return result(
      'rejected',
      `목표 ${fmtMin(target)} 중 ${fmtMin(summary.activeSeconds)}만 확인됐어요.`,
      0.9,
    );
  }
  if (summary.validMeters >= target) {
    return result('approved', `${fmtKm(summary.validMeters)} 달렸어요.`, 0.9);
  }
  flags.push('below_target');
  return result(
    'rejected',
    `목표 ${fmtKm(target)} 중 ${fmtKm(summary.validMeters)}만 확인됐어요.`,
    0.9,
  );
}
