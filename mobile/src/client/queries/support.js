/**
 * 문의·신고·구독 훅 (A120~A122, A130).
 */
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

import queryKeys from './keys.js';
import { infiniteListOptions, flattenItems } from '../http/cursor.js';
import { useAppMutation } from './mutation.js';
import * as supportApi from '../api/supportApi.js';
import { getSubscription } from '../api/subscriptionApi.js';
import { afterSupportTicketChanged } from './invalidate.js';

/** A120 문의·신고 등록 (멱등). 입력 `SupportTicketInput` */
export function useCreateSupportTicket() {
  return useAppMutation({
    idempotent: true,
    mutationFn: supportApi.createSupportTicket,
    onDone: afterSupportTicketChanged,
  });
}

/** A121 내 문의 목록 (무한 스크롤) */
export function useMySupportTickets(params = {}) {
  const query = useInfiniteQuery(infiniteListOptions({
    queryKey: queryKeys.supportTickets(params),
    fetchPage: ({ cursor, limit }) => supportApi.listMySupportTickets({ ...params, cursor, limit }),
  }));
  return { ...query, items: flattenItems(query.data) };
}

/** A122 문의 상세 (`SupportTicket`) */
export function useSupportTicket(ticketId) {
  return useQuery({
    queryKey: queryKeys.supportTicket(ticketId),
    queryFn: () => supportApi.getSupportTicket(ticketId),
    enabled: Boolean(ticketId),
  });
}

/**
 * A130 구독. 지금은 항상 `COMMON_NOT_IMPLEMENTED`로 실패한다 —
 * 화면은 `error.code`를 보고 "준비 중"을 보여 준다. 다시 시도하지 않는다.
 */
export function useSubscription() {
  return useQuery({
    queryKey: queryKeys.subscription,
    queryFn: getSubscription,
    retry: false,
    staleTime: Infinity,
  });
}

export default { useCreateSupportTicket, useMySupportTickets, useSupportTicket, useSubscription };
