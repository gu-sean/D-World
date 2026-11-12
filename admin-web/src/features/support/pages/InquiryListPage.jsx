import { TicketList } from '../components/TicketList.jsx';

/** ADM-06 문의 목록 (M20, `ticketType=inquiry`). */
export default function InquiryListPage() {
  return <TicketList ticketType="inquiry" basePath="/support/inquiries" title="문의" />;
}
