import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIME_ZONE = 'Asia/Seoul'; // docs/05 §3: dates are Asia/Seoul
const DATE_FORMAT = 'YYYY-MM-DD';

/** The longest period M05 accepts, in days (docs/09 §2). */
export const MAX_PERIOD_DAYS = 31;

/** Today in Asia/Seoul as `YYYY-MM-DD`. */
export const todayInSeoul = () => dayjs().tz(TIME_ZONE).format(DATE_FORMAT);

/** The last `days` days up to and including today, e.g. `lastDays(7)` -> `{from, to}`. */
export function lastDays(days) {
  const today = dayjs().tz(TIME_ZONE);
  return {
    from: today.subtract(days - 1, 'day').format(DATE_FORMAT),
    to: today.format(DATE_FORMAT),
  };
}

/** Number of days from `from` to `to`, both included. */
export const countDays = (from, to) => dayjs.utc(to).diff(dayjs.utc(from), 'day') + 1;

/**
 * The period to ask M05 for, from the URL query (`?from=&to=`). The default is today..today
 * (docs/09 §2). A single date is used for both ends.
 * `error` is 'reversed' (from after to), 'tooLong' (more than 31 days) or null.
 * @param {{from?: string, to?: string}} params
 * @returns {{from: string, to: string, error: 'reversed'|'tooLong'|null}}
 */
export function resolvePeriod({ from, to }) {
  const start = from || to || todayInSeoul();
  const end = to || start;
  const days = countDays(start, end);
  let error = null;
  if (days < 1) error = 'reversed';
  else if (days > MAX_PERIOD_DAYS) error = 'tooLong';
  return { from: start, to: end, error };
}
