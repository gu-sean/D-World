import { Button, Empty, Result, Spin } from 'antd';

// Texts of the COMMON-01 states. Where docs/05 §7 has a message for the situation it is used as
// it is (VALIDATION_FAILED, INTERNAL, FORBIDDEN, NOT_FOUND); 'done' is the text of
// docs/parts/admin-web.md §7 rule 1. 'loading' and 'empty' have no text in the docs.
const TEXTS = {
  loading: '불러오는 중이에요.',
  empty: '결과가 없어요.',
  invalid: '입력한 내용을 다시 확인해 주세요.',
  saveFailed: '잠시 후 다시 시도해 주세요.',
  forbidden: '권한이 없어요.',
  done: '처리했어요',
  notFound: '찾을 수 없어요.',
};

// antd <Result> status for each type that is shown as a result page.
const RESULT_STATUS = {
  invalid: 'warning',
  saveFailed: 'error',
  forbidden: '403',
  done: 'success',
  notFound: '404',
};

const RETRY_TEXT = '다시 시도';

/**
 * COMMON-01 state screen.
 * @param {object} props
 * @param {'loading'|'empty'|'invalid'|'saveFailed'|'forbidden'|'done'|'notFound'} props.type
 * @param {() => void} [props.onRetry] shows a "다시 시도" button (not used by 'loading')
 * @param {string} [props.message] replaces the default text, e.g. `error.message` from the server
 */
export function StatePanel({ type, onRetry, message }) {
  const text = message ?? TEXTS[type];

  if (type === 'loading') {
    return (
      <div role="status" style={{ padding: '64px 0', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 12 }}>{text}</div>
      </div>
    );
  }

  const retryButton = onRetry ? (
    <Button type="primary" onClick={onRetry}>
      {RETRY_TEXT}
    </Button>
  ) : null;

  if (type === 'empty') {
    return (
      <Empty style={{ padding: '48px 0' }} description={text}>
        {retryButton}
      </Empty>
    );
  }

  return <Result status={RESULT_STATUS[type]} title={text} extra={retryButton} />;
}
