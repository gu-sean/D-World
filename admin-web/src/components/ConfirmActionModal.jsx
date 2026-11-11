import { useEffect, useRef, useState } from 'react';
import { Input, Modal } from 'antd';
import { newIdempotencyKey } from '../api/idempotency.js';

const REASON_MAX_LENGTH = 500; // docs/05 §5.2: `reason` is 1~500 characters
const REASON_REQUIRED_TEXT = '사유를 입력해 주세요.'; // ADMIN_REASON_REQUIRED, docs/05 §7
const FALLBACK_ERROR_TEXT = '잠시 후 다시 시도해 주세요.'; // COMMON_INTERNAL, docs/05 §7

/**
 * Confirmation step of every change (docs/parts/admin-web.md §7 rule 1): shows what will happen,
 * asks for a reason (required, 1~500 characters) and hands over an Idempotency-Key.
 *
 * - One key is made each time the modal opens. Trying again in the same modal (after `onSubmit`
 *   failed) uses the same key, so the server does not do the change twice (docs/05 §5.2, §5.3).
 * - After a failed try the reason cannot be edited, because the same key needs the same body.
 *   To change the reason, cancel and open the modal again (a new key).
 * - `onSubmit` must return a promise. While it runs the buttons wait; when it rejects the
 *   `error.message` is shown in the modal and the modal stays open. When it resolves the PARENT
 *   closes the modal (`open={false}`) and invalidates the menu's queries.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.title
 * @param {import('react').ReactNode} props.summary target and action, e.g. "회원 A · 이용 정지"
 * @param {(input: {reason: string, idempotencyKey: string}) => Promise<unknown>} props.onSubmit
 * @param {() => void} props.onCancel
 * @param {boolean} [props.danger] red confirm button for destructive actions
 */
export function ConfirmActionModal({ open, title, summary, onSubmit, onCancel, danger = false }) {
  const keyRef = useRef(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [triedOnce, setTriedOnce] = useState(false);

  // A new modal session: one new key, empty form.
  useEffect(() => {
    if (!open) return;
    keyRef.current = newIdempotencyKey();
    setReason('');
    setReasonError(null);
    setSubmitError(null);
    setSubmitting(false);
    setTriedOnce(false);
  }, [open]);

  const handleOk = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError(REASON_REQUIRED_TEXT);
      return;
    }
    setReasonError(null);
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit({ reason: trimmed, idempotencyKey: keyRef.current });
    } catch (error) {
      setTriedOnce(true);
      setSubmitError(error?.message || FALLBACK_ERROR_TEXT);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      okText="확인"
      cancelText="취소"
      okButtonProps={{ danger }}
      cancelButtonProps={{ disabled: submitting }}
      confirmLoading={submitting}
      maskClosable={false}
      keyboard={!submitting}
      onOk={handleOk}
      onCancel={submitting ? undefined : onCancel}
    >
      <div style={{ marginBottom: 16 }}>{summary}</div>
      <label htmlFor="confirm-action-reason">사유</label>
      <Input.TextArea
        id="confirm-action-reason"
        rows={4}
        maxLength={REASON_MAX_LENGTH}
        showCount
        status={reasonError ? 'error' : undefined}
        readOnly={triedOnce}
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
          setReasonError(null);
        }}
      />
      {reasonError && (
        <div role="alert" style={{ color: '#ff4d4f', marginTop: 4 }}>
          {reasonError}
        </div>
      )}
      {submitError && (
        <div role="alert" style={{ color: '#ff4d4f', marginTop: 12 }}>
          {submitError}
        </div>
      )}
    </Modal>
  );
}
