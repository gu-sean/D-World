import { useState } from 'react';
import { message } from 'antd';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';

/**
 * Every change goes through `ConfirmActionModal` (reason + Idempotency-Key) and ends with
 * `message.success('처리했어요')` (docs/parts/admin-web.md §7 rule 1).
 *
 * `const [ask, modal] = useConfirmedChange();` render `{modal}` once, call
 * `ask({title, summary, danger?, run, onDone?})` when the form is valid.
 * `run({reason, idempotencyKey})` must return a promise; when it rejects the modal shows the
 * error and stays open, and trying again uses the same key.
 */
export function useConfirmedChange() {
  const [pending, setPending] = useState(null);

  const modal = (
    <ConfirmActionModal
      open={pending !== null}
      title={pending?.title ?? ''}
      summary={pending?.summary}
      danger={pending?.danger}
      onSubmit={async (input) => {
        await pending.run(input);
        message.success('처리했어요');
        const { onDone } = pending;
        setPending(null);
        onDone?.();
      }}
      onCancel={() => setPending(null)}
    />
  );

  return [setPending, modal];
}
