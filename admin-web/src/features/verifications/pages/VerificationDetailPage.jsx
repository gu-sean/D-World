// ADM-08 Verification detail and decision
import { Link, useNavigate, useParams } from 'react-router';
import { Card, Space, Typography } from 'antd';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import DecisionForm from '../components/DecisionForm.jsx';
import RecordSummary from '../components/RecordSummary.jsx';
import { useDecideVerification, useVerification } from '../queries.js';

const LABELS = { approved: '승인', rejected: '거절' };

export default function VerificationDetailPage() {
  const { recordId } = useParams();
  const navigate = useNavigate();
  const query = useVerification(recordId);
  const decide = useDecideVerification();

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3}>인증 상세 검토</Typography.Title>
      <Link to="/verifications">← 검수 대기 목록</Link>
      <QueryBoundary query={query}>
        {(record) => (
          <>
            <RecordSummary record={record} />
            {record.status === 'review_required' ? (
              <Card title="판정">
                <DecisionForm
                  labels={LABELS}
                  confirmTitle="인증 판정을 확정할까요?"
                  submitText="판정 저장"
                  onDecide={async ({ decision, reason, idempotencyKey }) => {
                    await decide.mutateAsync({ recordId, decision, reason, idempotencyKey });
                    navigate('/verifications');
                  }}
                />
              </Card>
            ) : (
              <Typography.Text type="secondary">
                검수 대기 상태가 아니라서 판정할 수 없어요.
              </Typography.Text>
            )}
          </>
        )}
      </QueryBoundary>
    </Space>
  );
}
