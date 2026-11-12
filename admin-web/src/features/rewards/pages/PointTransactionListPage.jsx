// ADM-22 Point transaction list
import { Button, Space, Statistic, Typography } from 'antd';
import { Link } from 'react-router';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { optionsOf } from '../components/labels.js';
import { usePointTransactions } from '../queries.js';

const DEFAULT_SORT = 'occurredAt,desc'; // docs/09 M70

const fields = [
  { name: 'userId', type: 'text', label: '회원 ID' },
  { name: 'kind', type: 'select', label: '종류', options: optionsOf('pointTransactionKind') },
  { name: 'sourceType', type: 'select', label: '출처', options: optionsOf('pointSourceType') },
  { name: 'period', type: 'dateRange', label: '기간' }, // writes `from` and `to`
];

// The server's number, only with a sign for reading.
const signed = (n) => (n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString());

const columns = [
  {
    title: '시각',
    dataIndex: 'occurredAt',
    key: 'occurredAt',
    sorter: true,
    width: 160,
    render: (value) => <DateText value={value} />,
  },
  { title: '회원', dataIndex: 'userId', ellipsis: true, width: 120 },
  {
    title: '종류',
    dataIndex: 'kind',
    render: (value) => <StatusTag kind="pointTransactionKind" value={value} />,
  },
  {
    title: '출처',
    dataIndex: 'sourceType',
    render: (value) => <StatusTag kind="pointSourceType" value={value} />,
  },
  {
    title: '가용 변동',
    dataIndex: 'availableDelta',
    align: 'right',
    render: (n) => (
      <Typography.Text type={n < 0 ? 'danger' : undefined}>{signed(n)}</Typography.Text>
    ),
  },
  { title: '잔액', dataIndex: 'balanceAfter', align: 'right', render: (n) => n.toLocaleString() },
  {
    title: '미회수',
    dataIndex: 'outstandingAfter',
    align: 'right',
    render: (n) => n.toLocaleString(),
  },
  { title: '사유', dataIndex: 'reason', ellipsis: true, render: (reason) => reason ?? '-' },
];

export default function PointTransactionListPage() {
  const [params, setParams] = useListParams({ sort: DEFAULT_SORT });
  const query = usePointTransactions(params);

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          포인트 내역
        </Typography.Title>
        <Link to="/rewards/points/adjust">
          <Button type="primary">포인트 수동 조정</Button>
        </Link>
      </Space>

      <FilterBar fields={fields} value={params} onChange={setParams} />
      {query.data && (
        <Statistic
          title="검수 대기 중인 보상 합계"
          value={query.data.pendingPoints}
          suffix="P"
          style={{ marginBottom: 16 }}
        />
      )}
      <DataTable query={query} columns={columns} defaultSort={DEFAULT_SORT} />
    </div>
  );
}
