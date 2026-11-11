import { useState } from 'react';
import { Alert, Button, Input, Radio } from 'antd';
import { useAddTicketEvent } from '../queries.js';

const BODY_MAX_LENGTH = 2000; // docs/09 M23
const BODY_REQUIRED_TEXT = '내용을 입력해 주세요.';

const NOTES = {
  reply: '답변은 접수한 회원에게 알림으로 가요.',
  note: '메모는 관리자만 볼 수 있어요.',
};

/**
 * A reply (seen by the user) or an internal note of a ticket (M23). The reason of the audit log
 * is asked by the confirm step of the page (`onConfirm`).
 * @param {object} props
 * @param {string} props.ticketId
 * @param {(request: object) => void} props.onConfirm
 */
export function ReplyForm({ ticketId, onConfirm }) {
  const add = useAddTicketEvent();
  const [eventType, setEventType] = useState('reply');
  const [text, setText] = useState('');
  const [error, setError] = useState(null);

  const handleSend = () => {
    const body = text.trim();
    if (!body) {
      setError(BODY_REQUIRED_TEXT);
      return;
    }
    setError(null);
    onConfirm({
      title: eventType === 'reply' ? '답변 보내기' : '메모 남기기',
      summary: NOTES[eventType],
      submit: async ({ reason, idempotencyKey }) => {
        await add.mutateAsync({ ticketId, body: { eventType, body, reason }, idempotencyKey });
        setText('');
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
      <Radio.Group
        value={eventType}
        onChange={(event) => setEventType(event.target.value)}
        options={[
          { value: 'reply', label: '답변' },
          { value: 'note', label: '메모' },
        ]}
      />
      <Input.TextArea
        rows={4}
        maxLength={BODY_MAX_LENGTH}
        showCount
        aria-label="내용"
        placeholder={NOTES[eventType]}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
      />
      {error && <Alert type="warning" showIcon title={error} />}
      <div>
        <Button type="primary" onClick={handleSend}>
          보내기
        </Button>
      </div>
    </div>
  );
}
