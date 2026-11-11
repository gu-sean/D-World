import { TicketList } from '../components/TicketList.jsx';

/** ADM-11 신고 목록 (M20, `ticketType=report`). */
export default function AbuseTicketListPage() {
  return <TicketList ticketType="report" basePath="/support/abuse" title="신고" />;
}
