import { useState } from 'react';
import { Button, Card, Descriptions, message, Typography } from 'antd';
import { Link, useParams } from 'react-router';
import { ConfirmActionModal } from '../../../components/ConfirmActionModal.jsx';
import { DateText } from '../../../components/DateText.jsx';
import { QueryBoundary } from '../../../components/QueryBoundary.jsx';
import { StatePanel } from '../../../components/StatePanel.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { labels } from '../../../constants/labels.js';
import { useAssignTicket, useTicket } from '../queries.js';
import { ReplyForm } from './ReplyForm.jsx';
import { ResolutionForm } from './ResolutionForm.jsx';
import { TicketEvents } from './TicketEvents.jsx';
import { TicketResolution } from './TicketResolution.jsx';

const sectionTitle = (text) => (
  <Typography.Title level={5} style={{ margin: '24px 0 12px' }}>
    {text}
  </Typography.Title>
);

// A report of a user links to that user (a URL, not an import of the users feature).
function TargetText({ ticket }) {
  if (!ticket.targetKind) return '-';
  const kind = labels.ticketTargetKind[ticket.targetKind]?.text ?? ticket.targetKind;
  const summary = ticket.targetSummary ?? '-';
  if (ticket.targetKind === 'user' && ticket.targetId) {
    return (
      <>
        {kind} · <Link to={`/users/${ticket.targetId}`}>{summary}</Link>
      </>
    );
  }
  return `${kind} · ${summary}`;
}

function TicketBody({ ticket, listPath }) {
  const assign = useAssignTicket();
  // One confirm dialog for every change of the page: {title, summary, danger, submit}.
  const [confirm, setConfirm] = useState(null);
  const isCompleted = ticket.status === 'completed';

  const items = [
    {
      key: 'type',
      label: '유형',
      children: <StatusTag kind="ticketType" value={ticket.ticketType} />,
    },
    {
      key: 'status',
      label: '상태',
      children: <StatusTag kind="ticketStatus" value={ticket.status} />,
    },
    { key: 'category', label: '분류', children: ticket.category },
    { key: 'subject', label: '제목', children: ticket.subject },
    { key: 'reporter', label: '접수자', children: ticket.reporterNickname ?? '-' },
    { key: 'assigned', label: '담당', children: ticket.assignedAdminLoginId ?? '-' },
    ...(ticket.ticketType === 'report'
      ? [
          { key: 'target', label: '대상', children: <TargetText ticket={ticket} /> },
          { key: 'same', label: '중복 신고', children: `${ticket.sameTargetOpenCount}건` },
        ]
      : []),
    { key: 'received', label: '접수일', children: <DateText value={ticket.receivedAt} /> },
  ];

  const handleAssign = () =>
    setConfirm({
      title: '담당 지정',
      summary: `${ticket.subject} · 나에게 지정해요.`,
      submit: ({ reason, idempotencyKey }) =>
        assign.mutateAsync({
          ticketId: ticket.id,
          body: { adminId: null, reason },
          idempotencyKey,
        }),
    });

  return (
    <>
      <Link to={listPath}>목록으로</Link>
      <Descriptions bordered size="small" column={2} items={items} style={{ marginTop: 12 }} />
      {sectionTitle('내용')}
      <Card size="small">
        <div style={{ whiteSpace: 'pre-wrap' }}>{ticket.body}</div>
      </Card>
      {sectionTitle('진행 기록')}
      <TicketEvents events={ticket.events} />
      <div style={{ marginTop: 16 }}>
        <Button disabled={isCompleted} onClick={handleAssign}>
          나에게 지정
        </Button>
      </div>
      {sectionTitle('답변·메모')}
      <ReplyForm ticketId={ticket.id} onConfirm={setConfirm} />
      {sectionTitle('처리')}
      {ticket.resolution ? (
        <TicketResolution resolution={ticket.resolution} />
      ) : (
        <ResolutionForm ticket={ticket} onConfirm={setConfirm} />
      )}
      <ConfirmActionModal
        open={confirm !== null}
        title={confirm?.title ?? ''}
        summary={confirm?.summary}
        danger={confirm?.danger}
        onSubmit={async (input) => {
          await confirm.submit(input);
          message.success('처리했어요');
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

/**
 * Detail of a ticket for ADM-06 (inquiry) and ADM-12 (report): data (M21), assign (M22), reply
 * or note (M23) and resolution (M24). A ticket of the other type shows "not found".
 * @param {object} props
 * @param {'inquiry'|'report'} props.ticketType
 * @param {string} props.listPath
 * @param {string} props.title
 */
export function TicketDetail({ ticketType, listPath, title }) {
  const { ticketId } = useParams();
  const query = useTicket(ticketId);

  return (
    <>
      <Typography.Title level={3}>{title}</Typography.Title>
      <QueryBoundary query={query}>
        {(ticket) =>
          ticket.ticketType === ticketType ? (
            <TicketBody ticket={ticket} listPath={listPath} />
          ) : (
            <StatePanel type="notFound" />
          )
        }
      </QueryBoundary>
    </>
  );
}
