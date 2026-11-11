import { useState } from 'react';
import { Alert, Button, InputNumber, message, Radio, Space, Typography } from 'antd';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';
import { useCreateAccountAction, useUser } from '../queries.js';

const MIN_DAYS = 1; // docs/07 §16 AccountActionInput
const MAX_DAYS = 365;
const DAYS_ERROR_TEXT = `이용 제한 일수를 ${MIN_DAYS}~${MAX_DAYS} 사이의 정수로 입력해 주세요.`;

/**
 * ADM-04 계정 조치 (M13): a warning or a restriction of N days. `?ticketId=` (from a report)
 * is sent as `sourceTicketId`. The reason asked by the confirm step is shown to the user too.
 */
export default function AccountActionPage() {
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const sourceTicketId = searchParams.get('ticketId');
  const navigate = useNavigate();
  const user = useUser(userId);
  const create = useCreateAccountAction();

  const [actionType, setActionType] = useState('warning');
  const [days, setDays] = useState(null);
  const [formError, setFormError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isRestriction = actionType === 'restriction';
  const daysAreValid = Number.isInteger(days) && days >= MIN_DAYS && days <= MAX_DAYS;

  const handleNext = () => {
    if (isRestriction && !daysAreValid) {
      setFormError(DAYS_ERROR_TEXT);
      return;
    }
    setFormError(null);
    setConfirmOpen(true);
  };

  const summary = (
    <>
      <div>
        대상: {user.data?.nickname ?? userId} · {isRestriction ? `이용 제한 ${days}일` : '경고'}
      </div>
      <div>입력한 사유는 회원에게도 보여요.</div>
    </>
  );

  return (
    <>
      <Typography.Title level={3}>계정 조치</Typography.Title>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
        <div>대상: {user.data?.nickname ?? userId}</div>
        <Radio.Group
          value={actionType}
          onChange={(event) => {
            setActionType(event.target.value);
            setFormError(null);
          }}
          options={[
            { value: 'warning', label: '경고' },
            { value: 'restriction', label: '이용 제한' },
          ]}
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
        {formError && <Alert type="warning" showIcon title={formError} />}
        <Space>
          <Button type="primary" onClick={handleNext}>
            다음
          </Button>
          <Button onClick={() => navigate(-1)}>취소</Button>
        </Space>
      </div>
      <ConfirmActionModal
        open={confirmOpen}
        title="계정 조치"
        summary={summary}
        danger={isRestriction}
        onSubmit={async ({ reason, idempotencyKey }) => {
          const body = { actionType, reason };
          if (isRestriction) body.days = days;
          if (sourceTicketId) body.sourceTicketId = sourceTicketId;
          await create.mutateAsync({ userId, body, idempotencyKey });
          message.success('처리했어요');
          setConfirmOpen(false);
          navigate(`/users/${userId}`);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
