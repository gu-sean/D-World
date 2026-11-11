/**
 * 포인트·상점·스트릭·업적·펫 가짜 응답 (A70~A85). 07 §11·§12 모양.
 */
import { todayKst } from '../../format/format.js';

/** A70 `ShopItem[]` */
export const shopItems = [
  {
    id: 'item-0001', name: '펫 간식', description: '펫 XP를 조금 올려 줘요.',
    itemKind: 'consumable', priceVersionId: 'price-0001', pricePoints: 300,
    imageUrl: null, displayOrder: 1, isActive: true,
  },
  {
    id: 'item-0002', name: '프로필 테두리', description: '프로필에 반짝이는 테두리.',
    itemKind: 'permanent', priceVersionId: 'price-0002', pricePoints: 1000,
    imageUrl: null, displayOrder: 2, isActive: true,
  },
];

/** A72 `InventoryItem[]` */
export const inventory = [
  { itemId: 'item-0001', name: '펫 간식', itemKind: 'consumable', quantity: 2, acquiredAt: '2026-11-01T00:00:00.000Z' },
];

/** A73 `PointBalance` */
export const pointBalance = {
  availablePoints: 1250,
  outstandingPoints: 0,
  pendingPoints: 50,
  monthlyEarnedPoints: 820,
  monthlyLimitPoints: 3000,
};

/** A74 `PointTransaction[]` */
export function pointTransactions(nowMs = Date.now()) {
  return [
    {
      id: 'tx-0003', kind: 'auto_award', sourceType: 'mission', sourceId: 'mission-0004',
      title: '스쿼트 15개 인증 성공', availableDelta: 50, balanceAfter: 1250,
      occurredAt: new Date(nowMs - 86400000).toISOString(),
    },
    {
      id: 'tx-0002', kind: 'spend', sourceType: 'shop_order', sourceId: 'order-0001',
      title: '펫 간식 교환', availableDelta: -300, balanceAfter: 1200,
      occurredAt: new Date(nowMs - 2 * 86400000).toISOString(),
    },
    {
      id: 'tx-0001', kind: 'auto_award', sourceType: 'streak', sourceId: 'streak-7',
      title: '7일 연속 달성', availableDelta: 100, balanceAfter: 1500,
      occurredAt: new Date(nowMs - 3 * 86400000).toISOString(),
    },
  ];
}

/** A75 `StreakStatus` */
export function streakStatus(nowMs = Date.now()) {
  return {
    currentSuccessDays: 5,
    bestSuccessDays: 12,
    lastSuccessDate: todayKst(nowMs - 86400000),
    todayStatus: 'pending',
    nextMilestone: { targetSuccessDays: 7, points: 100, userXp: 50, petXp: 30 },
    recentDays: Array.from({ length: 7 }, (_, i) => ({
      date: todayKst(nowMs - (6 - i) * 86400000),
      status: i < 5 ? 'success' : (i === 6 ? 'pending' : 'failed'),
    })),
  };
}

/** A76 `Achievement[]` */
export const achievements = [
  {
    id: 'ach-0001', code: 'steady_week', title: '꾸준한 일주일', description: '7일 연속 미션 성공',
    rarity: 'common', conditionType: 'streak_days', targetCount: 7, progressCount: 5,
    earned: false, earnedAt: null, badgeImageUrl: null,
    rewardPoints: 100, rewardUserXp: 50, rewardPetXp: 30,
  },
  {
    id: 'ach-0002', code: 'first_mission', title: '첫 걸음', description: '첫 미션 인증 성공',
    rarity: 'common', conditionType: 'mission_count', targetCount: 1, progressCount: 1,
    earned: true, earnedAt: '2026-10-28T00:00:00.000Z', badgeImageUrl: null,
    rewardPoints: 50, rewardUserXp: 20, rewardPetXp: 10,
  },
];

/** A80 `Pet[]` */
export const myPets = [
  {
    id: 'pet-0001', speciesId: 'species-0001', speciesName: '꾸준냥이', nickname: '꾸준냥이',
    stageCode: 'baby', levelNo: 3, totalXp: 420, nextStageXp: 800,
    bonusRate: 0.05, isRepresentative: true, imageUrl: null,
    dialogues: ['오늘도 함께해요!'], hatchedAt: '2026-10-20T00:00:00.000Z',
  },
];

/** A81·A82 `PetSpecies[]` */
export const petSpecies = [
  {
    id: 'species-0001', code: 'steady_cat', name: '꾸준냥이', description: '꾸준한 사람 곁에 오는 고양이.',
    personality: '차분함', worldText: '작은 습관의 숲에서 왔어요.', categoryCode: 'exercise',
    unlockConditionType: 'always', unlockTargetCount: null, unlocked: true,
    owned: true, hatchMissionCount: 3,
    stages: [
      { stageNo: 1, stageCode: 'egg', minTotalXp: 0, bonusRate: 0, imageUrl: null },
      { stageNo: 2, stageCode: 'baby', minTotalXp: 200, bonusRate: 0.05, imageUrl: null },
      { stageNo: 3, stageCode: 'adult', minTotalXp: 800, bonusRate: 0.1, imageUrl: null },
    ],
  },
  {
    id: 'species-0002', code: 'book_owl', name: '책읽는 부엉이', description: '학습 미션을 좋아해요.',
    personality: '조용함', worldText: '밤의 도서관에서 왔어요.', categoryCode: 'study',
    unlockConditionType: 'achievement', unlockTargetCount: null, unlocked: false,
    owned: false, hatchMissionCount: 5,
    stages: [
      { stageNo: 1, stageCode: 'egg', minTotalXp: 0, bonusRate: 0, imageUrl: null },
      { stageNo: 2, stageCode: 'baby', minTotalXp: 200, bonusRate: 0.05, imageUrl: null },
      { stageNo: 3, stageCode: 'adult', minTotalXp: 800, bonusRate: 0.1, imageUrl: null },
    ],
  },
];

/** A85 `PetEvolution[]` */
export const petEvolutionEvents = [
  {
    id: 'evolution-0001', petId: 'pet-0001', fromStageCode: 'egg', toStageCode: 'baby',
    bonusRateBefore: 0, bonusRateAfter: 0.05,
    newDialogues: ['조금 자랐어요!'], occurredAt: '2026-10-27T00:00:00.000Z',
  },
];

export default {
  shopItems,
  inventory,
  pointBalance,
  pointTransactions,
  streakStatus,
  achievements,
  myPets,
  petSpecies,
  petEvolutionEvents,
};
