/**
 * 계획 재조정 훅 (A50~A53).
 */
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

import queryKeys from './keys.js';
import { infiniteListOptions, flattenItems } from '../http/cursor.js';
import { useAppMutation } from './mutation.js';
import * as adjustmentsApi from '../api/adjustmentsApi.js';
import { afterAdjustmentAccepted, afterAdjustmentRejected } from './invalidate.js';

/**
 * A50 재조정 제안 목록 (무한 스크롤).
 * @param {{status?: string|string[], goalId?: string}} [params]
 */
export function usePlanAdjustments(params = {}) {
  const query = useInfiniteQuery(infiniteListOptions({
    queryKey: queryKeys.adjustments(params),
    fetchPage: ({ cursor, limit }) => adjustmentsApi.listAdjustments({ ...params, cursor, limit }),
  }));
  return { ...query, items: flattenItems(query.data) };
}

/** A51 재조정 제안 상세 (`PlanAdjustment`) */
export function usePlanAdjustment(adjustmentId) {
  return useQuery({
    queryKey: queryKeys.adjustment(adjustmentId),
    queryFn: () => adjustmentsApi.getAdjustment(adjustmentId),
    enabled: Boolean(adjustmentId),
  });
}

/** A52 재조정 수락 (멱등). 입력 `{adjustmentId, plan?}` */
export function useAcceptAdjustment() {
  return useAppMutation({
    idempotent: true,
    mutationFn: adjustmentsApi.acceptAdjustment,
    onDone: afterAdjustmentAccepted,
  });
}

/** A53 재조정 거절. 입력 `{adjustmentId}` */
export function useRejectAdjustment() {
  return useAppMutation({
    mutationFn: adjustmentsApi.rejectAdjustment,
    onDone: afterAdjustmentRejected,
  });
}

export default { usePlanAdjustments, usePlanAdjustment, useAcceptAdjustment, useRejectAdjustment };
