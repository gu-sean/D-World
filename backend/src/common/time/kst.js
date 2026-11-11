import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

// 비즈니스 날짜는 Asia/Seoul 기준(팀 문서 parts/backend §4.6)
const KST_ZONE = 'Asia/Seoul';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(date) {
  if (typeof date !== 'string' || !DATE_PATTERN.test(date)) {
    throw new RangeError(`잘못된 날짜 형식: ${date}`);
  }
  // 2026-02-31 같은 값은 dayjs가 보정하므로 되돌려 비교
  const parsed = dayjs.utc(date);
  if (!parsed.isValid() || parsed.format('YYYY-MM-DD') !== date) {
    throw new RangeError(`존재하지 않는 날짜: ${date}`);
  }
}

/** 시각 → KST 날짜(YYYY-MM-DD) */
export function kstDate(at = new Date()) {
  return dayjs(at).tz(KST_ZONE).format('YYYY-MM-DD');
}

/** KST 날짜 → 해당일 00:00(KST) 시각 */
export function kstDayStart(date) {
  assertDate(date);
  return dayjs.tz(date, KST_ZONE).toDate();
}

export function addDays(date, days) {
  assertDate(date);
  return dayjs.utc(date).add(days, 'day').format('YYYY-MM-DD');
}
