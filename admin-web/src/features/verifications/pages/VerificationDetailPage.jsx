// ADM-08 인증 기록 상세 (읽기 전용)
//
// 증거·AI 결과·판정 이력을 본다. 판정 버튼은 없다: AI 판정 보류 건은 처리 대기에서 판정한다.
import { Link, useParams } from 'react-router';
import { Alert, Button, Space, Typography } from 'antd';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import RecordSummary from '../components/RecordSummary.jsx';
import { useVerification } from '../queries.js';

export default function VerificationDetailPage() {
  const { recordId } = useParams();
  const query = useVerification(recordId);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3}>인증 기록 상세</Typography.Title>
      <Link to="/verifications">← 인증 기록</Link>
      <QueryBoundary query={query}>
        {(record) => (
          <>
            {record.status === 'review_required' && (
              <Alert
                type="warning"
                showIcon
                title="AI가 판정을 보류한 건이에요. 처리 대기에서 판정해 주세요."
                action={
                  <Link to={`/verifications/appeals/hold/${record.recordId}`}>
                    <Button size="small" type="primary">
                      판정하러 가기
                    </Button>
                  </Link>
                }
              />
            )}
            <RecordSummary record={record} />
          </>
        )}
      </QueryBoundary>
    </Space>
  );
}
