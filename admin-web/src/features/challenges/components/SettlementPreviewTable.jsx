import { Table, Tag } from 'antd';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { label, PAYMENT_STATUS } from '../labels.js';
import { t } from '../../../i18n/index.js';

/**
 * Settlement preview of one run (M57 `SettlementRun.entries`, ADM-20). Every number is shown
 * exactly as the server sends it: the web never adds up or recalculates points
 * (docs/parts/admin-web.md §7 rule 3).
 * @param {{entries: object[]}} props
 */
export function SettlementPreviewTable({ entries }) {
  const columns = [
    { title: t('순위'), dataIndex: 'rank', render: (value) => value ?? '-' },
    { title: t('참가 ID'), dataIndex: 'participationId', ellipsis: true },
    {
      title: t('결과'),
      dataIndex: 'outcome',
      render: (value) => <StatusTag kind="challengeParticipationStatus" value={value} />,
    },
    { title: t('성공 일수'), dataIndex: 'successfulDays' },
    { title: t('점수'), dataIndex: 'score' },
    { title: t('예정 포인트'), dataIndex: 'promisedPoints' },
    { title: t('지급 포인트'), dataIndex: 'paidPoints' },
    { title: t('펫 경험치'), dataIndex: 'petXp' },
    {
      title: t('지급 상태'),
      dataIndex: 'paymentStatus',
      render: (value) => (
        <Tag color={PAYMENT_STATUS[value]?.color}>{label(PAYMENT_STATUS, value)}</Tag>
      ),
    },
    { title: t('제외 사유'), dataIndex: 'exclusionReason', render: (value) => value ?? '-' },
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
