import { useState } from 'react';
import { message } from 'antd';
import { ConfirmActionModal } from '../../components/ConfirmActionModal.jsx';

/**
 * One confirm dialog for a whole page (two dialogs on one page would repeat the reason field id).
 * `ask({title, summary, danger, submit})` opens it; `submit({reason, idempotencyKey})` must return
 * a promise. When it resolves the dialog closes after a short success message; when it rejects the
 * dialog stays open and shows the server message (ConfirmActionModal).
 * @returns {[import('react').ReactElement, (request: object) => void]}
 */
export function useConfirm() {
  const [request, setRequest] = useState(null);
  const [open, setOpen] = useState(false);

  const element = (
    <ConfirmActionModal
      open={open}
      title={request?.title ?? ''}
      summary={request?.summary}
      danger={request?.danger}
      onCancel={() => setOpen(false)}
      onSubmit={async (input) => {
        await request.submit(input);
        message.success('처리했어요');
        setOpen(false);
      }}
    />
  );
  const ask = (next) => {
    setRequest(next);
    setOpen(true);
  };
  return [element, ask];
}
