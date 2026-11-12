// ADM-20 챌린지 정산과 보상
import { useState } from 'react';
import { Alert, Button, Descriptions, message, Space, Typography } from 'antd';
import { useParams, useSearchParams } from 'react-router';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { StatePanel } from '../../../components/StatePanel.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { SettlementPreviewTable } from '../components/SettlementPreviewTable.jsx';
import { BLOCKER_LABEL, label, RUN_STATUS } from '../labels.js';
import {
  useChallenge,
  useConfirmSettlementRun,
  useCreateSettlementRun,
  useRetryPayments,
  useSettlementRun,
} from '../queries.js';

export default function ChallengeSettlementPage() {
  const { challengeId } = useParams();
  // The run id is not part of the challenge view, so it travels in the URL (?run=...).
  const [searchParams, setSearchParams] = useSearchParams();
  const runId = searchParams.get('run');
  const challenge = useChallenge(challengeId);
  const run = useSettlementRun(runId);
  const createRun = useCreateSettlementRun();
  const confirmRun = useConfirmSettlementRun();
  const retry = useRetryPayments();
  const [action, setAction] = useState(null); // 'create' | 'confirm' | 'retry'

  const blockers = run.data?.blockers;
  const isDraft = run.data?.status === 'draft';
  const hasFailedPayments = run.data?.entries.some((entry) => entry.paymentStatus === 'failed');
  const corrected = challenge.data?.settlementStatus === 'confirmed';

  const TITLES = {
    create: corrected ? '정정 정산 초안 만들기' : '정산 초안 만들기',
    confirm: '정산 확정',
    retry: '실패한 지급 다시 시도',
  };
  const SUMMARIES = {
    create: '기존 초안이 있으면 새 초안으로 대체돼요.',
    confirm: '확정하면 완주자에게 보상이 지급돼요. 되돌릴 수 없어요.',
    retry: '지급에 실패한 건만 다시 처리해요.',
  };

  const submit = async ({ reason, idempotencyKey }) => {
    if (action === 'create') {
      const created = await createRun.mutateAsync({ id: challengeId, reason, idempotencyKey });
      setSearchParams({ run: created.id });
    } else if (action === 'confirm') {
      await confirmRun.mutateAsync({ runId, reason, idempotencyKey });
      await run.refetch();
    } else {
      await retry.mutateAsync({ runId, reason, idempotencyKey });
      await run.refetch();
    }
    message.success('처리했어요');
    setAction(null);
  };

  return (
    <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        챌린지 정산과 보상
      </Typography.Title>
      <QueryBoundary query={challenge}>
        {(data) => (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="챌린지">{data.title}</Descriptions.Item>
            <Descriptions.Item label="기간">
              {data.startDate} ~ {data.endDate}
            </Descriptions.Item>
            <Descriptions.Item label="정산 상태">
              <StatusTag kind="challengeSettlementStatus" value={data.settlementStatus} />
            </Descriptions.Item>
            <Descriptions.Item label="참가자">{data.participantCount}</Descriptions.Item>
          </Descriptions>
        )}
      </QueryBoundary>

      <Space>
        <Button type="primary" onClick={() => setAction('create')}>
          {TITLES.create}
        </Button>
        {isDraft && (
          <Button
            danger
            onClick={() => setAction('confirm')}
            disabled={blockers ? !blockers.ready : false}
          >
            정산 확정
          </Button>
        )}
        {hasFailedPayments && (
          <Button onClick={() => setAction('retry')}>지급 실패 다시 시도</Button>
        )}
      </Space>

      {!runId && <Alert type="info" showIcon title="정산 초안을 만들면 결과가 여기에 표시돼요." />}

      {runId && (
        <QueryBoundary query={run}>
          {(data) => (
            <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
              <Descriptions size="small" column={3}>
                <Descriptions.Item label="회차">{data.runNo}</Descriptions.Item>
                <Descriptions.Item label="상태">{label(RUN_STATUS, data.status)}</Descriptions.Item>
                <Descriptions.Item label="기준 시각">
                  <DateText value={data.basedOnAt} />
                </Descriptions.Item>
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
              {data.entries.length === 0 ? (
                <StatePanel type="empty" message="정산 대상 참가자가 없어요." />
              ) : (
                <SettlementPreviewTable entries={data.entries} />
              )}
            </Space>
          )}
        </QueryBoundary>
      )}

      <ConfirmActionModal
        open={Boolean(action)}
        title={action ? TITLES[action] : ''}
        summary={action ? SUMMARIES[action] : ''}
        danger={action === 'confirm'}
        onSubmit={submit}
        onCancel={() => setAction(null)}
      />
    </Space>
  );
}
