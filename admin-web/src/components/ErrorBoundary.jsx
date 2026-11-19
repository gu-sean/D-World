import { Component } from 'react';
import { Button, Result, Space } from 'antd';
import { t } from '../i18n/index.js';

/** A page chunk that cannot be loaded (usually: a new version was deployed while this tab was open). */
const isChunkError = (error) =>
  /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(
    `${error?.name ?? ''} ${error?.message ?? ''}`,
  );

/**
 * Catches errors thrown while rendering its children, so one broken screen does not leave a blank page.
 * Shows a message with "다시 시도" (render again) and "새로고침". When `resetKey` changes (for example the
 * URL) the error is cleared and the children are rendered again.
 *
 * Errors in event handlers and in promises are not caught by React error boundaries; those are shown
 * where they happen (the confirm dialog, `QueryBoundary`).
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {unknown} [props.resetKey]
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Only the development console: nothing about the failure is sent anywhere.
    if (import.meta.env.DEV) console.error(error, info?.componentStack);
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkError(error);
    return (
      <Result
        status="warning"
        title={chunk ? t('새 버전이 나왔어요.') : t('화면을 보여 주지 못했어요.')}
        subTitle={
          chunk
            ? t('새로고침하면 최신 화면으로 바뀌어요.')
            : t('다시 시도해도 계속되면 관리자에게 알려 주세요.')
        }
        extra={
          <Space>
            {!chunk && (
              <Button onClick={() => this.setState({ error: null })}>{t('다시 시도')}</Button>
            )}
            <Button type="primary" onClick={() => window.location.reload()}>
              {t('새로고침')}
            </Button>
          </Space>
        }
      />
    );
  }
}
