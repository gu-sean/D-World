import { TicketList } from '../components/TicketList.jsx';
import { t } from '../../../i18n/index.js';

/** ADM-06 문의 목록 (M20, `ticketType=inquiry`). */
export default function InquiryListPage() {
  return <TicketList ticketType="inquiry" basePath="/support/inquiries" title={t('문의')} />;
}
