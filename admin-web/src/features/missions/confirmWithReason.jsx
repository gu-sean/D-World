import { Input, Modal } from 'antd';
import { newIdempotencyKey } from '../../api/idempotency.js';

/**
 * Confirm dialog with a required reason (every admin mutation of this feature needs one,
 * 1~500 characters, not blank). The Idempotency-Key is created when the dialog opens, so a
 * retry from the same dialog repeats the same key (one key per user action).
 *
 * `onOk(reason, idempotencyKey)` must return a promise. When it rejects the dialog stays open.
 * @param {{title: string, content?: string, okText?: string, danger?: boolean,
 *   onOk: (reason: string, idempotencyKey: string) => Promise<unknown>}} options
 */
export default function confirmWithReason({ title, content, okText = '확인', danger, onOk }) {
  const idempotencyKey = newIdempotencyKey();
  let reason = '';
  // The OK button stays disabled until a reason is typed, so onOk never runs with a blank one.
  const dialog = Modal.confirm({
    title,
    okText,
    cancelText: '취소',
    okButtonProps: { danger, disabled: true },
    content: (
      <div>
        {content && <p>{content}</p>}
        <Input.TextArea
          rows={3}
          maxLength={500}
          showCount
          placeholder="처리 사유를 입력해 주세요. (필수)"
          onChange={(event) => {
            reason = event.target.value;
            dialog.update({ okButtonProps: { danger, disabled: !reason.trim() } });
          }}
        />
      </div>
    ),
    onOk: () => onOk(reason.trim(), idempotencyKey),
  });
}
