// ADM-08 Verification detail and decision
import { Link, useNavigate, useParams } from 'react-router';
import { Card, Space, Typography } from 'antd';
import QueryState from '../../../components/QueryState.jsx';
import DecisionForm from '../components/DecisionForm.jsx';
import RecordSummary from '../components/RecordSummary.jsx';
import { useDecideVerification, useVerification } from '../queries.js';

const LABELS = { approved: '승인', rejected: '거절' };

export default function VerificationDetailPage() {
  const { recordId } = useParams();
  const navigate = useNavigate();
  const query = useVerification(recordId);
  const decide = useDecideVerification();
  const record = query.data;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3}>인증 상세 검토</Typography.Title>
      <Link to="/verifications">← 검수 대기 목록</Link>
      <QueryState loading={query.isLoading} error={query.error} onRetry={query.refetch}>
        {record && (
          <>
            <RecordSummary record={record} />
            {record.status === 'review_required' ? (
              <Card title="판정">
                <DecisionForm
                  labels={LABELS}
                  confirmTitle="인증 판정을 확정할까요?"
                  submitText="판정 저장"
                  maxReason={1000}
                  pending={decide.isPending}
                  error={decide.error}
                  onSubmit={async (values, idempotencyKey) => {
                    await decide.mutateAsync({ recordId, ...values, idempotencyKey });
                    navigate('/verifications');
                  }}
                />
              </Card>
            ) : (
              <Typography.Text type="secondary">
                검수 대기 상태가 아니라서 판정할 수 없습니다.
              </Typography.Text>
            )}
          </>
        )}
      </QueryState>
    </Space>
  );
}
