import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

// ---- mutations ----
// The variables always carry `idempotencyKey`: ConfirmActionModal makes one key per user action
// and reuses it when the same action is tried again after a failure (docs/05 §5.2).

const refreshChallenges = (queryClient) =>
  queryClient.invalidateQueries({ queryKey: challengeKeys.all });

function useChallengeMutation(mutationFn, onSuccess) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, vars) =>
      onSuccess?.(queryClient, result, vars) ?? refreshChallenges(queryClient),
  });
}

/** M51. vars: `{body, idempotencyKey}` */
export const useCreateChallenge = () =>
  useChallengeMutation(({ body, idempotencyKey }) => api.createChallenge(body, idempotencyKey));

/** M52 field patch. vars: `{id, patch, idempotencyKey}` */
export const useUpdateChallenge = () =>
  useChallengeMutation(({ id, patch, idempotencyKey }) =>
    api.updateChallenge(id, patch, idempotencyKey),
  );

/** M52 publish / hide / cancel. vars: `{id, action, reason, idempotencyKey}` */
export const useChallengeAction = () =>
  useChallengeMutation(({ id, action, reason, idempotencyKey }) =>
    api.changeChallengeStatus(id, { action, reason }, idempotencyKey),
  );

/** M61. vars: `{id, participationId, action, dailyMissionId?, reason, idempotencyKey}` */
export const useModerate = () =>
  useChallengeMutation(
    ({ id, idempotencyKey, ...body }) => api.moderate(id, body, idempotencyKey),
    (queryClient, _result, vars) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: challengeKeys.rankings(vars.id) }),
        queryClient.invalidateQueries({ queryKey: ['challenges', 'days', vars.id] }),
      ]),
  );

/** M56. vars: `{id, reason, idempotencyKey}` */
export const useCreateSettlementRun = () =>
  useChallengeMutation(
    ({ id, reason, idempotencyKey }) => api.createSettlementRun(id, { reason }, idempotencyKey),
    (queryClient, run) => {
      queryClient.setQueryData(challengeKeys.run(run.id), run);
      return refreshChallenges(queryClient);
    },
  );

/** M58. vars: `{runId, reason, idempotencyKey}` */
export const useConfirmSettlementRun = () =>
  useChallengeMutation(({ runId, reason, idempotencyKey }) =>
    api.confirmSettlementRun(runId, { reason }, idempotencyKey),
  );

/** M59. vars: `{runId, reason, idempotencyKey}` */
export const useRetryPayments = () =>
  useChallengeMutation(({ runId, reason, idempotencyKey }) =>
    api.retrySettlementPayments(runId, { reason }, idempotencyKey),
  );
