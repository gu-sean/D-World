import { StatePanel } from './StatePanel.jsx';

/**
 * Wraps content with the COMMON-01 state screens of `StatePanel`, for pages that pass the
 * loading / error / empty flags themselves (instead of one `useQuery` result like `QueryBoundary`).
 * loading -> `StatePanel loading`; 403 -> `forbidden`; any other error -> `saveFailed` with
 * `error.message` and "다시 시도" when `onRetry` is given; empty -> `StatePanel empty`;
 * otherwise `children`.
 * @param {object} props
 * @param {boolean} [props.loading]
 * @param {{code?: string, message?: string, status?: number}|null} [props.error]
 * @param {boolean} [props.empty]
 * @param {string} [props.emptyText] text of the empty state
 * @param {() => void} [props.onRetry]
 * @param {import('react').ReactNode} [props.children]
 */
export default function QueryState({
  loading = false,
  error = null,
  empty = false,
  emptyText = '조건에 맞는 결과가 없습니다.',
  onRetry,
  children,
}) {
  if (loading) {
    return <StatePanel type="loading" />;
  }
  if (error) {
    if (error.status === 403 || error.code === 'COMMON_FORBIDDEN') {
      return <StatePanel type="forbidden" />;
    }
    return <StatePanel type="saveFailed" message={error.message} onRetry={onRetry} />;
  }
  if (empty) {
    return <StatePanel type="empty" message={emptyText} />;
  }
  return children ?? null;
}
