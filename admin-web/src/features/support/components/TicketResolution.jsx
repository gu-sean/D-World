import { Descriptions } from 'antd';
import { DateText } from '../../../components/DateText.jsx';
import { StatusTag } from '../../../components/StatusTag.jsx';
import { t } from '../../../i18n/index.js';

const CONTENT_ACTION_TEXTS = { hidden: t('숨김'), deleted: t('삭제') };

/** The recorded result of a completed ticket (`AdminTicketDetail.resolution`). */
export function TicketResolution({ resolution }) {
  const items = [
    {
      key: 'outcome',
      label: t('처리 결과'),
      children: <StatusTag kind="ticketResolutionOutcome" value={resolution.outcome} />,
    },
    { key: 'reply', label: t('회원 답변'), children: resolution.userReply ?? '-' },
    {
      key: 'content',
      label: t('콘텐츠 조치'),
      children: resolution.contentAction
        ? (CONTENT_ACTION_TEXTS[resolution.contentAction] ?? resolution.contentAction)
        : '-',
    },
    {
      key: 'account',
      label: t('계정 조치'),
      children: resolution.accountActionId ? t('있음') : '-',
    },
    { key: 'at', label: t('처리일'), children: <DateText value={resolution.resolvedAt} /> },
  ];
  return <Descriptions bordered size="small" column={1} items={items} />;
}
