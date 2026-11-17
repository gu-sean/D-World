import { TicketDetail } from '../components/TicketDetail.jsx';
import { t } from '../../../i18n/index.js';

/** ADM-12 신고 상세·조치 확정 (M21~M24). */
export default function AbuseTicketDetailPage() {
  return <TicketDetail ticketType="report" listPath="/support/abuse" title={t('신고 상세')} />;
}
