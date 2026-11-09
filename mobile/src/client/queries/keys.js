/**
 * 쿼리 키 (parts/mobile-client §5.1).
 *
 * 모양은 `[도메인, 'list'|'detail'|…, 값]`으로 맞춘다.
 * 무효화는 **앞부분 일치**로 하므로 (§5.2), 같은 도메인은 같은 첫 조각을 써야 한다.
 */

/** §5.2 무효화 표가 쓰는 도메인 앞조각. `invalidate.js`와 짝이다. */
export const domains = {
  me: ['me'],
  catalog: ['catalog'],
  home: ['home'],
  goals: ['goals'],
  missions: ['missions'],
  missionDefinitions: ['missionDefinitions'],
  records: ['records'],
  adjustments: ['adjustments'],
  reports: ['reports'],
  shop: ['shop'],
  inventory: ['inventory'],
  points: ['points'],
  streak: ['streak'],
  achievements: ['achievements'],
  pets: ['pets'],
  recommendations: ['recommendations'],
  challenges: ['challenges'],
  notifications: ['notifications'],
  notices: ['notices'],
  support: ['support'],
  subscription: ['subscription'],
};

export const queryKeys = {
  // 계정
  me: ['me'],
  nicknameAvailability: (nickname) => ['auth', 'nickname', nickname],
  currentPolicies: ['auth', 'policies'],

  /** `kind` = `'categories'` | `'difficulties'` | `'exercises'` (A17~A19) */
  catalog: (kind) => ['catalog', kind],

  // 홈·목표·계획
  home: (date) => ['home', date ?? null],
  goals: (params) => ['goals', 'list', params ?? {}],
  goal: (goalId) => ['goals', 'detail', goalId],
  latestPlan: (goalId) => ['goals', 'plan', goalId],

  // 미션
  missions: (params) => ['missions', 'list', params ?? {}],
  mission: (missionId) => ['missions', 'detail', missionId],
  missionDefinitions: (params) => ['missionDefinitions', 'list', params ?? {}],
  nextMissions: (source) => ['missionDefinitions', 'next', source ?? 'all'],

  // 수행 인증
  record: (recordId) => ['records', recordId],

  // 계획 재조정
  adjustments: (params) => ['adjustments', 'list', params ?? {}],
  adjustment: (adjustmentId) => ['adjustments', 'detail', adjustmentId],

  // 리포트
  reportSummary: (params) => ['reports', 'summary', params ?? {}],
  aiReports: (params) => ['reports', 'ai', 'list', params ?? {}],
  aiReport: (runId) => ['reports', 'ai', 'detail', runId],
  calendar: (month) => ['reports', 'calendar', month],

  // 포인트·상점·스트릭·업적
  shopItems: ['shop', 'items'],
  inventory: ['inventory'],
  points: ['points', 'balance'],
  pointTransactions: (params) => ['points', 'transactions', params ?? {}],
  streak: ['streak'],
  achievements: (params) => ['achievements', 'list', params ?? {}],

  // 펫
  myPets: ['pets', 'mine'],
  petSpecies: (params) => ['pets', 'species', 'list', params ?? {}],
  petSpeciesDetail: (speciesId) => ['pets', 'species', 'detail', speciesId],
  petEvolutionEvents: (petId, after) => ['pets', 'evolutions', petId, after ?? null],

  // 상황 추천
  activeRecommendations: ['recommendations', 'active'],

  // 챌린지
  challenges: (params) => ['challenges', 'list', params ?? {}],
  challenge: (challengeId) => ['challenges', 'detail', challengeId],
  myChallenges: (status) => ['challenges', 'mine', status ?? null],
  challengeRanking: (challengeId) => ['challenges', 'ranking', challengeId],
  challengeResult: (challengeId) => ['challenges', 'result', challengeId],

  // 알림·공지·문의·구독
  notifications: (params) => ['notifications', 'list', params ?? {}],
  notices: (params) => ['notices', 'list', params ?? {}],
  notice: (noticeId) => ['notices', 'detail', noticeId],
  supportTickets: (params) => ['support', 'list', params ?? {}],
  supportTicket: (ticketId) => ['support', 'detail', ticketId],
  subscription: ['subscription'],
};

export default queryKeys;
