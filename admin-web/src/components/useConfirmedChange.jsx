import { useState } from 'react';
import { message } from '../lib/message.jsx';
import { ConfirmActionModal } from './ConfirmActionModal.jsx';
import { t } from '../i18n/index.js';

/**
 * Every change goes through `ConfirmActionModal` (reason + Idempotency-Key) and ends with
 * `message.success('처리했어요')` (docs/parts/admin-web.md §7 rule 1).
 *
 * `const [ask, modal] = useConfirmedChange();` render `{modal}` once per page (two dialogs on one
 * page would repeat the reason field id), call `ask({title, summary, danger?, run, onDone?})` when
 * the form is valid. `run({reason, idempotencyKey})` must return a promise; when it rejects the
 * modal shows the error and stays open, and trying again uses the same key.
 */
export function useConfirmedChange() {
  const [request, setRequest] = useState(null);
  const [open, setOpen] = useState(false);

  const ask = (next) => {
    setRequest(next);
    setOpen(true);
  };

  const modal = (
    <ConfirmActionModal
      open={open}
      // the request stays while the dialog fades out, so its title does not flash empty
      title={request?.title ?? ''}
      summary={request?.summary}
      danger={request?.danger}
      onSubmit={async (input) => {
        await request.run(input);
        message.success(t('처리했어요'));
        setOpen(false);
        request.onDone?.();
      }}
      onCancel={() => setOpen(false)}
    />
  );

  return [ask, modal];
}
