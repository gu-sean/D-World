// ADM-20 Challenge settlement and rewards
import { App, Alert, Button, Descriptions, Space, Table, Tag, Typography } from 'antd';
import { useParams, useSearchParams } from 'react-router';
import QueryState from '../../../components/QueryState.jsx';
import { confirmWithReason } from '../confirmWithReason.jsx';
import {
  BLOCKER_LABEL,
  label,
  OUTCOME,
  PAYMENT_STATUS,
  RUN_STATUS,
  SETTLEMENT_STATUS,
} from '../labels.js';
import {
  useChallenge,
  useConfirmSettlementRun,
  useCreateSettlementRun,
  useRetryPayments,
  useSettlementRun,
} from '../queries.js';

export default function ChallengeSettlementPage() {
  const { challengeId } = useParams();
  const { message } = App.useApp();
  // The run id is not part of the challenge view, so it travels in the URL (?run=...).
  const [searchParams, setSearchParams] = useSearchParams();
  const runId = searchParams.get('run');
  const challenge = useChallenge(challengeId);
  const run = useSettlementRun(runId);
  const createRun = useCreateSettlementRun();
  const confirmRun = useConfirmSettlementRun();
  const retry = useRetryPayments();

  const blockers = run.data?.blockers;
  const isDraft = run.data?.status === 'draft';
  const hasFailedPayments = run.data?.entries.some((e) => e.paymentStatus === 'failed');
  const corrected = challenge.data?.settlementStatus === 'confirmed';

  const startDraft = () =>
    confirmWithReason({
      title: corrected ? '정정 정산 초안 만들기' : '정산 초안 만들기',
      description: '기존 초안이 있으면 새 초안으로 대체돼요.',
      okText: '초안 만들기',
      onConfirm: async (reason) => {
        const created = await createRun.mutateAsync({ id: challengeId, reason });
        setSearchParams({ run: created.id });
        message.success('정산 초안을 만들었습니다.');
      },
    });

  const confirmDraft = () =>
    confirmWithReason({
      title: '정산 확정',
      description: '확정하면 완주자에게 보상이 지급돼요. 되돌릴 수 없어요.',
      okText: '확인 후 적용',
      danger: true,
      onConfirm: async (reason) => {
        await confirmRun.mutateAsync({ runId, reason });
        await run.refetch();
        message.success('정산을 확정했습니다.');
      },
    });

  const retryPayments = () =>
    confirmWithReason({
      title: '실패한 지급 다시 시도',
      okText: '다시 시도',
      onConfirm: async (reason) => {
        const result = await retry.mutateAsync({ runId, reason });
        await run.refetch();
        message.success(`${result.retriedCount}건을 다시 처리했습니다.`);
      },
    });

  const columns = [
    { title: '순위', dataIndex: 'rank', render: (v) => v ?? '-' },
    { title: '참가 ID', dataIndex: 'participationId', ellipsis: true },
    { title: '결과', dataIndex: 'outcome', render: (v) => label(OUTCOME, v) },
    { title: '성공 일수', dataIndex: 'successfulDays' },
    { title: '점수', dataIndex: 'score' },
    { title: '예정 포인트', dataIndex: 'promisedPoints' },
    { title: '지급 포인트', dataIndex: 'paidPoints' },
    { title: '경험치(사용자/펫)', render: (_, e) => `${e.userXp} / ${e.petXp}` },
    {
      title: '지급 상태',
      dataIndex: 'paymentStatus',
      render: (v) => <Tag color={PAYMENT_STATUS[v]?.color}>{label(PAYMENT_STATUS, v)}</Tag>,
    },
    { title: '제외 사유', dataIndex: 'exclusionReason', render: (v) => v ?? '-' },
  ];

  return (
    <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        챌린지 정산과 보상
      </Typography.Title>
      <QueryState loading={challenge.isLoading} error={challenge.error} onRetry={challenge.refetch}>
        {challenge.data && (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="챌린지">{challenge.data.title}</Descriptions.Item>
            <Descriptions.Item label="기간">
              {challenge.data.startDate} ~ {challenge.data.endDate}
            </Descriptions.Item>
            <Descriptions.Item label="정산 상태">
              {label(SETTLEMENT_STATUS, challenge.data.settlementStatus)}
            </Descriptions.Item>
            <Descriptions.Item label="참가자">{challenge.data.participantCount}</Descriptions.Item>
          </Descriptions>
        )}
      </QueryState>

      <Space>
        <Button type="primary" onClick={startDraft} loading={createRun.isPending}>
          {corrected ? '정정 정산 초안 만들기' : '정산 초안 만들기'}
        </Button>
        {isDraft && (
          <Button danger onClick={confirmDraft} disabled={blockers ? !blockers.ready : false}>
            정산 확정
          </Button>
        )}
        {hasFailedPayments && <Button onClick={retryPayments}>지급 실패 다시 시도</Button>}
      </Space>
      {createRun.error && <Alert type="error" showIcon title={createRun.error.message} />}

      {!runId && !createRun.error && (
        <Alert type="info" showIcon title="정산 초안을 만들면 결과가 여기에 표시돼요." />
      )}

      {runId && (
        <QueryState loading={run.isLoading} error={run.error} onRetry={run.refetch}>
          {run.data && (
            <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
              <Descriptions size="small" column={3}>
                <Descriptions.Item label="회차">{run.data.runNo}</Descriptions.Item>
                <Descriptions.Item label="상태">
                  {label(RUN_STATUS, run.data.status)}
                </Descriptions.Item>
                <Descriptions.Item label="기준 시각">{run.data.basedOnAt}</Descriptions.Item>
              </Descriptions>
              {isDraft && blockers && !blockers.ready && (
                <Alert
                  type="warning"
                  showIcon
                  title="아직 확정할 수 없어요."
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {blockers.notEnded && <li>{BLOCKER_LABEL.notEnded}</li>}
                      {blockers.pendingDays > 0 && (
                        <li>
                          {BLOCKER_LABEL.pendingDays} ({blockers.pendingDays}건)
                        </li>
                      )}
                      {blockers.waitingSubmissions > 0 && (
                        <li>
                          {BLOCKER_LABEL.waitingSubmissions} ({blockers.waitingSubmissions}건)
                        </li>
                      )}
                      {blockers.incompleteParticipants > 0 && (
                        <li>
                          {BLOCKER_LABEL.incompleteParticipants} ({blockers.incompleteParticipants}
                          명)
                        </li>
                      )}
                    </ul>
                  }
                />
              )}
              <QueryState
                empty={run.data.entries.length === 0}
                emptyText="정산 대상 참가자가 없습니다."
              >
                <Table
                  rowKey="participationId"
                  columns={columns}
                  dataSource={run.data.entries}
                  pagination={false}
                  scroll={{ x: true }}
                />
              </QueryState>
            </Space>
          )}
        </QueryState>
      )}
    </Space>
  );
}
