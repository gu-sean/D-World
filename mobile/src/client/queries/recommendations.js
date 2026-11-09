/**
 * 상황 추천 훅 (A90~A93).
 *
 * **좌표는 요청 한 번에만 쓰고 어디에도 남기지 않는다** (tasks/mobile-client MC-10).
 * 위치 권한이 없거나 못 잡으면 좌표 없이 보낸다 — 서버가 날씨 없이 추천한다.
 */
import { useQuery } from '@tanstack/react-query';

import queryKeys from './keys.js';
import { useAppMutation } from './mutation.js';
import * as recommendationsApi from '../api/recommendationsApi.js';
import { getCurrentPosition, QUICK_FIX_TIMEOUT_MS } from '../device/location.js';
import { check as checkPermission } from '../device/permissions.js';
import { afterRecommendationDecided } from './invalidate.js';

/**
 * A90 상황 추천 받기 (멱등).
 *
 * 입력 `{kind, useLocation?, isMoving?}`.
 * `useLocation`이면 5초 안에 현재 위치를 구해 함께 보낸다.
 */
export function useSituationalRecommendations() {
  return useAppMutation({
    idempotent: true,
    mutationFn: async ({ kind, useLocation = false, isMoving, idempotencyKey }) => {
      let latitude;
      let longitude;

      if (useLocation && (await checkPermission('location')) === 'granted') {
        try {
          const point = await getCurrentPosition({ timeoutMs: QUICK_FIX_TIMEOUT_MS });
          latitude = point.lat;
          longitude = point.lng;
        } catch {
          // 위치를 못 잡아도 추천은 받는다 (좌표 없이).
        }
      }

      return recommendationsApi.requestSituational({
        kind,
        isMoving,
        latitude,
        longitude,
        idempotencyKey,
      });
    },
    onDone: (queryClient) => afterRecommendationDecided(queryClient),
  });
}

/** A91 추천 수락 (멱등). 입력 `{recommendationId}` → 오늘 미션이 생긴다 */
export function useAcceptRecommendation() {
  return useAppMutation({
    idempotent: true,
    mutationFn: recommendationsApi.acceptRecommendation,
    onDone: (queryClient) => afterRecommendationDecided(queryClient, { missionCreated: true }),
  });
}

/** A92 추천 거절. 입력 `{recommendationId}` */
export function useDismissRecommendation() {
  return useAppMutation({
    mutationFn: recommendationsApi.dismissRecommendation,
    onDone: (queryClient) => afterRecommendationDecided(queryClient),
  });
}

/** A93 아직 살아 있는 추천 (`MissionRecommendation[]`) */
export function useActiveRecommendations() {
  return useQuery({
    queryKey: queryKeys.activeRecommendations,
    queryFn: recommendationsApi.getActiveRecommendations,
  });
}

export default {
  useSituationalRecommendations,
  useAcceptRecommendation,
  useDismissRecommendation,
  useActiveRecommendations,
};
