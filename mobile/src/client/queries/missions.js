/**
 * 미션 훅 (A30~A36).
 */
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

import queryKeys from './keys.js';
import { infiniteListOptions, flattenItems } from '../http/cursor.js';
import { useAppMutation } from './mutation.js';
import * as missionsApi from '../api/missionsApi.js';
import { afterMissionChanged } from './invalidate.js';

/**
 * A30 미션 목록 (무한 스크롤). 목록 한 쪽은 최대 50개다.
 * @param {{date?: string, from?: string, to?: string, status?: string|string[], goalId?: string, categoryCode?: string}} [params]
 */
export function useMissions(params = {}) {
  const query = useInfiniteQuery(
    infiniteListOptions({
      queryKey: queryKeys.missions(params),
      limit: 50,
      fetchPage: ({ cursor, limit }) => missionsApi.listMissions({ ...params, cursor, limit }),
    }),
  );
  return { ...query, items: flattenItems(query.data) };
}

/**
 * 미션 난이도·보상 미리 보기. 입력이 바뀔 때마다 다시 계산한다 (저장 안 함)
 * @param {{goalId?: string, categoryCode?: string, exerciseCode?: string, targetValue?: number,
 *   targetUnit?: string, estimatedDurationSeconds?: number}|null} input null이면 부르지 않음
 */
export function useDifficultyPreview(input) {
  return useQuery({
    queryKey: queryKeys.difficultyPreview(input),
    queryFn: () => missionsApi.previewDifficulty(input),
    enabled: Boolean(input),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

/** 목표의 빈 주. 미션이 바뀌면 missions 무효화로 함께 새로 고친다 */
export function useGoalGaps(goalId) {
  return useQuery({
    queryKey: queryKeys.goalGaps(goalId),
    queryFn: () => missionsApi.getGoalGaps(goalId),
    enabled: Boolean(goalId),
  });
}

/** 빈 주 채우기 (멱등). 입력 `{goalId, weekStarts?}` */
export function useFillGoalGaps() {
  return useAppMutation({
    idempotent: true,
    mutationFn: missionsApi.fillGoalGaps,
    onDone: afterMissionChanged,
  });
}

/** A32 미션 상세 (`MissionDetail`) */
export function useMission(missionId) {
  return useQuery({
    queryKey: queryKeys.mission(missionId),
    queryFn: () => missionsApi.getMission(missionId),
    enabled: Boolean(missionId),
  });
}

/** A31 미션 만들기 (멱등). 입력 `MissionInput` */
export function useCreateMission() {
  return useAppMutation({
    idempotent: true,
    mutationFn: missionsApi.createMission,
    onDone: afterMissionChanged,
  });
}

/** A33 미션 수정 (멱등). 입력 `{missionId, title?, description?, targetValue?, estimatedDurationSeconds?, scheduledDate?, memo?}` */
export function useUpdateMission() {
  return useAppMutation({
    idempotent: true,
    mutationFn: missionsApi.updateMission,
    onDone: afterMissionChanged,
  });
}

/** A34 미션 취소 (멱등). 입력 `{missionId}` */
export function useCancelMission() {
  return useAppMutation({
    idempotent: true,
    mutationFn: missionsApi.cancelMission,
    onDone: afterMissionChanged,
  });
}

/**
 * A35 미션 틀 목록 (무한 스크롤).
 * @param {{categoryCode?: string, difficultyCode?: string, exerciseCode?: string, sort?: 'recent'|'duration'}} [params]
 */
export function useMissionDefinitions(params = {}) {
  const query = useInfiniteQuery(
    infiniteListOptions({
      queryKey: queryKeys.missionDefinitions(params),
      fetchPage: ({ cursor, limit }) =>
        missionsApi.listMissionDefinitions({ ...params, cursor, limit }),
    }),
  );
  return { ...query, items: flattenItems(query.data) };
}

/**
 * A36 다음에 할 미션 추천.
 * @param {'ai'|'interest'|'all'} [tab]
 */
export function useNextMissions(tab = 'all') {
  return useQuery({
    queryKey: queryKeys.nextMissions(tab),
    queryFn: () => missionsApi.getNextMissions(tab),
  });
}

export default {
  useMissions,
  useMission,
  useCreateMission,
  useUpdateMission,
  useCancelMission,
  useMissionDefinitions,
  useNextMissions,
};
