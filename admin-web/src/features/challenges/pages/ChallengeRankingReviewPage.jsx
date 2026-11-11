// ADM-21 Ranking review and correction
import { useState } from 'react';
import { App, Button, Drawer, Space, Table, Tag, Typography } from 'antd';
import { useParams } from 'react-router';
import QueryState from '../../../components/QueryState.jsx';
import { confirmWithReason } from '../confirmWithReason.jsx';
import { DAY_STATUS, label } from '../labels.js';
import { useChallenge, useModerate, useParticipantDays, useRankings } from '../queries.js';

export default function ChallengeRankingReviewPage() {
  const { challengeId } = useParams();
  const { message } = App.useApp();
  const challenge = useChallenge(challengeId);
  const rankings = useRankings(challengeId);
  const moderate = useModerate();
  const [selected, setSelected] = useState(null);
  const days = useParticipantDays(challengeId, selected?.participationId);
  const settled = challenge.data?.settlementStatus === 'confirmed';

  const act = ({ title, description, body, danger = true }) =>
    confirmWithReason({
      title,
      description,
      okText: '확인 후 적용',
      danger,
      onConfirm: async (reason) => {
        await moderate.mutateAsync({
          id: challengeId,
          participationId: selected.participationId,
          ...body,
          reason,
        });
        message.success('변경 사항을 저장했습니다.');
      },
    });

  const disqualify = () =>
    act({
      title: '참가자 실격',
      description: `${selected.nickname}님을 실격 처리해요. 순위에서 빠지고 되돌릴 수 없어요.`,
      body: { action: 'disqualify' },
    });

  const columns = [
    { title: '순위', dataIndex: 'rankNo', width: 80 },
    { title: '닉네임', dataIndex: 'nickname' },
    { title: '점수', dataIndex: 'score' },
    { title: '성공 일수', dataIndex: 'successfulDays' },
    {
      title: '표시',
      dataIndex: 'flags',
      render: (flags) => (flags ?? []).map((flag) => <Tag key={flag}>{flag}</Tag>),
    },
    {
      title: '처리',
      render: (_, row) => (
        <Button size="small" onClick={() => setSelected(row)}>
          검토
        </Button>
      ),
    },
  ];

  const dayColumns = [
    { title: '날짜', dataIndex: 'date' },
    { title: '상태', dataIndex: 'status', render: (v) => label(DAY_STATUS, v) },
    {
      title: '조정',
      render: (_, day) =>
        day.status === 'excluded' ? (
          <Button
            size="small"
            disabled={settled}
            onClick={() =>
              act({
                title: '하루 복구',
                description: `${day.date} 기록을 다시 반영해요.`,
                body: { action: 'restore_day', dailyMissionId: day.id },
                danger: false,
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
              act({
                title: '하루 제외',
                description: `${day.date} 기록을 점수에서 제외해요.`,
                body: { action: 'exclude_day', dailyMissionId: day.id },
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
      <QueryState
        loading={rankings.isLoading}
        error={rankings.error}
        onRetry={rankings.refetch}
        empty={rankings.data?.entries.length === 0}
        emptyText="참가자가 없습니다."
      >
        <Table
          rowKey="participationId"
          columns={columns}
          dataSource={rankings.data?.entries}
          pagination={{ pageSize: 20 }}
        />
        {rankings.data && (
          <Typography.Text type="secondary">
            계산 시각: {rankings.data.ranking.calculatedAt}
          </Typography.Text>
        )}
      </QueryState>
      <Drawer
        open={Boolean(selected)}
        width={520}
        title={selected ? `${selected.nickname} · ${selected.rankNo}위` : ''}
        onClose={() => setSelected(null)}
        extra={
          <Button danger disabled={settled} onClick={disqualify}>
            실격 처리
          </Button>
        }
      >
        <QueryState
          loading={days.isLoading}
          error={days.error}
          onRetry={days.refetch}
          empty={days.data?.items.length === 0}
          emptyText="일별 기록이 없습니다."
        >
          <Table
            rowKey="id"
            columns={dayColumns}
            dataSource={days.data?.items}
            pagination={false}
            size="small"
          />
        </QueryState>
      </Drawer>
    </Space>
  );
}
