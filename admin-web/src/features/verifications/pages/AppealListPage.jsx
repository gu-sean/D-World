// ADM-09 Appeal list
import { Link, useNavigate } from 'react-router';
import { Space, Typography } from 'antd';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { labels } from '../../../constants/labels.js';
import { useAppeals } from '../queries.js';

const FIELDS = [
  {
    name: 'status',
    type: 'select',
    label: '상태',
    options: Object.entries(labels.verificationAppealStatus).map(([value, { text }]) => ({
      value,
      label: text,
    })),
  },
];

export default function AppealListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useListParams({ status: 'open', sort: 'filedAt,asc' });
  const query = useAppeals(params);

  const columns = [
    {
      title: '접수 시각',
      dataIndex: 'filedAt',
      key: 'filedAt',
      sorter: true,
      render: (value, row) => (
        <Link to={`/verifications/appeals/${row.id}`}>
          <DateText value={value} />
        </Link>
      ),
    },
    { title: '사용자', render: (_, row) => row.nickname ?? row.userId },
    { title: '미션', dataIndex: 'missionTitle' },
    {
      title: '기존 판정',
      dataIndex: 'originalDecision',
      render: (value) => (value ? <StatusTag kind="decision" value={value} /> : '-'),
    },
    { title: '이의 사유', dataIndex: 'reason', ellipsis: true },
    {
      title: '상태',
      dataIndex: 'status',
      render: (value) => <StatusTag kind="verificationAppealStatus" value={value} />,
    },
    { title: '처리 시각', dataIndex: 'resolvedAt', render: (value) => <DateText value={value} /> },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3}>이의 신청</Typography.Title>
      <FilterBar fields={FIELDS} value={params} onChange={setParams} />
      <DataTable
        query={query}
        columns={columns}
        defaultSort="filedAt,asc"
        onRowClick={(row) => navigate(`/verifications/appeals/${row.id}`)}
      />
    </Space>
  );
}
