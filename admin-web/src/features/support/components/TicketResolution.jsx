import { Descriptions } from 'antd';
import { DateText } from '../../../components/DateText.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';

const CONTENT_ACTION_TEXTS = { hidden: '숨김', deleted: '삭제' };

/** The recorded result of a completed ticket (`AdminTicketDetail.resolution`). */
export function TicketResolution({ resolution }) {
  const items = [
    {
      key: 'outcome',
      label: '처리 결과',
      children: <StatusTag kind="ticketResolutionOutcome" value={resolution.outcome} />,
    },
    { key: 'reply', label: '회원 답변', children: resolution.userReply ?? '-' },
    {
      key: 'content',
      label: '콘텐츠 조치',
      children: resolution.contentAction
        ? (CONTENT_ACTION_TEXTS[resolution.contentAction] ?? resolution.contentAction)
        : '-',
    },
    { key: 'account', label: '계정 조치', children: resolution.accountActionId ? '있음' : '-' },
    { key: 'at', label: '처리일', children: <DateText value={resolution.resolvedAt} /> },
  ];
  return <Descriptions bordered size="small" column={1} items={items} />;
}
