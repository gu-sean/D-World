/**
 * 화면 표시용 서식 (tasks/mobile-client MC-04, 04 §6).
 *
 * 규칙 두 가지:
 *  1. API는 항상 **기본 단위**(거리 m, 시간 초, 포인트 정수)로 주고받는다.
 *     바꿔 보여 주는 일은 여기서만 한다.
 *  2. 날짜·시각은 기기 시간대가 아니라 **Asia/Seoul 고정**으로 계산한다.
 *     서버의 `date`가 KST 기준이므로 (05 §3), 기기 시간대가 달라도 같은 날짜가 나와야 한다.
 */

/** KST는 UTC+9 고정 (대한민국은 서머타임이 없다). */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 어떤 모양이든 밀리초로 바꾼다.
 * `'YYYY-MM-DD'`는 KST 자정으로 본다.
 * @param {string|number|Date} value
 * @returns {number|null} 알 수 없으면 null
 */
function toMs(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value);
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? Date.parse(`${text}T00:00:00+09:00`)
    : Date.parse(text);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * KST 기준의 연·월·일·요일·시·분을 꺼낸다.
 * UTC 메서드를 쓰는 이유: 9시간을 더한 뒤 UTC로 읽으면 기기 시간대와 무관하게 KST가 된다.
 */
function kstParts(value) {
  const ms = toMs(value);
  if (ms === null) return null;
  const shifted = new Date(ms + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
}

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * 오늘 날짜 (KST). `useHome()`·`useMissions()`의 기본값으로 쓴다.
 * @param {number} [nowMs] 테스트에서 시각을 고정할 때
 * @returns {string} `'2026-11-04'`
 */
export function todayKst(nowMs = Date.now()) {
  return toDateString(nowMs);
}

/**
 * 날짜를 서버가 쓰는 `YYYY-MM-DD`(KST)로 바꾼다.
 * @param {string|number|Date} value
 * @returns {string|null}
 */
export function toDateString(value) {
  const p = kstParts(value);
  if (!p) return null;
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/**
 * `11월 4일 (수)`
 * @param {string|number|Date} value `'2026-11-04'` 또는 ISO datetime
 * @param {{withYear?: boolean}} [options] `withYear`면 `2026년 11월 4일 (수)`
 * @returns {string} 알 수 없으면 `''`
 */
export function formatDate(value, options = {}) {
  const p = kstParts(value);
  if (!p) return '';
  const head = options.withYear ? `${p.year}년 ` : '';
  return `${head}${p.month}월 ${p.day}일 (${WEEKDAYS[p.weekday]})`;
}

/**
 * `오후 2:15` (KST).
 * @param {string|number|Date} value ISO datetime
 * @returns {string} 알 수 없으면 `''`
 */
export function formatTime(value) {
  const p = kstParts(value);
  if (!p) return '';
  const isAfternoon = p.hours >= 12;
  const hour12 = p.hours % 12 === 0 ? 12 : p.hours % 12;
  return `${isAfternoon ? '오후' : '오전'} ${hour12}:${pad2(p.minutes)}`;
}

/** `11월 4일 (수) 오후 2:15` */
export function formatDateTime(value, options = {}) {
  const date = formatDate(value, options);
  if (date === '') return '';
  return `${date} ${formatTime(value)}`;
}

/**
 * 걸린 시간을 시계 모양으로. `25:20` · `1:05:00`
 * @param {number} seconds 초
 * @returns {string}
 */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
  return `${m}:${pad2(s)}`;
}

/**
 * 거리. 1000 미만은 `850m`, 그 이상은 `3.12km` (소수점 끝의 0은 떼고).
 * @param {number} meters
 * @returns {string}
 */
export function formatDistance(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value)) return '';
  if (Math.abs(value) < 1000) return `${Math.round(value)}m`;
  const km = (value / 1000).toFixed(2).replace(/\.?0+$/, '');
  return `${km}km`;
}

