// ADM-07 Verification queue
import { useState } from 'react';
import { Link } from 'react-router';
import { Card, Select, Space, Statistic, Table, Typography } from 'antd';
import QueryState from '../../../components/QueryState.jsx';
import { StatusTag } from '../components/RecordSummary.jsx';
import { formatDateTime, formatTarget, METHOD_LABEL, RECORD_STATUS } from '../components/format.js';
import { useVerifications } from '../queries.js';

const STATUS_OPTIONS = Object.entries(RECORD_STATUS).map(([value, { label }]) => ({
  value,
  label,
}));
const METHOD_OPTIONS = [
  { value: undefined, label: '전체 방식' },
  ...Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label })),
];

export default function VerificationQueuePage() {
  const [filters, setFilters] = useState({ status: 'review_required', method: undefined });
  const [paging, setPaging] = useState({ page: 1, size: 20 });
  const query = useVerifications({ ...filters, ...paging, sort: 'submittedAt,asc' });
  const { data } = query;

  const columns = [
    {
      title: '제출 시각',
      dataIndex: 'submittedAt',
      render: (value, row) => (
        <Link to={`/verifications/${row.recordId}`}>{formatDateTime(value)}</Link>
      ),
    },
    { title: '미션', render: (_, row) => row.mission.title },
    {
      title: '인증 방식',
      render: (_, row) => METHOD_LABEL[row.mission.verificationMethod] ?? '-',
    },
    { title: '목표', render: (_, row) => formatTarget(row.mission) },
    {
      title: 'AI 신뢰도',
      render: (_, row) =>
        row.ai?.confidence == null ? '-' : `${Math.round(row.ai.confidence * 100)}%`,
    },
    { title: 'AI 사유', render: (_, row) => row.ai?.reason ?? '-' },
    {
      title: '상태',
      dataIndex: 'status',
      render: (value) => <StatusTag map={RECORD_STATUS} value={value} />,
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3}>검수 대기</Typography.Title>
      <Space wrap size="large">
        <Card size="small">
          <Statistic title="오늘 처리한 판정" value={data?.completedToday ?? 0} suffix="건" />
        </Card>
        <Select
          aria-label="상태"
          style={{ width: 140 }}
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={(status) => {
            setFilters((prev) => ({ ...prev, status }));
            setPaging((prev) => ({ ...prev, page: 1 }));
          }}
        />
        <Select
          aria-label="인증 방식"
          style={{ width: 140 }}
          value={filters.method}
          options={METHOD_OPTIONS}
          onChange={(method) => {
            setFilters((prev) => ({ ...prev, method }));
            setPaging((prev) => ({ ...prev, page: 1 }));
          }}
        />
      </Space>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        empty={data?.items.length === 0}
        emptyText="검수할 인증이 없습니다."
        onRetry={query.refetch}
      >
        <Table
          rowKey="recordId"
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
      </QueryState>
    </Space>
  );
}
