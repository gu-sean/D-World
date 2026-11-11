import { Modal } from 'antd';
import ReasonField from './ReasonField.jsx';

/**
 * Modal.confirm with a required reason (1~500 chars, not blank: the server rule).
 * `onConfirm(reason)` must return a promise; when it rejects the modal stays open and shows
 * the error message, so the same action can be sent again.
 */
export function confirmWithReason({
  title,
  description,
  okText = '확인',
  danger = false,
  onConfirm,
}) {
  const holder = { value: '', setError: () => {} };
  const modal = Modal.confirm({
    title,
    content: <ReasonField holder={holder} description={description} />,
    okText,
    cancelText: '취소',
    okButtonProps: { danger },
    // The `close` parameter makes antd leave the result alone, so a failed action does not
    // become an unhandled rejection: this function closes the modal itself on success.
    onOk: (close) => {
      const reason = holder.value.trim();
      if (!reason) {
        holder.setError('사유를 입력해 주세요.');
        return;
      }
      modal.update({ okButtonProps: { danger, loading: true } });
      onConfirm(reason).then(
        () => close(),
        (error) => {
          holder.setError(error?.message ?? '잠시 후 다시 시도해 주세요.');
          modal.update({ okButtonProps: { danger, loading: false } });
        },
      );
    },
  });
}
