/**
 * 챌린지·상황 추천 가짜 응답 (A90~A107). 07 §13·§14 모양.
 */
import { dayOffset } from './goals.js';
import { missionDefinition, rewardPreview } from './missions.js';

/** A100·A101 `Challenge` */
export function challenge(overrides = {}, nowMs = Date.now()) {
  return {
    id: 'challenge-0001',
    origin: 'admin',
    title: '2주 스쿼트 챌린지',
    description: '하루 스쿼트 20개, 2주 동안 함께해요.',
    categoryCode: 'exercise',
    difficultyCode: 'normal',
    exerciseCode: 'squat',
    targetValue: 20,
    targetUnit: 'reps',
    periodDays: 14,
    startDate: dayOffset(-3, nowMs),
    endDate: dayOffset(10, nowMs),
    phase: 'ongoing',
    publicationStatus: 'public',
    settlementStatus: 'not_started',
    capacity: null,
    participantCount: 128,
    completionRateRequired: 0.8,
    rewardPoints: 700,
    joined: true,
    ...overrides,
  };
}

export function seedChallenges(nowMs = Date.now()) {
  return [
    challenge({}, nowMs),
    challenge({
      id: 'challenge-0002',
      title: '일주일 독서 챌린지',
      description: '하루 20쪽씩 일주일.',
      categoryCode: 'study',
      exerciseCode: null,
      targetValue: 20,
      targetUnit: 'pages',
      periodDays: 7,
      startDate: dayOffset(4, nowMs),
      endDate: dayOffset(10, nowMs),
      phase: 'recruiting',
      participantCount: 36,
      rewardPoints: 350,
      joined: false,
    }, nowMs),
  ];
}

/** A104 `MyChallenge` */
export function myChallenge(nowMs = Date.now()) {
  return {
    challenge: challenge({}, nowMs),
    participationId: 'participation-0001',
    status: 'enrolled',
    successDays: 2,
    requiredDays: 12,
    todayStatus: 'pending',
    joinedAt: new Date(nowMs - 3 * 86400000).toISOString(),
    withdrawnAt: null,
  };
}

/** A105 `ChallengeRanking` */
export function challengeRanking(nowMs = Date.now()) {
  return {
    challengeId: 'challenge-0001',
    calculatedAt: new Date(nowMs).toISOString(),
    isFinal: false,
    myRank: { rankNo: 12, score: 2, successfulDays: 2, nickname: '개발유저' },
    entries: [
      { rankNo: 1, nickname: '달리는너구리', score: 3, successfulDays: 3 },
      { rankNo: 2, nickname: '아침형인간', score: 3, successfulDays: 3 },
      { rankNo: 12, nickname: '개발유저', score: 2, successfulDays: 2 },
    ],
  };
}

/** A107 `ChallengeResult` */
export function challengeResult(nowMs = Date.now()) {
  return {
    challenge: challenge({ phase: 'ended', settlementStatus: 'confirmed' }, nowMs),
    participationId: 'participation-0001',
    status: 'completed',
    rankNo: 12,
    successfulDays: 12,
    requiredDays: 12,
    rewardPoints: 700,
    settledAt: new Date(nowMs).toISOString(),
  };
}

/** A90·A93 `MissionRecommendation` */
export function recommendation(overrides = {}, nowMs = Date.now()) {
  return {
    id: 'recommendation-0001',
    rankNo: 1,
    title: '가볍게 스쿼트 20개',
    reason: '날씨가 좋아서 몸을 움직이기 좋아요.',
    missionDefinition: missionDefinition(),
    context: {
      weather: 'clear',
      temperatureC: 20,
      timeSlot: 'afternoon',
      isMoving: false,
      outdoorSuitable: true,
    },
    rewardPreview,
    status: 'shown',
    expiresAt: new Date(nowMs + 3 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

export default {
  challenge,
  seedChallenges,
  myChallenge,
  challengeRanking,
  challengeResult,
  recommendation,
};
