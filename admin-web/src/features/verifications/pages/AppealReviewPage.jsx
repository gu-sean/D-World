// ADM-09 Appeal review: accept (change the decision) or dismiss (keep it)
import { Link, useNavigate, useParams } from 'react-router';
import { Card, Descriptions, Space, Typography } from 'antd';
import { DateText } from '../../../components/DateText.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import DecisionForm from '../components/DecisionForm.jsx';
import RecordSummary from '../components/RecordSummary.jsx';
import { useAppeal, useResolveAppeal } from '../queries.js';

const LABELS = { approved: '이의 인정', rejected: '기각' };

export default function AppealReviewPage() {
  const { appealId } = useParams();
  const navigate = useNavigate();
  const query = useAppeal(appealId);
  const resolve = useResolveAppeal();

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3}>이의 신청 검토</Typography.Title>
      <Link to="/verifications/appeals">← 이의 신청 목록</Link>
      <QueryBoundary query={query}>
        {({ appeal, verification }) => (
          <>
            <Descriptions title="이의 신청" bordered size="small" column={2}>
              <Descriptions.Item label="상태">
                <StatusTag kind="verificationAppealStatus" value={appeal.status} />
              </Descriptions.Item>
              <Descriptions.Item label="접수 시각">
                <DateText value={appeal.filedAt} />
              </Descriptions.Item>
              <Descriptions.Item label="이의 사유" span={2}>
                {appeal.reason}
              </Descriptions.Item>
              {appeal.resolution && (
                <>
                  <Descriptions.Item label="처리 결과">
                    <StatusTag kind="decision" value={appeal.resolution.decision} />
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
                  onDecide={async ({ decision, reason, idempotencyKey }) => {
                    await resolve.mutateAsync({ appealId, decision, reason, idempotencyKey });
                    navigate('/verifications/appeals');
                  }}
                />
              </Card>
            ) : (
              <Typography.Text type="secondary">이미 처리된 이의 신청이에요.</Typography.Text>
            )}
          </>
        )}
      </QueryBoundary>
    </Space>
  );
}
