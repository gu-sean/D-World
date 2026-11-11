import { Button, Empty, Result, Spin } from 'antd';

/**
 * Common loading / empty / error panel (storyboard "공통 상태", slide 46).
 * @param {{
 *   loading?: boolean,
 *   error?: {code?: string, message: string, status?: number}|null,
 *   empty?: boolean,
 *   emptyText?: string,
 *   onRetry?: () => void,
 *   children?: import('react').ReactNode,
 * }} props
 */
export default function StatePanel({
  loading = false,
  error = null,
  empty = false,
  emptyText = '조건에 맞는 결과가 없습니다.',
  onRetry,
  children,
}) {
  if (loading) {
    return (
      <Spin
        style={{ display: 'block', margin: '64px auto' }}
        description="데이터를 불러오고 있습니다."
      />
    );
  }
  if (error) {
    if (error.status === 403) {
      return <Result status="403" title="이 작업의 처리 권한이 없습니다." />;
    }
    return (
      <Result
        status="warning"
        title={error.message}
        extra={onRetry && <Button onClick={onRetry}>다시 시도</Button>}
      />
    );
  }
  if (empty) return <Empty style={{ margin: '64px 0' }} description={emptyText} />;
  return children ?? null;
}
