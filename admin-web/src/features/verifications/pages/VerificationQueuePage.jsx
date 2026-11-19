// ADM-07 인증 기록 (읽기 전용)
//
// 모든 미션 인증과 판정 결과를 나중에 찾아볼 수 있게 남겨 두는 이력 화면이다.
// 판정은 여기서 하지 않는다: AI가 먼저 판정하고, 관리자는 "처리 대기"(이의 신청·AI 판정 보류)에서만 손댄다.
import { Link, useNavigate } from 'react-router';
import { Alert } from 'antd';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { MEMBER_FIELD, memberColumn } from '../../../components/memberColumns.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { labels } from '../../../constants/labels.js';
import { formatConfidence, formatTarget, METHOD_LABEL } from '../components/format.js';
import { useVerifications } from '../queries.js';
import { t } from '../../../i18n/index.js';
import { PageHeader } from '../../../components/PageHeader.jsx';
import { ListCard } from '../../../components/ListCard.jsx';
import { Stack } from '../../../components/Stack.jsx';

const STATUS_VALUES = ['approved', 'rejected', 'review_required', 'submitted'];
const FIELDS = [
  MEMBER_FIELD,
  {
    name: 'status',
    type: 'select',
    label: t('상태'),
    options: STATUS_VALUES.map((value) => ({ value, label: labels.recordStatus[value].text })),
  },
  {
    name: 'method',
    type: 'select',
    label: t('인증 방식'),
    options: Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label })),
  },
];

export default function VerificationQueuePage() {
  const navigate = useNavigate();
  // 이력은 최근 것부터, 상태를 고르지 않으면 전체
  const [params, setParams] = useListParams({ sort: 'submittedAt,desc' });
  const query = useVerifications({ ...params, status: params.status || 'all' });

  const columns = [
    {
      title: t('제출 시각'),
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      sorter: true,
      render: (value, row) => (
        <Link to={`/verifications/${row.recordId}`}>
          {/* 제출 전(녹화 중·업로드 중·중단) 기록은 제출 시각이 없어 시작 시각을 보여 줌 */}
          <DateText value={value ?? row.startedAt} />
        </Link>
      ),
    },
    memberColumn({ idKey: 'userId', nicknameKey: 'nickname' }),
    { title: t('미션'), render: (_, row) => row.mission.title },
    {
      title: t('인증 방식'),
      render: (_, row) => METHOD_LABEL[row.mission.verificationMethod] ?? '-',
    },
    { title: t('목표'), render: (_, row) => formatTarget(row.mission) },
    { title: t('AI 신뢰도'), render: (_, row) => formatConfidence(row.ai?.confidence) },
    { title: t('AI 사유'), render: (_, row) => row.ai?.reason ?? '-' },
    {
      title: t('상태'),
      dataIndex: 'status',
      render: (value) => <StatusTag kind="recordStatus" value={value} />,
    },
  ];

  return (
    <Stack size="middle">
      <PageHeader title={t('인증 기록')} />
      <Alert
        type="info"
        showIcon
        title={
          <>
            {t(
              '모든 인증과 판정 결과가 남는 기록이에요. 판정은 AI가 먼저 하고, 관리자 판정이 필요한 건(이의 신청·AI 판정 보류)은',
            )}{' '}
            <Link to="/verifications/appeals">{t('처리 대기')}</Link>
            {t('에서 처리해요.')}
          </>
        }
      />
      <ListCard>
        <FilterBar fields={FIELDS} value={params} onChange={setParams} />
        <DataTable
          query={query}
          rowKey="recordId"
          columns={columns}
          defaultSort="submittedAt,desc"
          onRowClick={(row) => navigate(`/verifications/${row.recordId}`)}
        />
      </ListCard>
    </Stack>
  );
}
