/**
 * 커서 목록 → `useInfiniteQuery` 옵션 (05 §6, parts/mobile-client §4.2).
 *
 * 앱 목록 응답은 모두 `Page<T>` = `{items, nextCursor}`다.
 * 커서는 서버가 만든 문자열이므로 앱은 **해석하지 않고 그대로** 돌려보낸다.
 */

/** 목록 한 번에 받는 기본 개수 (05 §6, 최대 50). */
export const DEFAULT_LIMIT = 20;

/**
 * `useInfiniteQuery`에 그대로 넘길 옵션을 만든다.
 * @param {object} opts
 * @param {Array} opts.queryKey `queries/keys.js`가 만든 키
 * @param {(args: {cursor?: string, limit: number, signal?: AbortSignal}) => Promise<{items: any[], nextCursor: string|null}>} opts.fetchPage
 * @param {number} [opts.limit=20]
 * @returns {object} `useInfiniteQuery` 옵션
 */
export function infiniteListOptions({ queryKey, fetchPage, limit = DEFAULT_LIMIT, ...rest }) {
  return {
    queryKey,
    queryFn: ({ pageParam, signal }) => fetchPage({ cursor: pageParam ?? undefined, limit, signal }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    ...rest,
  };
}

/**
 * 무한 목록의 모든 쪽을 한 배열로 펼친다.
 * 화면 편의를 위해 목록 훅이 `items`로 함께 돌려준다 (parts/mobile-client §4.2 끝).
 * @param {{pages?: Array<{items?: any[]}>}} [data] `useInfiniteQuery`의 `data`
 * @returns {any[]}
 */
export function flattenItems(data) {
  if (!data || !Array.isArray(data.pages)) return [];
  return data.pages.flatMap((page) => (Array.isArray(page?.items) ? page.items : []));
}

export default { infiniteListOptions, flattenItems, DEFAULT_LIMIT };
