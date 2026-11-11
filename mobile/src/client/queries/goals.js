/**
 * 목표·계획 훅 (A20~A28).
 */
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

import queryKeys from './keys.js';
import { infiniteListOptions, flattenItems } from '../http/cursor.js';
import { useAppMutation } from './mutation.js';
import * as goalsApi from '../api/goalsApi.js';
import { afterGoalChanged } from './invalidate.js';

/**
 * A21 목표 목록 (무한 스크롤).
 * @param {{status?: string|string[], categoryCode?: string}} [params]
 */
export function useGoals(params = {}) {
  const query = useInfiniteQuery(infiniteListOptions({
    queryKey: queryKeys.goals(params),
    fetchPage: ({ cursor, limit }) => goalsApi.listGoals({ ...params, cursor, limit }),
  }));
  return { ...query, items: flattenItems(query.data) };
}

/** A23 목표 상세 (`GoalDetail`) */
export function useGoal(goalId) {
  return useQuery({
    queryKey: queryKeys.goal(goalId),
    queryFn: () => goalsApi.getGoal(goalId),
    enabled: Boolean(goalId),
  });
}

/** A20 목표 등록 (멱등). 입력 `GoalInput` */
export function useCreateGoal() {
  return useAppMutation({
    idempotent: true,
    mutationFn: goalsApi.createGoal,
    onDone: afterGoalChanged,
  });
}

/** A22 목표 수정 (멱등). 입력 `{goalId, ...GoalInput의 부분, status?}` */
export function useUpdateGoal() {
  return useAppMutation({
    idempotent: true,
    mutationFn: goalsApi.updateGoal,
    onDone: afterGoalChanged,
  });
}

/** A24 목표 삭제 (멱등). 입력 `{goalId}` */
export function useDeleteGoal() {
  return useAppMutation({
    idempotent: true,
    mutationFn: goalsApi.deleteGoal,
    onDone: afterGoalChanged,
  });
}

/**
 * A25 AI 계획 제안 만들기 (멱등, 70초).
 * 입력 `{goalId}`. 실패 코드는 `AI_LLM_UNAVAILABLE`·`AI_TIMEOUT`·`AI_INVALID_OUTPUT`.
 */
export function useGeneratePlan() {
  return useAppMutation({
    idempotent: true,
    mutationFn: goalsApi.generatePlan,
    onDone: (queryClient, _data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.latestPlan(vars.goalId) });
    },
  });
}

/** A26 최신 계획 제안 (`PlanProposal`). 없으면 404다 — 화면이 "제안 없음"으로 본다. */
export function useLatestPlan(goalId) {
  return useQuery({
    queryKey: queryKeys.latestPlan(goalId),
    queryFn: () => goalsApi.getLatestPlan(goalId),
    enabled: Boolean(goalId),
    retry: false,
  });
}

/**
 * A27 계획 수락 (멱등). 입력 `{proposalId, generationNo, steps?}`
 * 성공하면 미션이 한꺼번에 생기므로 목표·미션·홈·리포트를 모두 다시 본다.
 */
export function useAcceptPlan() {
  return useAppMutation({
    idempotent: true,
    mutationFn: goalsApi.acceptPlan,
    onDone: afterGoalChanged,
  });
}

/**
 * A28 계획 거절. 입력 `{proposalId, reason?}`
 * `goalId`를 모르므로 계획 키 전체(`['goals','plan']`)를 다시 보게 한다.
 */
export function useRejectPlan() {
  return useAppMutation({
    mutationFn: goalsApi.rejectPlan,
    onDone: (queryClient) => {
      queryClient.invalidateQueries({ queryKey: ['goals', 'plan'] });
    },
  });
}

export default {
  useGoals,
  useGoal,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useGeneratePlan,
  useLatestPlan,
  useAcceptPlan,
  useRejectPlan,
};
