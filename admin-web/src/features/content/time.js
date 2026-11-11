import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const KST = 'Asia/Seoul'; // docs/05 §3: the screens show Asia/Seoul, the API sends ISO 8601 UTC
const INPUT_FORMAT = 'YYYY-MM-DDTHH:mm'; // the value of `<input type="datetime-local">`

/** The ISO 8601 UTC text of a `datetime-local` value typed in Asia/Seoul; '' gives null. */
export const fromInputValue = (text) => (text ? dayjs.tz(text, KST).toISOString() : null);

/** The `datetime-local` value (Asia/Seoul) of an ISO 8601 text; null gives ''. */
export const toInputValue = (iso) => (iso ? dayjs(iso).tz(KST).format(INPUT_FORMAT) : '');

/** True when the `datetime-local` value is later than now. */
export const isFuture = (text) => Boolean(text) && dayjs.tz(text, KST).isAfter(dayjs());
