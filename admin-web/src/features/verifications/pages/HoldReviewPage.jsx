// 처리 대기 > AI 판정 보류 건 판정 (예전 ADM-08 판정 부분을 이의 신청 쪽으로 옮김)
//
// AI가 확신하지 못해 보류(review_required)한 인증만 여기서 관리자가 승인·거절한다.
import { Link, useNavigate, useParams } from 'react-router';
import { Card, Space, Typography } from 'antd';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import DecisionForm from '../components/DecisionForm.jsx';
import RecordSummary from '../components/RecordSummary.jsx';
import { useDecideVerification, useVerification } from '../queries.js';
import { t } from '../../../i18n/index.js';

const LABELS = { approved: t('승인'), rejected: t('거절') };
const BACK = '/verifications/appeals?tab=hold';

export default function HoldReviewPage() {
  const { recordId } = useParams();
  const navigate = useNavigate();
  const query = useVerification(recordId);
  const decide = useDecideVerification();

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3}>{t('AI 판정 보류 검토')}</Typography.Title>
      <Link to={BACK}>{t('← 처리 대기')}</Link>
      <QueryBoundary query={query}>
        {(record) => (
          <>
            <RecordSummary record={record} />
            {record.status === 'review_required' ? (
              <Card title={t('판정')}>
                <DecisionForm
                  labels={LABELS}
                  confirmTitle={t('인증 판정을 확정할까요?')}
                  submitText={t('판정 저장')}
                  onDecide={async ({ decision, reason, idempotencyKey }) => {
                    await decide.mutateAsync({ recordId, decision, reason, idempotencyKey });
                    navigate(BACK);
                  }}
                />
              </Card>
            ) : (
              <Typography.Text type="secondary">
                {t('이미 판정된 인증이에요. 결과는 인증 기록에서 볼 수 있어요.')}
              </Typography.Text>
            )}
          </>
        )}
      </QueryBoundary>
    </Space>
  );
}
