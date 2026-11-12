import { useState } from 'react';
import { Button, message, Radio, Space } from 'antd';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';

/**
 * Approve / reject choice followed by the shared confirm modal (reason + Idempotency-Key,
 * docs/parts/admin-web.md §7 rule 1). `onDecide` should return the mutation promise; when it
 * resolves the modal closes and "처리했어요" is shown.
 * @param {{
 *   labels: {approved: string, rejected: string},
 *   confirmTitle: string,
 *   submitText: string,
 *   onDecide: (input: {decision: string, reason: string, idempotencyKey: string}) => Promise<unknown>,
 * }} props
 */
export default function DecisionForm({ labels, confirmTitle, submitText, onDecide }) {
  const [decision, setDecision] = useState(null);
  const [open, setOpen] = useState(false);

  return (
    <Space direction="vertical">
      <Radio.Group value={decision} onChange={(event) => setDecision(event.target.value)}>
        <Radio value="approved">{labels.approved}</Radio>
        <Radio value="rejected">{labels.rejected}</Radio>
      </Radio.Group>
      <Button type="primary" disabled={!decision} onClick={() => setOpen(true)}>
        {submitText}
      </Button>
      <ConfirmActionModal
        open={open}
        title={confirmTitle}
        summary={decision ? `"${labels[decision]}"(으)로 처리합니다.` : null}
        danger={decision === 'rejected'}
        onCancel={() => setOpen(false)}
        onSubmit={async ({ reason, idempotencyKey }) => {
          await onDecide({ decision, reason, idempotencyKey });
          message.success('처리했어요');
          setOpen(false);
        }}
      />
    </Space>
  );
}
