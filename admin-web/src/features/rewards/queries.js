import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  member: (userId) => ['rewards', 'member', userId],
};

/**
 * Mutation for one change. `ConfirmActionModal` makes the Idempotency-Key, so it comes in with the
 * variables: `mutateAsync({payload, idempotencyKey})`. The menu's queries are invalidated on success.
 */
function useChange(fn, invalidate) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }) => fn(payload, idempotencyKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invalidate }),
  });
}

// ---- queries ----

/** 포인트 조정 대상 회원 확인. 회원 ID 형식이 맞을 때만 부른다. */
export const useMember = (userId) =>
  useQuery({
    queryKey: rewardKeys.member(userId),
    queryFn: () => api.fetchMember(userId),
    enabled: Boolean(userId),
    retry: false,
  });

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

export const useAdjustPoints = () => useChange(api.adjustPoints, ['rewards', 'transactions']);
export const useCreatePointCap = () => useChange(api.createPointCap, rewardKeys.caps);
export const useCreateRewardRate = () =>
  useChange(api.createRewardRate, ['rewards', 'reward-rates']);
export const useCreateStreakMilestone = () =>
  useChange(api.createStreakMilestone, rewardKeys.streaks);
export const useCreatePetLevels = () => useChange(api.createPetLevels, rewardKeys.petLevels);
export const useCreateAchievement = () => useChange(api.createAchievement, rewardKeys.achievements);
export const useCreateAchievementVersion = () =>
  useChange(api.createAchievementVersion, rewardKeys.achievements);
export const useCreatePetSpecies = () => useChange(api.createPetSpecies, rewardKeys.species);
export const useCreatePetSpeciesVersion = () =>
  useChange(api.createPetSpeciesVersion, rewardKeys.species);
