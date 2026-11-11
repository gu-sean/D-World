// ADM-16 User-made mission review
import { useState } from 'react';
import { Button, Select, Space, Table, Tag, Typography, message } from 'antd';
import QueryState from '../../../components/QueryState.jsx';
import confirmWithReason from '../confirmWithReason.jsx';
import {
  EXERCISE_OPTIONS,
  formatDateTime,
  PAGE_SIZE,
  STATUS_LABELS,
  labelOf,
} from '../constants.js';
import { useDefinitions, useReviewDefinition } from '../queries.js';

const DECISIONS = {
  approved: { text: '승인', title: '이 미션을 공개할까요?' },
  rejected: { text: '반려', title: '이 미션을 반려할까요?', danger: true },
  hidden: { text: '숨김', title: '이 미션을 숨길까요?', danger: true },
};

export default function UserMissionReviewPage() {
  const [status, setStatus] = useState('review_pending');
  const [page, setPage] = useState(1);
  const params = {
    origin: 'user',
    publicationStatus: status,
    page,
    size: PAGE_SIZE,
    sort: 'createdAt,asc',
  };
  const { data, isLoading, error, refetch, isFetching } = useDefinitions(params);
  const review = useReviewDefinition();

  const decide = (row, decision) =>
    confirmWithReason({
      title: `${row.title}: ${DECISIONS[decision].title}`,
      okText: DECISIONS[decision].text,
      danger: DECISIONS[decision].danger,
      onOk: async (reason, idempotencyKey) => {
        await review.mutateAsync({ id: row.id, body: { decision, reason }, idempotencyKey });
        message.success('처리 결과를 저장했습니다.');
      },
    });

  const columns = [
    { title: '제목', dataIndex: 'title' },
    { title: '작성자', dataIndex: 'authorNickname', render: (value) => value ?? '-' },
    {
      title: '운동',
      dataIndex: 'exerciseCode',
      render: (value) => labelOf(EXERCISE_OPTIONS, value),
    },
    { title: '설명', dataIndex: 'description', ellipsis: true },
    { title: '제출일', dataIndex: 'submittedAt', render: formatDateTime },
    {
      title: '상태',
      dataIndex: 'publicationStatus',
      render: (value) => <Tag>{STATUS_LABELS[value] ?? value}</Tag>,
    },
    {
      title: '처리',
      render: (_, row) =>
        row.publicationStatus === 'review_pending' ? (
          <Space>
            <Button size="small" type="primary" onClick={() => decide(row, 'approved')}>
              승인
            </Button>
            <Button size="small" danger onClick={() => decide(row, 'rejected')}>
              반려
            </Button>
          </Space>
        ) : row.publicationStatus === 'public' ? (
          <Button size="small" danger onClick={() => decide(row, 'hidden')}>
            숨김
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>사용자 미션 검수</Typography.Title>
      <Select
        value={status}
        style={{ width: 160, marginBottom: 16 }}
        options={['review_pending', 'public', 'rejected', 'hidden'].map((value) => ({
          value,
          label: STATUS_LABELS[value],
        }))}
        onChange={(value) => {
          setPage(1);
          setStatus(value);
        }}
      />
      <QueryState
        loading={isLoading}
        error={error}
        onRetry={refetch}
        empty={data?.items.length === 0}
        emptyText="검수할 미션이 없습니다."
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data?.items}
          loading={isFetching}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: data?.totalCount,
            showSizeChanger: false,
            onChange: setPage,
          }}
        />
      </QueryState>
    </div>
  );
}
