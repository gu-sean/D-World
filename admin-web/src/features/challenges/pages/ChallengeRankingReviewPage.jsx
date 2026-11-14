// ADM-21 랭킹 검토와 정정
import { useState } from 'react';
import { Button, Drawer, message, Space, Table, Tag, Typography } from 'antd';
import { useParams } from 'react-router';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { memberColumn } from '../../../components/memberColumns.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { StatePanel } from '../../../components/StatePanel.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { useChallenge, useModerate, useParticipantDays, useRankings } from '../queries.js';

export default function ChallengeRankingReviewPage() {
  const { challengeId } = useParams();
  const challenge = useChallenge(challengeId);
  const rankings = useRankings(challengeId);
  const moderate = useModerate();
  const [selected, setSelected] = useState(null);
  const [pending, setPending] = useState(null); // {title, summary, body, danger}
  const days = useParticipantDays(challengeId, selected?.participationId);
  const settled = challenge.data?.settlementStatus === 'confirmed';

  const columns = [
    { title: '순위', dataIndex: 'rankNo', width: 80 },
    memberColumn({ idKey: 'userId', nicknameKey: 'nickname' }),
    { title: '점수', dataIndex: 'score' },
    { title: '성공 일수', dataIndex: 'successfulDays' },
    {
      title: '표시',
      dataIndex: 'flags',
      render: (flags) => (flags ?? []).map((flag) => <Tag key={flag}>{flag}</Tag>),
    },
    {
      title: '처리',
      key: 'actions',
      render: (_, row) => (
        <Button size="small" onClick={() => setSelected(row)}>
          검토
        </Button>
      ),
    },
  ];

  const dayColumns = [
    { title: '날짜', dataIndex: 'date' },
    {
      title: '상태',
      dataIndex: 'status',
      render: (value) => <StatusTag kind="challengeDailyMissionStatus" value={value} />,
    },
    {
      title: '조정',
      key: 'adjust',
      render: (_, day) =>
        day.status === 'excluded' ? (
          <Button
            size="small"
            disabled={settled}
            onClick={() =>
              setPending({
                title: '하루 복구',
                summary: `${day.date} 기록을 다시 반영해요.`,
                body: { action: 'restore_day', dailyMissionId: day.id },
              })
            }
          >
            복구
          </Button>
        ) : (
          <Button
            size="small"
            danger
            disabled={settled || day.status === 'cancelled'}
            onClick={() =>
              setPending({
                title: '하루 제외',
                summary: `${day.date} 기록을 점수에서 제외해요.`,
                body: { action: 'exclude_day', dailyMissionId: day.id },
                danger: true,
              })
            }
          >
            제외
          </Button>
        ),
    },
  ];

  return (
    <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        랭킹 검토와 정정
      </Typography.Title>
      {challenge.data && (
        <Typography.Text type="secondary">
          {challenge.data.title}
          {settled && ' · 정산이 확정되어 정정은 정정 정산으로 처리해야 해요.'}
        </Typography.Text>
      )}
      <QueryBoundary query={rankings}>
        {(data) =>
          data.entries.length === 0 ? (
            <StatePanel type="empty" message="참가자가 없어요." />
          ) : (
            <>
              <Table
                rowKey="participationId"
                columns={columns}
                dataSource={data.entries}
                pagination={{ pageSize: 20 }}
              />
              <Typography.Text type="secondary">
                계산 시각: <DateText value={data.ranking.calculatedAt} />
              </Typography.Text>
            </>
          )
        }
      </QueryBoundary>
      <Drawer
        open={Boolean(selected)}
        size={520}
        title={selected ? `${selected.nickname} · ${selected.rankNo}위` : ''}
        onClose={() => setSelected(null)}
        extra={
          <Button
            danger
            disabled={settled}
            onClick={() =>
              setPending({
                title: '참가자 실격',
                summary: `${selected.nickname}님을 실격 처리해요. 순위에서 빠지고 되돌릴 수 없어요.`,
                body: { action: 'disqualify' },
                danger: true,
              })
            }
          >
            실격 처리
          </Button>
        }
      >
        <QueryBoundary query={days}>
          {(data) =>
            data.items.length === 0 ? (
              <StatePanel type="empty" message="일별 기록이 없어요." />
            ) : (
              <Table
                rowKey="id"
                columns={dayColumns}
                dataSource={data.items}
                pagination={false}
                size="small"
              />
            )
          }
        </QueryBoundary>
      </Drawer>
      <ConfirmActionModal
        open={Boolean(pending)}
        title={pending?.title ?? ''}
        summary={pending?.summary ?? ''}
        danger={pending?.danger}
        onSubmit={async ({ reason, idempotencyKey }) => {
          await moderate.mutateAsync({
            id: challengeId,
            participationId: selected.participationId,
            ...pending.body,
            reason,
            idempotencyKey,
          });
          message.success('처리했어요');
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </Space>
  );
}
