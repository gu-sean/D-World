import { StatePanel } from './StatePanel.jsx';

/**
 * Shows the right state screen for a TanStack Query result, and `children(data)` once it has data.
 * loading -> `StatePanel loading`; 403 -> `forbidden`; any other error -> `saveFailed` with
 * "다시 시도" (refetch), showing `error.message` as it is (docs/parts/admin-web.md §5.4, §6).
 * @param {object} props
 * @param {import('@tanstack/react-query').UseQueryResult} props.query a `useQuery` result
 * @param {(data: any) => import('react').ReactNode} props.children
 */
export function QueryBoundary({ query, children }) {
  if (query.isError) {
    const { error } = query;
    if (error?.status === 403 || error?.code === 'COMMON_FORBIDDEN') {
      return <StatePanel type="forbidden" />;
    }
    return (
      <StatePanel type="saveFailed" message={error?.message} onRetry={() => query.refetch()} />
    );
  }
  if (query.isPending) {
    return <StatePanel type="loading" />;
  }
  return children(query.data);
}
