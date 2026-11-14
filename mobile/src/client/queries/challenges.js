/**
 * 챌린지 훅 (A100~A107).
 */
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

import queryKeys from './keys.js';
import { infiniteListOptions, flattenItems } from '../http/cursor.js';
import { useAppMutation } from './mutation.js';
import * as challengesApi from '../api/challengesApi.js';
import { afterChallengeParticipationChanged } from './invalidate.js';

/**
 * A100 챌린지 목록 (무한 스크롤).
 * @param {{phase?: 'recruiting'|'ongoing'|'ended', categoryCode?: string, closingSoon?: boolean}} [params]
 */
export function useChallenges(params = {}) {
  const query = useInfiniteQuery(infiniteListOptions({
    queryKey: queryKeys.challenges(params),
    fetchPage: ({ cursor, limit }) => challengesApi.listChallenges({ ...params, cursor, limit }),
  }));
  return { ...query, items: flattenItems(query.data) };
}

/** A101 챌린지 상세 (`Challenge`) */
export function useChallenge(challengeId) {
  return useQuery({
    queryKey: queryKeys.challenge(challengeId),
    queryFn: () => challengesApi.getChallenge(challengeId),
    enabled: Boolean(challengeId),
  });
}

/** A102 참여 신청 (멱등). 입력 `{challengeId}` */
export function useJoinChallenge() {
  return useAppMutation({
    idempotent: true,
    mutationFn: challengesApi.joinChallenge,
    onDone: afterChallengeParticipationChanged,
  });
}

/** A103 중도 포기 (멱등). 입력 `{challengeId}` */
export function useLeaveChallenge() {
  return useAppMutation({
    idempotent: true,
    mutationFn: challengesApi.leaveChallenge,
    onDone: afterChallengeParticipationChanged,
  });
}


/**
 * A104 내 챌린지 (`MyChallenge[]`).
 * @param {'enrolled'|'completed'|'failed'|'withdrawn'} [status]
 */
export function useMyChallenges(status) {
  return useQuery({
    queryKey: queryKeys.myChallenges(status),
    queryFn: () => challengesApi.getMyChallenges({ status }),
  });
}

/** A105 순위 (`ChallengeRanking`) */
export function useChallengeRanking(challengeId) {
  return useQuery({
    queryKey: queryKeys.challengeRanking(challengeId),
    queryFn: () => challengesApi.getChallengeRanking(challengeId),
    enabled: Boolean(challengeId),
  });
}

/** A107 내 챌린지 결과 (`ChallengeResult`) */
export function useChallengeResult(challengeId) {
  return useQuery({
    queryKey: queryKeys.challengeResult(challengeId),
    queryFn: () => challengesApi.getChallengeResult(challengeId),
    enabled: Boolean(challengeId),
  });
}

export default {
  useChallenges,
  useChallenge,
  useJoinChallenge,
  useLeaveChallenge,
  useMyChallenges,
  useChallengeRanking,
  useChallengeResult,
};
