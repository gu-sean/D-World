/**
 * 08 §13 알림·공지 (A110~A114).
 */
import { request } from '../http/httpClient.js';

/**
 * A110 알림함. 안 읽은 개수는 응답 헤더 `X-Unread-Count`로 온다.
 * @param {{cursor?: string, limit?: number, unreadOnly?: boolean}} query
 * @returns {Promise<{items: object[], nextCursor: string|null, unreadCount: number|null}>}
 */
export async function listNotifications(query) {
  const { data, headers } = await request({
    method: 'GET',
    path: '/me/notifications',
    query,
    withHeaders: true,
  });
  const raw = headers('X-Unread-Count');
  const unreadCount = raw === null ? null : Number(raw);
  return { ...data, unreadCount: Number.isFinite(unreadCount) ? unreadCount : null };
}

/**
 * A111 알림 하나 읽음.
 * @param {{notificationId: string}} input
 * @returns {Promise<null>}
 */
export function markNotificationRead({ notificationId }) {
  return request({ method: 'POST', path: `/me/notifications/${encodeURIComponent(notificationId)}/read` });
}

/**
 * A112 전부 읽음.
 * @returns {Promise<null>}
 */
export function markAllNotificationsRead() {
  return request({ method: 'POST', path: '/me/notifications/read-all' });
}

/**
 * A113 공지 목록.
 * @param {{cursor?: string, limit?: number}} query
 * @returns {Promise<{items: object[], nextCursor: string|null}>} `Page<Notice>`
 */
export function listNotices(query) {
  return request({ method: 'GET', path: '/notices', query });
}

/**
 * A114 공지 상세.
 * @param {string} noticeId
 * @returns {Promise<object>} `Notice`
 */
export function getNotice(noticeId) {
  return request({ method: 'GET', path: `/notices/${encodeURIComponent(noticeId)}` });
}

export default {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  listNotices,
  getNotice,
};
