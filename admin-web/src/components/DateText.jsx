import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const KST = 'Asia/Seoul';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shows a `datetime` (ISO 8601 UTC) or a `date` (YYYY-MM-DD, already Asia/Seoul) in KST
 * (docs/05 §3). A `date` is never shifted. `null`/empty shows "-".
 * @param {object} props
 * @param {string|null} [props.value]
 * @param {string} [props.format] dayjs format; default `YYYY-MM-DD HH:mm` (`YYYY-MM-DD` for a date)
 */
export function DateText({ value, format }) {
  if (!value) return <span>-</span>;

  const isDate = DATE_ONLY.test(value);
  const parsed = isDate ? dayjs.tz(value, KST) : dayjs(value).tz(KST);
  if (!parsed.isValid()) return <span>{value}</span>;

  const pattern = format ?? (isDate ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm');
  return <time dateTime={value}>{parsed.format(pattern)}</time>;
}
