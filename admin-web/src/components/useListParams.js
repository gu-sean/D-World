import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 20; // docs/05 §6
const MAX_SIZE = 100; // docs/05 §6

const toPositiveInt = (text, fallback) => {
  const number = Number.parseInt(text, 10);
  return Number.isInteger(number) && number >= 1 ? number : fallback;
};

/**
 * Reads and writes the list parameters in the URL query: `?page=1&size=20&sort=field,desc&status=a`
 * (docs/05 §6). Pass `params` straight to the API function of the list.
 *
 * - `params.page` and `params.size` are numbers (defaults 1 and 20, `size` at most 100).
 * - Every other key is a string, exactly as in the URL ('a,b' for a multi-value filter).
 * - `setParams(patch)` merges `patch` into the URL. A value of `undefined`, `null` or '' removes
 *   the key. Unless `patch` has a `page`, the page goes back to 1 (a filter or sort changed).
 *
 * @param {Record<string, string|number>} [defaults] values used when the URL has no such key,
 *   e.g. `{ sort: 'recordedAt,desc' }` (the default sort of the API, docs/09)
 * @returns {[Record<string, string|number>, (patch: Record<string, unknown>) => void]}
 */
export function useListParams(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = { page: DEFAULT_PAGE, size: DEFAULT_SIZE, ...defaults };
  for (const [key, value] of searchParams) {
    if (key === 'page') params.page = toPositiveInt(value, params.page);
    else if (key === 'size') params.size = Math.min(MAX_SIZE, toPositiveInt(value, params.size));
    else params[key] = value;
  }

  const setParams = useCallback(
    (patch) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (!('page' in patch)) next.delete('page');
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined || value === null || value === '') next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      });
    },
    [setSearchParams],
  );

  return [params, setParams];
}
