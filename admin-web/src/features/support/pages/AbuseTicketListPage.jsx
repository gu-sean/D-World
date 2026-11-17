import { TicketList } from '../components/TicketList.jsx';
import { t } from '../../../i18n/index.js';

/** ADM-11 신고 목록 (M20, `ticketType=report`). */
export default function AbuseTicketListPage() {
  return <TicketList ticketType="report" basePath="/support/abuse" title={t('신고')} />;
}