/**
 * 포인트. `1,250P`
 * @param {number} points
 * @returns {string}
 */
export function formatPoints(points) {
  const value = Number(points);
  if (!Number.isFinite(value)) return '';
  return `${formatNumber(Math.trunc(value))}P`;
}

/** 천 단위 쉼표. `8,000` */
export function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('ko-KR');
}

/**
 * 비율(0~1)을 퍼센트로. `0.7213` → `72%`
 * @param {number} rate 05 §3의 `Rate`
 * @param {{digits?: number}} [options]
 * @returns {string}
 */
export function formatRate(rate, options = {}) {
  const value = Number(rate);
  if (!Number.isFinite(value)) return '';
  const digits = options.digits ?? 0;
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * 목표 값 + 단위 (04 §6 표의 "화면 표시 예").
 * @param {number} value 기본 단위 값
 * @param {'reps'|'seconds'|'meters'|'steps'|'pages'|'times'|'days'} unit
 * @returns {string} `20회` · `1분 30초` · `3.2km` · `8,000걸음`
 */
export function formatTarget(value, unit) {
  // 목표 값이 없는 미션(AI 없이 만든 계획 등)은 null로 온다. Number(null)은 0이라 "0"으로 보이므로 먼저 거른다.
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  switch (unit) {
    case 'reps':
    case 'times':
      return `${formatNumber(n)}회`;
    case 'seconds':
      return formatSpokenDuration(n);
    case 'meters':
      return formatDistance(n);
    case 'steps':
      return `${formatNumber(n)}걸음`;
    case 'pages':
      return `${formatNumber(n)}쪽`;
    case 'days':
      return `${formatNumber(n)}일`;
    default:
      return formatNumber(n);
  }
}

/**
 * 미션 한 줄 요약. 있는 것만 ` · `로 잇는다 (목표 값이 없으면 시간만, 앞에 구분점이 남지 않는다).
 * @param {{targetValue?: number|null, targetUnit?: string|null,
 *          estimatedDurationSeconds?: number|null, rewardPoints?: number|null}} mission
 * @returns {string} `20회 · 3분 · 20P` · `30분` · `` (아무 값도 없을 때)
 */
export function formatMissionMeta({
  targetValue,
  targetUnit,
  estimatedDurationSeconds,
  rewardPoints,
} = {}) {
  return [
    formatTarget(targetValue, targetUnit),
    estimatedDurationSeconds ? formatSpokenDuration(estimatedDurationSeconds) : '',
    rewardPoints ? formatPoints(rewardPoints) : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * 시간을 말하듯이. `6시간` · `1분 30초` · `5분`
 * @param {number} seconds
 * @returns {string}
 */
export function formatSpokenDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (total === 0) return '0초';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}시간`);
  if (m > 0) parts.push(`${m}분`);
  if (s > 0) parts.push(`${s}초`);
  return parts.join(' ');
}

/**
 * 며칠 전인지 (알림함·문의 목록). `방금` · `3분 전` · `어제` · `11월 4일 (수)`
 * @param {string|number|Date} value
 * @param {number} [nowMs]
 */
export function formatRelative(value, nowMs = Date.now()) {
  const ms = toMs(value);
  if (ms === null) return '';
  const diff = nowMs - ms;
  if (diff < 0) return formatDate(value);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const today = toDateString(nowMs);
  const that = toDateString(ms);
  const yesterday = toDateString(nowMs - 86400000);
  if (that === today) return `${hours}시간 전`;
  if (that === yesterday) return '어제';
  return formatDate(value);
}

/** `format` 객체로 한 번에 내보낸다 (parts/mobile-client §4.2). */
export const format = {
  todayKst,
  toDateString,
  formatDate,
  formatTime,
  formatDateTime,
  formatDuration,
  formatSpokenDuration,
  formatDistance,
  formatPoints,
  formatNumber,
  formatRate,
  formatTarget,
  formatMissionMeta,
  formatRelative,
};

export default format;
