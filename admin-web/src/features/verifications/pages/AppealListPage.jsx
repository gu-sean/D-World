// ADM-09 Appeal list
import { useState } from 'react';
import { Link } from 'react-router';
import { Select, Space, Table, Typography } from 'antd';
import StatePanel from '../../../components/StatePanel.jsx';
import { StatusTag } from '../components/RecordSummary.jsx';
import { APPEAL_STATUS, DECISION_LABEL, formatDateTime } from '../components/format.js';
import { useAppeals } from '../queries.js';

const STATUS_OPTIONS = Object.entries(APPEAL_STATUS).map(([value, { label }]) => ({
  value,
  label,
}));

export default function AppealListPage() {
  const [status, setStatus] = useState('open');
  const [paging, setPaging] = useState({ page: 1, size: 20 });
  const query = useAppeals({ status, ...paging, sort: 'filedAt,asc' });
  const { data } = query;

  const columns = [
    {
      title: '접수 시각',
      dataIndex: 'filedAt',
      render: (value, row) => (
        <Link to={`/verifications/appeals/${row.id}`}>{formatDateTime(value)}</Link>
      ),
    },
    { title: '사용자', render: (_, row) => row.nickname ?? row.userId },
    { title: '미션', dataIndex: 'missionTitle' },
    {
      title: '기존 판정',
      dataIndex: 'originalDecision',
      render: (value) => DECISION_LABEL[value] ?? value ?? '-',
    },
    { title: '이의 사유', dataIndex: 'reason', ellipsis: true },
    {
      title: '상태',
      dataIndex: 'status',
      render: (value) => <StatusTag map={APPEAL_STATUS} value={value} />,
    },
    { title: '처리 시각', dataIndex: 'resolvedAt', render: formatDateTime },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3}>이의 신청</Typography.Title>
      <Select
        aria-label="상태"
        style={{ width: 140 }}
        value={status}
        options={STATUS_OPTIONS}
        onChange={(next) => {
          setStatus(next);
          setPaging((prev) => ({ ...prev, page: 1 }));
        }}
      />
      <StatePanel
        loading={query.isLoading}
        error={query.error}
        empty={data?.items.length === 0}
        emptyText="처리할 이의 신청이 없습니다."
        onRetry={query.refetch}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data?.items}
          loading={query.isFetching}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: paging.page,
            pageSize: paging.size,
            total: data?.totalCount,
            onChange: (page, size) => setPaging({ page, size }),
          }}
        />
      </StatePanel>
    </Space>
  );
}
