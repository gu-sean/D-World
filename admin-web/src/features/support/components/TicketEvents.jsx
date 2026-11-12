import { Tag } from 'antd';
import { DateText } from '../../../components/DateText.jsx';

// `AdminTicketDetail.events[].eventType` (docs/07). The docs give the values, not the texts.
const EVENT_TEXTS = {
  received: '접수',
  assigned: '담당 지정',
  status_changed: '상태 변경',
  reply: '답변',
  note: '메모',
};

/**
 * The history of a ticket, oldest first. A `reply` is seen by the user (`visibility: 'user'`),
 * the rest is internal.
 * @param {{events: object[]}} props
 */
export function TicketEvents({ events }) {
  return (
    <ul data-testid="ticket-events" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {events.map((entry) => (
        <li key={entry.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <DateText value={entry.createdAt} />
            <Tag>{EVENT_TEXTS[entry.eventType] ?? entry.eventType}</Tag>
            <Tag color={entry.visibility === 'user' ? 'blue' : 'default'}>
              {entry.visibility === 'user' ? '회원에게 보임' : '내부 기록'}
            </Tag>
            <span>{entry.adminLoginId ?? '-'}</span>
          </div>
          {entry.body && <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{entry.body}</div>}
        </li>
      ))}
    </ul>
  );
}
