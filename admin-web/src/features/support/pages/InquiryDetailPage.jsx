import { TicketDetail } from '../components/TicketDetail.jsx';

/** ADM-06 문의 상세·답변 (M21~M24). */
export default function InquiryDetailPage() {
  return <TicketDetail ticketType="inquiry" listPath="/support/inquiries" title="문의 상세" />;
}
