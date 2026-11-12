import { useState } from 'react';
import { Alert, Button, Input, InputNumber, Radio, Space } from 'antd';
import { labels } from '../../../constants/labels.js';
import { useResolveTicket } from '../queries.js';

const MIN_DAYS = 1; // docs/07 AccountActionInput
const MAX_DAYS = 365;
const REASON_MAX_LENGTH = 500;

const OUTCOME_OPTIONS = Object.entries(labels.ticketResolutionOutcome).map(([value, { text }]) => ({
  value,
  label: text,
}));
const ACTION_TYPE_OPTIONS = [
  { value: 'warning', label: '경고' },
  { value: 'restriction', label: '이용 제한' },
];
const CONTENT_ACTION_OPTIONS = [
  { value: 'hidden', label: '숨김' },
  { value: 'deleted', label: '삭제' },
];

const REPLY_REQUIRED_TEXT = '회원에게 보낼 답변을 입력해 주세요.';
const DAYS_TEXT = `이용 제한 일수를 ${MIN_DAYS}~${MAX_DAYS} 사이의 정수로 입력해 주세요.`;
const ACTION_REASON_TEXT = '회원에게 보일 조치 사유를 입력해 주세요.';
const CONTENT_ACTION_TEXT = '콘텐츠 조치를 선택해 주세요.';

/**
 * The resolution of a ticket (M24): an inquiry is answered (`reply_only`); a report gets one of
 * the five outcomes of docs/07 `TicketResolutionInput`. The fields that the outcome needs are
 * checked here; the audit `reason` is asked by the confirm step of the page (`onConfirm`).
 * @param {object} props
 * @param {object} props.ticket AdminTicketDetail
 * @param {(request: object) => void} props.onConfirm
 */
export function ResolutionForm({ ticket, onConfirm }) {
  const resolve = useResolveTicket();
  const isInquiry = ticket.ticketType === 'inquiry';
  const [outcome, setOutcome] = useState(isInquiry ? 'reply_only' : 'no_action');
  const [userReply, setUserReply] = useState('');
  const [actionType, setActionType] = useState('warning');
  const [days, setDays] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [contentAction, setContentAction] = useState(null);
  const [error, setError] = useState(null);

  const needsReply = outcome === 'reply_only';
  const needsAccount = outcome === 'account_action' || outcome === 'both';
  const needsContent = outcome === 'content_action' || outcome === 'both';
  const isRestriction = actionType === 'restriction';

  const problem = () => {
    if (needsReply && !userReply.trim()) return REPLY_REQUIRED_TEXT;
    if (needsAccount) {
      if (isRestriction && !(Number.isInteger(days) && days >= MIN_DAYS && days <= MAX_DAYS)) {
        return DAYS_TEXT;
      }
      if (!actionReason.trim()) return ACTION_REASON_TEXT;
    }
    if (needsContent && !contentAction) return CONTENT_ACTION_TEXT;
    return null;
  };

  const handleNext = () => {
    const found = problem();
    setError(found);
    if (found) return;

    const input = { outcome };
    if (userReply.trim()) input.userReply = userReply.trim();
    if (needsAccount) {
      input.accountAction = { actionType, reason: actionReason.trim() };
      if (isRestriction) input.accountAction.days = days;
    }
    if (needsContent) input.contentAction = contentAction;

    onConfirm({
      title: '처리 확정',
      summary: (
        <>
          <div>
            {ticket.subject} · {labels.ticketResolutionOutcome[outcome].text}
          </div>
          <div>처리를 확정하면 되돌릴 수 없어요.</div>
        </>
      ),
      danger: needsAccount || needsContent,
      submit: ({ reason, idempotencyKey }) =>
        resolve.mutateAsync({
          ticketId: ticket.id,
          body: { ...input, reason },
          idempotencyKey,
        }),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
      {!isInquiry && (
        <Radio.Group
          value={outcome}
          onChange={(event) => {
            setOutcome(event.target.value);
            setError(null);
          }}
          options={OUTCOME_OPTIONS}
        />
      )}
      <Input.TextArea
        rows={3}
        maxLength={REASON_MAX_LENGTH * 4}
        showCount
        aria-label="회원에게 보낼 답변"
        placeholder={needsReply ? '회원에게 보낼 답변 (필수)' : '회원에게 보낼 답변 (선택)'}
        value={userReply}
        onChange={(event) => setUserReply(event.target.value)}
      />
      {needsAccount && (
        <>
          <Radio.Group
            value={actionType}
            onChange={(event) => setActionType(event.target.value)}
            options={ACTION_TYPE_OPTIONS}
          />
          {isRestriction && (
            <Space>
              <InputNumber
                min={MIN_DAYS}
                max={MAX_DAYS}
                precision={0}
                placeholder="일수"
                aria-label="이용 제한 일수"
                value={days}
                onChange={setDays}
              />
              일
            </Space>
          )}
          <Input.TextArea
            rows={2}
            maxLength={REASON_MAX_LENGTH}
            showCount
            aria-label="회원에게 보일 조치 사유"
            placeholder="회원에게 보일 조치 사유"
            value={actionReason}
            onChange={(event) => setActionReason(event.target.value)}
          />
        </>
      )}
      {needsContent && (
        <Radio.Group
          value={contentAction}
          onChange={(event) => setContentAction(event.target.value)}
          options={CONTENT_ACTION_OPTIONS}
        />
      )}
      {error && <Alert type="warning" showIcon title={error} />}
      <div>
        <Button type="primary" onClick={handleNext}>
          처리 확정
        </Button>
      </div>
    </div>
  );
}
