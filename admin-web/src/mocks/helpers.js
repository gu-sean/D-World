import { HttpResponse } from 'msw';

// Small helpers shared by the MSW handlers of every menu (src/features/<menu>/mocks.js).
export const BASE = import.meta.env.VITE_ADMIN_API_BASE_URL ?? '/admin/v1';

/** An error response in the standard body of docs/05 §7: `{error: {code, message, details}}`. */
export const errorResponse = (status, code, message, details = null) =>
  HttpResponse.json({ error: { code, message, details } }, { status });

/** The `AdminPage<T>` of one page of `items`, from `?page=&size=` (docs/05 §6). */
export function paginate(items, searchParams) {
  const page = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1);
  const size = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('size'), 10) || 20));
  return {
    items: items.slice((page - 1) * size, page * size),
    page,
    size,
    totalCount: items.length,
  };
}

/** Sorted copy of `items` for `?sort=field,asc|desc`. Without a sort, the order is kept. */
export function sortItems(items, sort) {
  if (!sort) return items;
  const [field, direction = 'asc'] = sort.split(',');
  const sign = direction === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    if (a[field] === b[field]) return 0;
    if (a[field] === null || a[field] === undefined) return 1;
    if (b[field] === null || b[field] === undefined) return -1;
    return a[field] > b[field] ? sign : -sign;
  });
}

/**
 * Checks what every admin change needs (docs/09 §0 rules 3 and 4): an Idempotency-Key header and
 * a `reason` of 1~500 characters. Returns an error response, or null when the request is fine.
 */
export function checkChange(request, body) {
  if (!request.headers.get('idempotency-key')) {
    return errorResponse(400, 'COMMON_VALIDATION_FAILED', '입력한 내용을 다시 확인해 주세요.');
  }
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 1 || reason.length > 500) {
    return errorResponse(400, 'ADMIN_REASON_REQUIRED', '사유를 입력해 주세요.');
  }
  return null;
}
