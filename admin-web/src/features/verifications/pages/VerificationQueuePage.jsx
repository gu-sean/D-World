// ADM-07 Verification queue
import { Link, useNavigate } from 'react-router';
import { Card, Space, Statistic, Typography } from 'antd';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { labels } from '../../../constants/labels.js';
import { formatConfidence, formatTarget, METHOD_LABEL } from '../components/format.js';
import { useVerifications } from '../queries.js';

const STATUS_VALUES = ['review_required', 'approved', 'rejected', 'submitted'];
const FIELDS = [
  {
    name: 'status',
    type: 'select',
    label: '상태',
    options: STATUS_VALUES.map((value) => ({ value, label: labels.recordStatus[value].text })),
  },
  {
    name: 'method',
    type: 'select',
    label: '인증 방식',
    options: Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label })),
  },
];

export default function VerificationQueuePage() {
  const navigate = useNavigate();
  // The API default is the oldest request first (docs/09 §5).
  const [params, setParams] = useListParams({ status: 'review_required', sort: 'submittedAt,asc' });
  const query = useVerifications(params);

  const columns = [
    {
      title: '제출 시각',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      sorter: true,
      render: (value, row) => (
        <Link to={`/verifications/${row.recordId}`}>
          <DateText value={value} />
        </Link>
      ),
    },
    { title: '미션', render: (_, row) => row.mission.title },
    {
      title: '인증 방식',
      render: (_, row) => METHOD_LABEL[row.mission.verificationMethod] ?? '-',
    },
    { title: '목표', render: (_, row) => formatTarget(row.mission) },
    { title: 'AI 신뢰도', render: (_, row) => formatConfidence(row.ai?.confidence) },
    { title: 'AI 사유', render: (_, row) => row.ai?.reason ?? '-' },
    {
      title: '상태',
      dataIndex: 'status',
      render: (value) => <StatusTag kind="recordStatus" value={value} />,
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3}>검수 대기</Typography.Title>
      <Card size="small" style={{ width: 200 }}>
        <Statistic title="오늘 처리한 판정" value={query.data?.completedToday ?? 0} suffix="건" />
      </Card>
      <FilterBar fields={FIELDS} value={params} onChange={setParams} />
      <DataTable
        query={query}
        rowKey="recordId"
        columns={columns}
        defaultSort="submittedAt,asc"
        onRowClick={(row) => navigate(`/verifications/${row.recordId}`)}
      />
    </Space>
  );
}
