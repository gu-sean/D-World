/**
 * 러닝 원시 데이터 파일 (`sensor_raw`, 형식 `dworld-run` v1) — parts/mobile-client §8.
 *
 * 앱이 만들고 AI 서버가 읽는다 (parts/ai.md §7).
 * **필드를 바꾸려면 김재현·이연수 둘 다 승인해야 한다.**
 *
 * 좌표는 이 파일에만 있다. 올리고 판정이 나면 캐시 파일을 지운다.
 */
import { Platform } from 'react-native';

import config from '../config.js';

export const RUN_FILE_FORMAT = 'dworld-run';
export const RUN_FILE_VERSION = 1;

const pad = (n, width = 2) => String(n).padStart(width, '0');

/**
 * 밀리초를 `+09:00`이 붙은 ISO 문자열로 (§8 `startedAt`·`endedAt`).
 * 기기 시간대와 무관하게 KST로 적는다.
 * @param {number} ms
 * @returns {string} `2026-11-04T07:00:00.000+09:00`
 */
export function toKstIso(ms) {
  const d = new Date(Number(ms) + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    + `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
    + `.${pad(d.getUTCMilliseconds(), 3)}+09:00`;
}

/** 소수 자리를 맞춘다. `null`·숫자가 아닌 값은 `null`. */
function round(value, digits) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(digits));
}

/** `startedAt`부터 몇 초인지 (소수 2자리). */
function elapsed(timestampMs, startedAtMs) {
  return round((Number(timestampMs) - Number(startedAtMs)) / 1000, 2) ?? 0;
}

/**
 * 이 기기 정보 (§8 `device`).
 * `Platform.constants`는 Android에서 `Release`(OS 버전)·`Model`을 준다 —
 * 그래서 기기 정보 라이브러리를 더 넣지 않아도 된다.
 */
export function deviceInfo() {
  const constants = Platform.constants ?? {};
  return {
    platform: Platform.OS,
    osVersion: String(constants.Release ?? Platform.Version ?? ''),
    model: String(constants.Model ?? 'unknown'),
    appVersion: config.APP_VERSION,
  };
}

/**
 * @typedef {object} RunSessionData
 * @property {string} recordId A40에서 받은 회차 ID
 * @property {number} startedAtMs 기록 시작 (ms)
 * @property {number} endedAtMs 기록 종료 (ms)
 * @property {Array<{timestampMs: number, lat: number, lng: number, acc: number|null,
 *   alt: number|null, spd: number|null, mocked: boolean}>} points 받은 순서대로, 거르지 않고 전부
 * @property {Array<{timestampMs: number, count: number}>} steps 시작 이후 누적 걸음. 센서가 없으면 `[]`
 * @property {Array<{timestampMs: number, type: 'pause'|'resume', reason: 'user'|'background'|'auto_stop'}>} events
 * @property {{distanceMeters: number, activeSeconds: number, steps: number}} summary 화면에 보여 준 값
 */

/**
 * §8의 객체를 만든다.
 * @param {RunSessionData} session
 * @returns {object} 그대로 `JSON.stringify` → gzip 하면 되는 객체
 */
export function buildRunFile(session) {
  const { recordId, startedAtMs, endedAtMs, points = [], steps = [], events = [], summary } = session;

  return {
    format: RUN_FILE_FORMAT,
    version: RUN_FILE_VERSION,
    recordId,
    startedAt: toKstIso(startedAtMs),
    endedAt: toKstIso(endedAtMs),
    device: deviceInfo(),
    points: points.map((p) => ({
      t: elapsed(p.timestampMs, startedAtMs),
      lat: round(p.lat, 6),
      lng: round(p.lng, 6),
      acc: round(p.acc, 2),
      alt: round(p.alt, 2),
      spd: round(p.spd, 2),
      mocked: p.mocked === true,
    })),
    steps: steps.map((s) => ({
      t: elapsed(s.timestampMs, startedAtMs),
      count: Math.max(0, Math.trunc(Number(s.count) || 0)),
    })),
    events: events.map((e) => ({
      t: elapsed(e.timestampMs, startedAtMs),
      type: e.type,
      reason: e.reason,
    })),
    clientSummary: {
      distanceMeters: round(summary?.distanceMeters ?? 0, 1) ?? 0,
      activeSeconds: Math.max(0, Math.trunc(Number(summary?.activeSeconds) || 0)),
      steps: Math.max(0, Math.trunc(Number(summary?.steps) || 0)),
    },
  };
}

/** 캐시에 저장할 파일 이름 (§8). */
export function runFileName(recordId) {
  return `run-${recordId}.json.gz`;
}

export default { buildRunFile, runFileName, toKstIso, deviceInfo, RUN_FILE_FORMAT, RUN_FILE_VERSION };
