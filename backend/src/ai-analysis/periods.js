import { addDays } from '../common/time/kst.js';

/** 날짜(YYYY-MM-DD)가 속한 주의 월요일 */
export function mondayOf(date) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=일
  return addDays(date, weekday === 0 ? -6 : 1 - weekday);
}

/** 오늘 기준으로 이미 끝난 지난주 (월~일) */
export function lastWeek(today) {
  const start = addDays(mondayOf(today), -7);
  return { start, end: addDays(start, 6) };
}

/** 오늘 기준으로 이미 끝난 지난달 (1일~말일) */
export function lastMonth(today) {
  const thisMonthStart = `${today.slice(0, 7)}-01`;
  const end = addDays(thisMonthStart, -1);
  return { start: `${end.slice(0, 7)}-01`, end };
}

/** 같은 길이의 바로 앞 기간 (달성률 비교용) */
export function previousPeriod(runType, period) {
  if (runType === 'monthly_report') {
    const end = addDays(period.start, -1);
    return { start: `${end.slice(0, 7)}-01`, end };
  }
  return { start: addDays(period.start, -7), end: addDays(period.start, -1) };
}

/** 달성률 (0~1, 소수 4자리), 계획이 없으면 null */
export function rateOf(done, total) {
  return total === 0 ? null : Number((done / total).toFixed(4));
}
