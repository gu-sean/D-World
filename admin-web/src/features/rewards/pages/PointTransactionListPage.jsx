// ADM-22 Point transaction list
import { Button, Statistic, Typography } from 'antd';
import { Link } from 'react-router';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { MEMBER_FIELD, memberColumn } from '../../../components/memberColumns.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { optionsOf } from '../components/labels.js';
import { usePointTransactions } from '../queries.js';
import { PageHeader } from '../../../components/PageHeader.jsx';
import { ListCard } from '../../../components/ListCard.jsx';
import { t } from '../../../i18n/index.js';

const DEFAULT_SORT = 'occurredAt,desc'; // docs/09 M70

const fields = [
  MEMBER_FIELD,
  { name: 'kind', type: 'select', label: t('종류'), options: optionsOf('pointTransactionKind') },
  { name: 'sourceType', type: 'select', label: t('출처'), options: optionsOf('pointSourceType') },
  { name: 'period', type: 'dateRange', label: t('기간') }, // writes `from` and `to`
];

// The server's number, only with a sign for reading.
const signed = (n) => (n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString());

const columns = [
  {
    title: t('시각'),
    dataIndex: 'occurredAt',
    key: 'occurredAt',
    sorter: true,
    width: 160,
    render: (value) => <DateText value={value} />,
  },
  memberColumn({ idKey: 'userId', nicknameKey: 'nickname' }),
  {
    title: t('종류'),
    dataIndex: 'kind',
    render: (value) => <StatusTag kind="pointTransactionKind" value={value} />,
  },
  {
    title: t('출처'),
    dataIndex: 'sourceType',
    render: (value) => <StatusTag kind="pointSourceType" value={value} />,
  },
  {
    title: t('가용 변동'),
    dataIndex: 'availableDelta',
    align: 'right',
    render: (n) => (
      <Typography.Text type={n < 0 ? 'danger' : undefined}>{signed(n)}</Typography.Text>
    ),
  },
  {
    title: t('잔액'),
    dataIndex: 'balanceAfter',
    align: 'right',
    render: (n) => n.toLocaleString(),
  },
  {
    title: t('미회수'),
    dataIndex: 'outstandingAfter',
    align: 'right',
    render: (n) => n.toLocaleString(),
  },
  { title: t('사유'), dataIndex: 'reason', ellipsis: true, render: (reason) => reason ?? '-' },
];

export default function PointTransactionListPage() {
  const [params, setParams] = useListParams({ sort: DEFAULT_SORT });
  const query = usePointTransactions(params);

  return (
    <div>
      <PageHeader
        title={t('포인트 내역')}
        description={t('회원의 포인트 지급·사용·회수 기록이에요.')}
        actions={
          <Link to="/rewards/points/adjust">
            <Button type="primary">{t('포인트 수동 조정')}</Button>
          </Link>
        }
      />

      {query.data && (
        <Statistic
          title={t('검수 대기 중인 보상 합계')}
          value={query.data.pendingPoints}
          suffix="P"
          className="mb-16"
        />
      )}
      <ListCard>
        <FilterBar fields={fields} value={params} onChange={setParams} />
        <DataTable query={query} columns={columns} defaultSort={DEFAULT_SORT} />
      </ListCard>
    </div>
  );
}
