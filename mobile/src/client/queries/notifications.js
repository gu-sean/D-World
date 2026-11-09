/**
 * 알림·공지 훅 (A110~A114).
 */
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

import queryKeys from './keys.js';
import { infiniteListOptions, flattenItems } from '../http/cursor.js';
import { useAppMutation } from './mutation.js';
import * as notificationsApi from '../api/notificationsApi.js';
import { afterNotificationRead } from './invalidate.js';

/**
 * A110 알림함 (무한 스크롤).
 * 안 읽은 개수(`X-Unread-Count`)는 첫 쪽에서 가져와 `unreadCount`로 함께 돌려준다.
 * @param {{unreadOnly?: boolean}} [params]
 */
export function useNotifications(params = {}) {
  const query = useInfiniteQuery(infiniteListOptions({
    queryKey: queryKeys.notifications(params),
    fetchPage: ({ cursor, limit }) => notificationsApi.listNotifications({ ...params, cursor, limit }),
  }));
  return {
    ...query,
    items: flattenItems(query.data),
    unreadCount: query.data?.pages?.[0]?.unreadCount ?? null,
  };
}

/** A111 알림 하나 읽음. 입력 `{notificationId}` */
export function useMarkNotificationRead() {
  return useAppMutation({
    mutationFn: notificationsApi.markNotificationRead,
    onDone: afterNotificationRead,
  });
}

/** A112 전부 읽음 */
export function useMarkAllNotificationsRead() {
  return useAppMutation({
    mutationFn: notificationsApi.markAllNotificationsRead,
    onDone: afterNotificationRead,
  });
}

/** A113 공지 목록 (무한 스크롤) */
export function useNotices(params = {}) {
  const query = useInfiniteQuery(infiniteListOptions({
    queryKey: queryKeys.notices(params),
    fetchPage: ({ cursor, limit }) => notificationsApi.listNotices({ ...params, cursor, limit }),
  }));
  return { ...query, items: flattenItems(query.data) };
}

/** A114 공지 상세 (`Notice`) */
export function useNotice(noticeId) {
  return useQuery({
    queryKey: queryKeys.notice(noticeId),
    queryFn: () => notificationsApi.getNotice(noticeId),
    enabled: Boolean(noticeId),
  });
}

export default {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useNotices,
  useNotice,
};
