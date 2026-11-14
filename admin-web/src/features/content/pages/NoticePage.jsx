import { NoticeManager } from '../components/NoticeManager.jsx';

/** ADM-32·33 공지·푸시 (M90~M94): 푸시는 공지의 "푸시 알림 발송"으로 보내고 목록의 푸시 필터로 거른다 */
export default function NoticePage() {
  return <NoticeManager title="공지·푸시" />;
}
