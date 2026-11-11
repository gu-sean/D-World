import { randomUUID } from 'node:crypto';

/**
 * 회원에게 시스템 알림 한 건 (알림함에 쌓이고, 알림을 켠 회원은 푸시 대기)
 * 같은 eventKey는 한 번만 만든다(재시도·재전송에 안전). linkScreen은 소문자 경로(예: reports/ai/{id})
 */
export async function createSystemNotification(
  tx,
  { userId, eventKey, title, body, linkScreen = null },
) {
  await tx.query(
    `INSERT INTO user_notifications
       (id, user_id, kind, event_key, title, body, link_screen, push_status)
     SELECT $1, $2, 'system', $3, $4, $5, $6,
            CASE WHEN COALESCE(p.notification_enabled, false)
                 THEN 'pending' ELSE 'none' END
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $2
     ON CONFLICT (user_id, event_key) DO NOTHING`,
    [randomUUID(), userId, eventKey, title, body, linkScreen],
  );
}
