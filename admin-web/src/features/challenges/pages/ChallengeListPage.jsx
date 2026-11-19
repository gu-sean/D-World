// ADM-18 챌린지 운영 목록
// 챌린지는 관리자만 만들고 관리한다 (회원 개설·검수 없음). 회원은 앱에서 참여 여부만 고른다.
import { useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { Button, Dropdown, Space, Typography } from 'antd';
import { message } from '../../../lib/message.jsx';
import { useNavigate } from 'react-router';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';
import { DataTable } from '../../../components/DataTable.jsx';
import { FilterBar } from '../../../components/FilterBar.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useListParams } from '../../../components/useListParams.js';
import { labels } from '../../../constants/labels.js';
import { label, PHASE, toOptions } from '../labels.js';
import { useChallengeAction, useChallenges } from '../queries.js';
import { PageHeader } from '../../../components/PageHeader.jsx';
import { t } from '../../../i18n/index.js';
import { ListCard } from '../../../components/ListCard.jsx';
import { Stack } from '../../../components/Stack.jsx';

const kindOptions = (kind) =>
  Object.entries(labels[kind]).map(([value, item]) => ({ value, label: item.text }));

const FIELDS = [
  {
    name: 'publicationStatus',
    type: 'select',
    label: t('공개 상태'),
    options: kindOptions('challengePublicationStatus'),
  },
  { name: 'phase', type: 'select', label: t('진행 단계'), options: toOptions(PHASE) },
  {
    name: 'settlementStatus',
    type: 'select',
    label: t('정산 상태'),
    options: kindOptions('challengeSettlementStatus'),
  },
];

export default function ChallengeListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useListParams({ sort: 'startDate,desc' }); // API default (docs/09)
  const query = useChallenges(params);
  const action = useChallengeAction();
  const [target, setTarget] = useState(null); // {row, type: 'action', value, title, danger}

  const ask = (row, type, value, title, danger = false) =>
    setTarget({ row, type, value, title, danger });

  const menuFor = (row) => {
    const items = [];
    if (row.publicationStatus !== 'cancelled') {
      items.push({
        key: 'edit',
        label: t('수정'),
        onClick: () => navigate(`/challenges/${row.id}/edit`),
      });
    }
    if (row.publicationStatus === 'draft') {
      items.push({
        key: 'publish',
        label: t('공개'),
        onClick: () => ask(row, 'action', 'publish', t('챌린지 공개')),
      });
    }
    if (row.publicationStatus === 'public') {
      items.push({
        key: 'hide',
        label: t('숨김'),
        danger: true,
        onClick: () => ask(row, 'action', 'hide', t('챌린지 숨김'), true),
      });
    }
    if (row.publicationStatus === 'hidden') {
      items.push({
        key: 'unhide',
        label: t('숨김 해제'),
        onClick: () => ask(row, 'action', 'unhide', t('챌린지 숨김 해제')),
      });
    }
    if (['public', 'hidden'].includes(row.publicationStatus)) {
      items.push({
        key: 'cancel',
        label: t('취소'),
        danger: true,
        onClick: () => ask(row, 'action', 'cancel', t('챌린지 취소'), true),
      });
    }
    return items;
  };

  const columns = [
    {
      title: t('챌린지'),
      dataIndex: 'title',
      render: (title) => <Typography.Text strong>{title}</Typography.Text>,
    },
    { title: t('기간'), key: 'period', render: (_, row) => `${row.startDate} ~ ${row.endDate}` },
    { title: t('진행'), dataIndex: 'phase', render: (value) => label(PHASE, value) },
    {
      title: t('공개 상태'),
      dataIndex: 'publicationStatus',
      render: (value) => <StatusTag kind="challengePublicationStatus" value={value} />,
    },
    {
      title: t('참가자'),
      key: 'participants',
      render: (_, row) =>
        `${row.participantCount}${row.maxParticipants ? ` / ${row.maxParticipants}` : ''}`,
    },
    {
      title: t('정산'),
      dataIndex: 'settlementStatus',
      render: (value) => <StatusTag kind="challengeSettlementStatus" value={value} />,
    },
    {
      title: t('처리'),
      key: 'actions',
      render: (_, row) => {
        const items = menuFor(row);
        return (
          <Space>
            <Button size="small" onClick={() => navigate(`/challenges/${row.id}/rankings`)}>
              {t('순위')}
            </Button>
            <Button size="small" onClick={() => navigate(`/challenges/${row.id}/settlement`)}>
              {t('정산')}
            </Button>
            {items.length > 0 && (
              <Dropdown menu={{ items }} trigger={['click']}>
                <Button size="small">{t('더보기')}</Button>
              </Dropdown>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Stack size="middle">
      <PageHeader
        title={t('챌린지 운영 목록')}
        description={t('공개 상태와 정산 상태를 확인하고 공식 챌린지를 등록해요.')}
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/challenges/new')}
          >
            {t('공식 챌린지 등록')}
          </Button>
        }
      />
      <ListCard>
        <FilterBar fields={FIELDS} value={params} onChange={setParams} />
        <DataTable query={query} columns={columns} defaultSort="startDate,desc" />
      </ListCard>
      <ConfirmActionModal
        open={Boolean(target)}
        title={target?.title ?? ''}
        summary={target ? `${target.row.title} · ${target.title}` : ''}
        danger={target?.danger}
        onSubmit={async ({ reason, idempotencyKey }) => {
          await action.mutateAsync({
            id: target.row.id,
            action: target.value,
            reason,
            idempotencyKey,
          });
          message.success(t('처리했어요'));
          setTarget(null);
        }}
        onCancel={() => setTarget(null)}
      />
    </Stack>
  );
}
