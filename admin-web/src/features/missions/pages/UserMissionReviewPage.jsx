// ADM-16 사용자 미션 검수
import { useState } from 'react';
import { Button, message, Space, Typography } from 'antd';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { EXERCISE_OPTIONS, labelOf } from '../constants.js';
import { useDefinitions, useReviewDefinition } from '../queries.js';

const DECISIONS = {
  approved: { text: '승인', title: '미션 공개 승인' },
  rejected: { text: '반려', title: '미션 반려', danger: true },
  hidden: { text: '숨김', title: '미션 숨김', danger: true },
};

const STATUS_OPTIONS = [
  { value: 'review_pending', label: '검수 대기' },
  { value: 'public', label: '공개' },
  { value: 'rejected', label: '반려' },
  { value: 'hidden', label: '숨김' },
];

const fields = [
  { name: 'publicationStatus', type: 'select', label: '상태', options: STATUS_OPTIONS },
];

export default function UserMissionReviewPage() {
  const [params, setParams] = useListParams({
    publicationStatus: 'review_pending',
    sort: 'createdAt,asc', // API default (docs/09)
  });
  const query = useDefinitions({ ...params, origin: 'user' });
  const review = useReviewDefinition();
  const [target, setTarget] = useState(null); // {row, decision}

  const columns = [
    { title: '제목', dataIndex: 'title' },
    { title: '작성자', dataIndex: 'authorNickname', render: (value) => value ?? '-' },
    {
      title: '운동',
      dataIndex: 'exerciseCode',
      render: (value) => labelOf(EXERCISE_OPTIONS, value),
    },
    { title: '설명', dataIndex: 'description', ellipsis: true },
    {
      title: '제출 시각',
      dataIndex: 'submittedAt',
      key: 'createdAt',
      sorter: true,
      render: (value) => <DateText value={value} />,
    },
    {
      title: '상태',
      dataIndex: 'publicationStatus',
      render: (value) => <StatusTag kind="missionDefinitionPublicationStatus" value={value} />,
    },
    {
      title: '처리',
      key: 'actions',
      render: (_, row) =>
        row.publicationStatus === 'review_pending' ? (
          <Space>
            <Button
              size="small"
              type="primary"
              onClick={() => setTarget({ row, decision: 'approved' })}
            >
              승인
            </Button>
            <Button size="small" danger onClick={() => setTarget({ row, decision: 'rejected' })}>
              반려
            </Button>
          </Space>
        ) : row.publicationStatus === 'public' ? (
          <Button size="small" danger onClick={() => setTarget({ row, decision: 'hidden' })}>
            숨김
          </Button>
        ) : null,
    },
  ];

  const decision = target ? DECISIONS[target.decision] : null;

  return (
    <div>
      <Typography.Title level={4}>사용자 미션 검수</Typography.Title>
      <FilterBar fields={fields} value={params} onChange={setParams} />
      <DataTable query={query} columns={columns} defaultSort="createdAt,asc" />
      <ConfirmActionModal
        open={Boolean(target)}
        title={decision?.title ?? ''}
        summary={target ? `${target.row.title} · ${decision.text}` : ''}
        danger={decision?.danger}
        onSubmit={async ({ reason, idempotencyKey }) => {
          await review.mutateAsync({
            id: target.row.id,
            body: { decision: target.decision, reason },
            idempotencyKey,
          });
          message.success('처리했어요');
          setTarget(null);
        }}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
