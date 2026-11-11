import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// Same plugins as app/providers.jsx; extending twice is harmless and keeps this file testable.
dayjs.extend(utc);
dayjs.extend(timezone);

export const REASON_MAX = 500;

export const toIso = (value) => (value ? value.toISOString() : undefined);

export const formatTime = (value) =>
  value ? dayjs(value).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm') : '-';

/** The version that is in force now: latest effectiveAt that is not in the future. */
export function pickCurrent(items, now = Date.now()) {
  return items
    .filter((item) => new Date(item.effectiveAt).getTime() <= now)
    .sort(
      (a, b) =>
        new Date(b.effectiveAt) - new Date(a.effectiveAt) ||
        (b.versionNo ?? 0) - (a.versionNo ?? 0),
    )[0];
}
