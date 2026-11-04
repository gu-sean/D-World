// 비즈니스 날짜는 Asia/Seoul 기준, KST는 DST가 없어 고정 오프셋(+09:00)으로 정확히 계산 가능
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(date) {
  if (!DATE_PATTERN.test(date)) {
    throw new RangeError(`잘못된 날짜 형식: ${date}`);
  }
  // 2026-02-31 같은 값은 Date가 보정하므로 되돌려 비교
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new RangeError(`존재하지 않는 날짜: ${date}`);
  }
}

/** 시각 → KST 날짜(YYYY-MM-DD) */
export function kstDate(at = new Date()) {
  return new Date(at.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** KST 날짜 → 해당일 00:00(KST) 시각 */
export function kstDayStart(date) {
  assertDate(date);
  return new Date(Date.parse(`${date}T00:00:00Z`) - KST_OFFSET_MS);
}

/** [해당일 00:00, 다음 날 00:00) 구간, 제출 마감 판정용 */
export function kstDayRange(date) {
  const start = kstDayStart(date);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export function addDays(date, days) {
  assertDate(date);
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** 시각이 KST 날짜 안(다음 날 00:00 전)인지 */
export function isWithinKstDay(at, date) {
  const { start, end } = kstDayRange(date);
  return at >= start && at < end;
}

/** 시각 → KST 월 시작일(YYYY-MM-01), 월간 한도 집계 키 */
export function kstMonthStart(at = new Date()) {
  return `${kstDate(at).slice(0, 7)}-01`;
}
