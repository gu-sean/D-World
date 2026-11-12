import { Table, Tag } from 'antd';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { label, PAYMENT_STATUS } from '../labels.js';

/**
 * Settlement preview of one run (M57 `SettlementRun.entries`, ADM-20). Every number is shown
 * exactly as the server sends it: the web never adds up or recalculates points
 * (docs/parts/admin-web.md §7 rule 3).
 * @param {{entries: object[]}} props
 */
export function SettlementPreviewTable({ entries }) {
  const columns = [
    { title: '순위', dataIndex: 'rank', render: (value) => value ?? '-' },
    { title: '참가 ID', dataIndex: 'participationId', ellipsis: true },
    {
      title: '결과',
      dataIndex: 'outcome',
      render: (value) => <StatusTag kind="challengeParticipationStatus" value={value} />,
    },
    { title: '성공 일수', dataIndex: 'successfulDays' },
    { title: '점수', dataIndex: 'score' },
    { title: '예정 포인트', dataIndex: 'promisedPoints' },
    { title: '지급 포인트', dataIndex: 'paidPoints' },
    { title: '사용자 경험치', dataIndex: 'userXp' },
    { title: '펫 경험치', dataIndex: 'petXp' },
    {
      title: '지급 상태',
      dataIndex: 'paymentStatus',
      render: (value) => (
        <Tag color={PAYMENT_STATUS[value]?.color}>{label(PAYMENT_STATUS, value)}</Tag>
      ),
    },
    { title: '제외 사유', dataIndex: 'exclusionReason', render: (value) => value ?? '-' },
  ];

  return (
    <Table
      rowKey="participationId"
      columns={columns}
      dataSource={entries}
      pagination={false}
      scroll={{ x: true }}
    />
  );
}
