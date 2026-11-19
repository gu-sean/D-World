/**
 * Whether TanStack Query asks again after a failed read (`retry` option).
 * Only a failure with no answer from the server (offline, timeout; `status` 0) is repeated, at most
 * twice. Any answer from the server (401, 403, 404, 429, 5xx ...) is shown right away: asking again
 * would not change a refusal, and 429/5xx must not be repeated automatically (docs/05 §5.3).
 *
 * @param {number} failureCount failures so far
 * @param {{status?: number}} error AdminError
 */
export const shouldRetryQuery = (failureCount, error) => error?.status === 0 && failureCount < 2;
