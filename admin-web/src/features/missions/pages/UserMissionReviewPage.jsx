// ADM-16 사용자 미션 검수
import { useState } from 'react';
import { Button, message, Space, Typography } from 'antd';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';
import { DataTable } from '../../../components/DataTable.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { memberColumn } from '../../../components/memberColumns.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { EXERCISE_OPTIONS, labelOf } from '../constants.js';
import { useDefinitions, useReviewDefinition } from '../queries.js';
import { t } from '../../../i18n/index.js';

const DECISIONS = {
  approved: { text: t('승인'), title: t('미션 공개 승인') },
  rejected: { text: t('반려'), title: t('미션 반려'), danger: true },
  hidden: { text: t('숨김'), title: t('미션 숨김'), danger: true },
};

const STATUS_OPTIONS = [
  { value: 'review_pending', label: t('검수 대기') },
  { value: 'public', label: t('공개') },
  { value: 'rejected', label: t('반려') },
  { value: 'hidden', label: t('숨김') },
];

const fields = [
  { name: 'publicationStatus', type: 'select', label: t('상태'), options: STATUS_OPTIONS },
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
    { title: t('제목'), dataIndex: 'title' },
    memberColumn({ title: t('작성자'), idKey: 'authorId', nicknameKey: 'authorNickname' }),
    {
      title: t('운동'),
      dataIndex: 'exerciseCode',
      render: (value) => labelOf(EXERCISE_OPTIONS, value),
    },
    { title: t('설명'), dataIndex: 'description', ellipsis: true },
    {
      title: t('제출 시각'),
      dataIndex: 'submittedAt',
      key: 'createdAt',
      sorter: true,
      render: (value) => <DateText value={value} />,
    },
    {
      title: t('상태'),
      dataIndex: 'publicationStatus',
      render: (value) => <StatusTag kind="missionDefinitionPublicationStatus" value={value} />,
    },
    {
      title: t('처리'),
      key: 'actions',
      render: (_, row) =>
        row.publicationStatus === 'review_pending' ? (
          <Space>
            <Button
              size="small"
              type="primary"
              onClick={() => setTarget({ row, decision: 'approved' })}
            >
              {t('승인')}
            </Button>
            <Button size="small" danger onClick={() => setTarget({ row, decision: 'rejected' })}>
              {t('반려')}
            </Button>
          </Space>
        ) : row.publicationStatus === 'public' ? (
          <Button size="small" danger onClick={() => setTarget({ row, decision: 'hidden' })}>
            {t('숨김')}
          </Button>
        ) : null,
    },
  ];

  const decision = target ? DECISIONS[target.decision] : null;

  return (
    <div>
      <Typography.Title level={4}>{t('사용자 미션 검수')}</Typography.Title>
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
          message.success(t('처리했어요'));
          setTarget(null);
        }}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
