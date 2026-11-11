// ADM-09 Appeal review: accept (change the decision) or dismiss (keep it)
import { Link, useNavigate, useParams } from 'react-router';
import { Card, Descriptions, Space, Typography } from 'antd';
import StatePanel from '../../../components/StatePanel.jsx';
import DecisionForm from '../components/DecisionForm.jsx';
import RecordSummary, { StatusTag } from '../components/RecordSummary.jsx';
import { APPEAL_STATUS, DECISION_LABEL, formatDateTime } from '../components/format.js';
import { useAppeal, useResolveAppeal } from '../queries.js';

const LABELS = { approved: '이의 인정', rejected: '기각' };

export default function AppealReviewPage() {
  const { appealId } = useParams();
  const navigate = useNavigate();
  const query = useAppeal(appealId);
  const resolve = useResolveAppeal();
  const appeal = query.data?.appeal;
  const verification = query.data?.verification;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3}>이의 신청 검토</Typography.Title>
      <Link to="/verifications/appeals">← 이의 신청 목록</Link>
      <StatePanel loading={query.isLoading} error={query.error} onRetry={query.refetch}>
        {appeal && (
          <>
            <Descriptions title="이의 신청" bordered size="small" column={2}>
              <Descriptions.Item label="상태">
                <StatusTag map={APPEAL_STATUS} value={appeal.status} />
              </Descriptions.Item>
              <Descriptions.Item label="접수 시각">
                {formatDateTime(appeal.filedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="이의 사유" span={2}>
                {appeal.reason}
              </Descriptions.Item>
              {appeal.resolution && (
                <>
                  <Descriptions.Item label="처리 결과">
                    {DECISION_LABEL[appeal.resolution.decision] ?? appeal.resolution.decision}
                  </Descriptions.Item>
                  <Descriptions.Item label="처리 사유">
                    {appeal.resolution.reason}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
            {verification && <RecordSummary record={verification} />}
            {appeal.status === 'open' ? (
              <Card title="처리">
                <DecisionForm
                  labels={LABELS}
                  confirmTitle="이의 신청을 처리할까요?"
                  submitText="처리 저장"
                  maxReason={1000}
                  pending={resolve.isPending}
                  error={resolve.error}
                  onSubmit={async (values, idempotencyKey) => {
                    await resolve.mutateAsync({ appealId, ...values, idempotencyKey });
                    navigate('/verifications/appeals');
                  }}
                />
              </Card>
            ) : (
              <Typography.Text type="secondary">이미 처리된 이의 신청입니다.</Typography.Text>
            )}
          </>
        )}
      </StatePanel>
    </Space>
  );
}
