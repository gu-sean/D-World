import { TicketDetail } from '../components/TicketDetail.jsx';
import { t } from '../../../i18n/index.js';

/** ADM-06 문의 상세·답변 (M21~M24). */
export default function InquiryDetailPage() {
  return <TicketDetail ticketType="inquiry" listPath="/support/inquiries" title={t('문의 상세')} />;
}
