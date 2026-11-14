import { Navigate } from 'react-router';

/**
 * ADM-33 푸시 알림: 공지와 같은 데이터라 "공지·푸시" 한 화면으로 합쳤다.
 * 예전 주소로 들어오면 푸시 필터를 켠 공지 목록으로 보낸다. 푸시는 공지 만들기의 "푸시 알림 발송"으로 켠다.
 */
export default function PushNotificationPage() {
  return <Navigate to="/content/notices?sendPush=true" replace />;
}
