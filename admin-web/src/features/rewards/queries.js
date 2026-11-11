import { useRef } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { newIdempotencyKey } from '../../api/idempotency.js';
import * as api from './api.js';

export const rewardKeys = {
  transactions: (params) => ['rewards', 'transactions', params],
  caps: ['rewards', 'point-caps'],
  rates: (params) => ['rewards', 'reward-rates', params],
  categories: ['rewards', 'categories'],
  difficulties: ['rewards', 'difficulties'],
  streaks: ['rewards', 'streak-milestones'],
  petLevels: ['rewards', 'pet-levels'],
  achievements: ['rewards', 'achievements'],
  species: ['rewards', 'pet-species'],
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
function useKeyedMutation(fn, invalidate) {
  const queryClient = useQueryClient();
  const action = useActionKey();
  return useMutation({
    mutationFn: (vars) => fn(vars, action.keyFor(vars)),
    onSuccess: () => {
      action.release();
      return invalidate ? queryClient.invalidateQueries({ queryKey: invalidate }) : undefined;
    },
  });
}

// ---- queries ----

export const usePointTransactions = (params) =>
  useQuery({
    queryKey: rewardKeys.transactions(params),
    queryFn: () => api.listPointTransactions(params),
    placeholderData: keepPreviousData,
  });

export const usePointCaps = () =>
  useQuery({ queryKey: rewardKeys.caps, queryFn: api.listPointCaps });

export const useRewardRates = (params) =>
  useQuery({ queryKey: rewardKeys.rates(params), queryFn: () => api.listRewardRates(params) });

export const useCategories = () =>
  useQuery({ queryKey: rewardKeys.categories, queryFn: api.fetchCategories });

export const useDifficultyLevels = () =>
  useQuery({ queryKey: rewardKeys.difficulties, queryFn: api.fetchDifficultyLevels });

export const useStreakMilestones = () =>
  useQuery({ queryKey: rewardKeys.streaks, queryFn: api.listStreakMilestones });

export const usePetLevels = () =>
  useQuery({ queryKey: rewardKeys.petLevels, queryFn: api.listPetLevels });

export const useAchievements = () =>
  useQuery({ queryKey: rewardKeys.achievements, queryFn: api.listAchievements });

export const usePetSpecies = () =>
  useQuery({ queryKey: rewardKeys.species, queryFn: api.listPetSpecies });

// ---- mutations ----

export const useAdjustPoints = () =>
  useKeyedMutation(api.adjustPoints, ['rewards', 'transactions']);
export const useCreatePointCap = () => useKeyedMutation(api.createPointCap, rewardKeys.caps);
export const useCreateRewardRate = () =>
  useKeyedMutation(api.createRewardRate, ['rewards', 'reward-rates']);
export const useCreateStreakMilestone = () =>
  useKeyedMutation(api.createStreakMilestone, rewardKeys.streaks);
export const useCreatePetLevels = () => useKeyedMutation(api.createPetLevels, rewardKeys.petLevels);
export const useCreateAchievement = () =>
  useKeyedMutation(api.createAchievement, rewardKeys.achievements);
export const useCreateAchievementVersion = () =>
  useKeyedMutation(api.createAchievementVersion, rewardKeys.achievements);
export const useCreatePetSpecies = () => useKeyedMutation(api.createPetSpecies, rewardKeys.species);
export const useCreatePetSpeciesVersion = () =>
  useKeyedMutation(api.createPetSpeciesVersion, rewardKeys.species);
