import { NoticeManager } from '../components/NoticeManager.jsx';

/** ADM-33 푸시 알림: a notice made with `sendPush = true` (M90~M94) */
export default function PushNotificationPage() {
  return <NoticeManager title="푸시 알림" pushMode />;
}
