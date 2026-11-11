import { useRef } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { newIdempotencyKey } from '../../api/idempotency.js';
import * as api from './api.js';

export const challengeKeys = {
  all: ['challenges'],
  list: (params) => ['challenges', 'list', params],
  detail: (id) => ['challenges', 'detail', id],
  rankings: (id) => ['challenges', 'rankings', id],
  days: (id, participationId) => ['challenges', 'days', id, participationId],
  run: (runId) => ['challenges', 'settlement-run', runId],
  categories: ['challenges', 'categories'],
  difficulties: ['challenges', 'difficulties'],
};

/**
 * One Idempotency-Key per user action. The same payload sent again after a failure reuses the
 * key; a different payload, or a success, starts a new action.
 */
function useActionKey() {
  const last = useRef(null);
  return {
    keyFor(payload) {
      const fingerprint = JSON.stringify(payload);
      if (last.current?.fingerprint !== fingerprint) {
        last.current = { fingerprint, key: newIdempotencyKey() };
      }
      return last.current.key;
    },
    release() {
      last.current = null;
    },
  };
}

/** mutation whose function receives the action key as its second argument */
function useKeyedMutation(fn, onSuccess) {
  const queryClient = useQueryClient();
  const action = useActionKey();
  return useMutation({
    mutationFn: (vars) => fn(vars, action.keyFor(vars)),
    onSuccess: (result, vars) => {
      action.release();
      return onSuccess?.(queryClient, result, vars);
    },
  });
}

// ---- queries ----

export const useChallenges = (params) =>
  useQuery({
    queryKey: challengeKeys.list(params),
    queryFn: () => api.listChallenges(params),
    placeholderData: keepPreviousData,
  });

export const useChallenge = (id) =>
  useQuery({
    queryKey: challengeKeys.detail(id),
    queryFn: () => api.fetchChallenge(id),
    enabled: Boolean(id),
  });

export const useCategories = () =>
  useQuery({ queryKey: challengeKeys.categories, queryFn: api.fetchCategories });

export const useDifficultyLevels = () =>
  useQuery({ queryKey: challengeKeys.difficulties, queryFn: api.fetchDifficultyLevels });

export const useRankings = (id) =>
  useQuery({ queryKey: challengeKeys.rankings(id), queryFn: () => api.fetchRankings(id) });

export const useParticipantDays = (id, participationId) =>
  useQuery({
    queryKey: challengeKeys.days(id, participationId),
    queryFn: () => api.fetchParticipantDays(id, participationId),
    enabled: Boolean(participationId),
  });

export const useSettlementRun = (runId) =>
  useQuery({
    queryKey: challengeKeys.run(runId),
    queryFn: () => api.fetchSettlementRun(runId),
    enabled: Boolean(runId),
  });

// ---- mutations (vars are the arguments of the api function, as one object) ----

const refreshChallenges = (queryClient) =>
  queryClient.invalidateQueries({ queryKey: challengeKeys.all });

/** M51. vars: `{body}` */
export const useCreateChallenge = () =>
  useKeyedMutation(({ body }, key) => api.createChallenge(body, key), refreshChallenges);

/** M52 field patch. vars: `{id, patch}` */
export const useUpdateChallenge = () =>
  useKeyedMutation(({ id, patch }, key) => api.updateChallenge(id, patch, key), refreshChallenges);

/** M52 publish / hide / cancel. vars: `{id, action, reason}` */
export const useChallengeAction = () =>
  useKeyedMutation(
    ({ id, action, reason }, key) => api.changeChallengeStatus(id, { action, reason }, key),
    refreshChallenges,
  );

/** M55. vars: `{id, decision, reason}` */
export const useReviewChallenge = () =>
  useKeyedMutation(
    ({ id, decision, reason }, key) => api.reviewChallenge(id, { decision, reason }, key),
    refreshChallenges,
  );

/** M61. vars: `{id, participationId, action, dailyMissionId?, reason}` */
export const useModerate = () =>
  useKeyedMutation(
    ({ id, ...body }, key) => api.moderate(id, body, key),
    (queryClient, _r, vars) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: challengeKeys.rankings(vars.id) }),
        queryClient.invalidateQueries({ queryKey: ['challenges', 'days', vars.id] }),
      ]),
  );

/** M56. vars: `{id, reason}` */
export const useCreateSettlementRun = () =>
  useKeyedMutation(
    ({ id, reason }, key) => api.createSettlementRun(id, { reason }, key),
    (queryClient, run) => {
      queryClient.setQueryData(challengeKeys.run(run.id), run);
      return refreshChallenges(queryClient);
    },
  );

/** M58. vars: `{runId, reason}` */
export const useConfirmSettlementRun = () =>
  useKeyedMutation(
    ({ runId, reason }, key) => api.confirmSettlementRun(runId, { reason }, key),
    refreshChallenges,
  );

/** M59. vars: `{runId, reason}` */
export const useRetryPayments = () =>
  useKeyedMutation(
    ({ runId, reason }, key) => api.retrySettlementPayments(runId, { reason }, key),
    refreshChallenges,
  );
