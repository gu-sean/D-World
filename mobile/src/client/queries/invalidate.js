/**
 * 변경이 성공한 뒤 다시 불러올 쿼리 (parts/mobile-client §5.2 표).
 *
 * 각 함수는 §5.2 표의 한 줄이다. 표에 없는 조합을 쓰고 싶으면 표를 먼저 고친다.
 * (한 곳에만 적어 두어야 "미션을 고쳤는데 홈이 안 바뀐다" 같은 일이 안 생긴다.)
 */
import { domains } from './keys.js';

/** 도메인 앞조각들을 한꺼번에 무효화한다. */
function invalidateAll(queryClient, prefixes) {
  if (!queryClient) return;
  for (const prefix of prefixes) {
    queryClient.invalidateQueries({ queryKey: prefix });
  }
}

/** 목표 생성·수정·삭제, 계획 수락 */
export function afterGoalChanged(queryClient) {
  invalidateAll(queryClient, [domains.goals, domains.missions, domains.home, domains.reports]);
}

/** 미션 생성·수정·취소 */
export function afterMissionChanged(queryClient) {
  invalidateAll(queryClient, [domains.missions, domains.home, domains.goals]);
}

/**
 * 판정 결과가 `approved`·`rejected`로 정해졌을 때.
 * 보상·스트릭·펫·업적·챌린지 점수가 한꺼번에 움직이므로 범위가 넓다.
 */
export function afterVerificationDecided(queryClient) {
  invalidateAll(queryClient, [
    domains.missions,
    domains.home,
    domains.goals,
    domains.points,
    domains.streak,
    domains.pets,
    domains.achievements,
    domains.reports,
    domains.challenges,
    domains.notifications,
  ]);
}

/** 재조정 수락 */
export function afterAdjustmentAccepted(queryClient) {
  invalidateAll(queryClient, [domains.goals, domains.missions, domains.home, domains.adjustments]);
}

/** 상점 주문 */
export function afterShopOrder(queryClient) {
  invalidateAll(queryClient, [domains.points, domains.shop, domains.inventory]);
}

/** 펫 부화·대표 변경 */
export function afterPetChanged(queryClient) {
  invalidateAll(queryClient, [domains.pets, domains.me, domains.home]);
}

/** 챌린지 참여·포기 */
export function afterChallengeParticipationChanged(queryClient) {
  invalidateAll(queryClient, [domains.challenges, domains.missions, domains.home]);
}

/** 알림 읽음 */
export function afterNotificationRead(queryClient) {
  invalidateAll(queryClient, [domains.notifications]);
}

/** 재조정 거절 — 목록만 다시 본다 (표에는 없지만 같은 도메인 안이다). */
export function afterAdjustmentRejected(queryClient) {
  invalidateAll(queryClient, [domains.adjustments]);
}

/** 상황 추천 수락·거절 — 추천 목록과, 수락이면 오늘 미션이 는다. */
export function afterRecommendationDecided(queryClient, { missionCreated = false } = {}) {
  const prefixes = [domains.recommendations];
  if (missionCreated) prefixes.push(domains.missions, domains.home);
  invalidateAll(queryClient, prefixes);
}

/** 내 정보 변경 (프로필 수정·약관 재동의·대표 배지) */
export function afterProfileChanged(queryClient) {
  invalidateAll(queryClient, [domains.me, domains.home]);
}

/** 업적 대표 배지 변경 */
export function afterBadgeChanged(queryClient) {
  invalidateAll(queryClient, [domains.achievements, domains.me]);
}

/** 문의·신고 등록 */
export function afterSupportTicketChanged(queryClient) {
  invalidateAll(queryClient, [domains.support]);
}

export default {
  afterGoalChanged,
  afterMissionChanged,
  afterVerificationDecided,
  afterAdjustmentAccepted,
  afterAdjustmentRejected,
  afterShopOrder,
  afterPetChanged,
  afterChallengeParticipationChanged,
  afterNotificationRead,
  afterRecommendationDecided,
  afterProfileChanged,
  afterBadgeChanged,
  afterSupportTicketChanged,
};
