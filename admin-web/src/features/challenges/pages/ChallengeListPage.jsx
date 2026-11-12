// ADM-18 챌린지 운영 목록
import { useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { Button, Dropdown, message, Space, Typography } from 'antd';
import { useNavigate } from 'react-router';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';
import { DataTable } from '../../../components/DataTable.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { labels } from '../../../constants/labels.js';
import { label, ORIGIN, PHASE, toOptions } from '../labels.js';
import { useChallengeAction, useChallenges, useReviewChallenge } from '../queries.js';

const kindOptions = (kind) =>
  Object.entries(labels[kind]).map(([value, item]) => ({ value, label: item.text }));

const FIELDS = [
  {
    name: 'publicationStatus',
    type: 'select',
    label: '공개 상태',
    options: kindOptions('challengePublicationStatus'),
  },
  { name: 'phase', type: 'select', label: '진행 단계', options: toOptions(PHASE) },
  { name: 'origin', type: 'select', label: '출처', options: toOptions(ORIGIN) },
  {
    name: 'settlementStatus',
    type: 'select',
    label: '정산 상태',
    options: kindOptions('challengeSettlementStatus'),
  },
];

export default function ChallengeListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useListParams({ sort: 'startDate,desc' }); // API default (docs/09)
  const query = useChallenges(params);
  const action = useChallengeAction();
  const review = useReviewChallenge();
  const [target, setTarget] = useState(null); // {row, type: 'action'|'review', value, title, danger}

  const ask = (row, type, value, title, danger = false) =>
    setTarget({ row, type, value, title, danger });

  const menuFor = (row) => {
    const items = [];
    if (row.origin === 'admin' && row.publicationStatus !== 'cancelled') {
      items.push({
        key: 'edit',
        label: '수정',
        onClick: () => navigate(`/challenges/${row.id}/edit`),
      });
    }
    if (row.origin === 'admin' && row.publicationStatus === 'draft') {
      items.push({
        key: 'publish',
        label: '공개',
        onClick: () => ask(row, 'action', 'publish', '챌린지 공개'),
      });
    }
    if (row.origin === 'user' && row.publicationStatus === 'review_pending') {
      items.push(
        {
          key: 'approve',
          label: '검수 승인',
          onClick: () => ask(row, 'review', 'approved', '검수 승인'),
        },
        {
          key: 'reject',
          label: '검수 반려',
          danger: true,
          onClick: () => ask(row, 'review', 'rejected', '검수 반려', true),
        },
      );
    }
    if (row.publicationStatus === 'public') {
      items.push({
        key: 'hide',
        label: '숨김',
        danger: true,
        onClick: () => ask(row, 'action', 'hide', '챌린지 숨김', true),
      });
    }
    if (['public', 'hidden'].includes(row.publicationStatus)) {
      items.push({
        key: 'cancel',
        label: '취소',
        danger: true,
        onClick: () => ask(row, 'action', 'cancel', '챌린지 취소', true),
      });
    }
    return items;
  };

  const columns = [
    {
      title: '챌린지',
      dataIndex: 'title',
      render: (title, row) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{title}</Typography.Text>
          <Typography.Text type="secondary">
            {label(ORIGIN, row.origin)}
            {row.creatorNickname ? ` · ${row.creatorNickname}` : ''}
          </Typography.Text>
        </Space>
      ),
    },
    { title: '기간', key: 'period', render: (_, row) => `${row.startDate} ~ ${row.endDate}` },
    { title: '진행', dataIndex: 'phase', render: (value) => label(PHASE, value) },
    {
      title: '공개 상태',
      dataIndex: 'publicationStatus',
      render: (value) => <StatusTag kind="challengePublicationStatus" value={value} />,
    },
    {
      title: '참가자',
      key: 'participants',
      render: (_, row) =>
        `${row.participantCount}${row.maxParticipants ? ` / ${row.maxParticipants}` : ''}`,
    },
    {
      title: '정산',
      dataIndex: 'settlementStatus',
      render: (value) => <StatusTag kind="challengeSettlementStatus" value={value} />,
    },
    {
      title: '처리',
      key: 'actions',
      render: (_, row) => {
        const items = menuFor(row);
        return (
          <Space>
            <Button size="small" onClick={() => navigate(`/challenges/${row.id}/rankings`)}>
              순위
            </Button>
            <Button size="small" onClick={() => navigate(`/challenges/${row.id}/settlement`)}>
              정산
            </Button>
            {items.length > 0 && (
              <Dropdown menu={{ items }} trigger={['click']}>
                <Button size="small">더보기</Button>
              </Dropdown>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          챌린지 운영 목록
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/challenges/new')}>
          공식 챌린지 등록
        </Button>
      </Space>
      <FilterBar fields={FIELDS} value={params} onChange={setParams} />
      <DataTable query={query} columns={columns} defaultSort="startDate,desc" />
      <ConfirmActionModal
        open={Boolean(target)}
        title={target?.title ?? ''}
        summary={target ? `${target.row.title} · ${target.title}` : ''}
        danger={target?.danger}
        onSubmit={async ({ reason, idempotencyKey }) => {
          if (target.type === 'review') {
            await review.mutateAsync({
              id: target.row.id,
              decision: target.value,
              reason,
              idempotencyKey,
            });
          } else {
            await action.mutateAsync({
              id: target.row.id,
              action: target.value,
              reason,
              idempotencyKey,
            });
          }
          message.success('처리했어요');
          setTarget(null);
        }}
        onCancel={() => setTarget(null)}
      />
    </Space>
  );
}
