/**
 * 미션·홈 가짜 응답 (A29~A36). 07 §4·§7 모양.
 */
import { todayKst } from '../../format/format.js';
import { dayOffset } from './goals.js';

/** `RewardPreview` */
export const rewardPreview = { points: 50, userXp: 30, petXp: 20 };

/** `Mission` */
export function mission(overrides = {}, nowMs = Date.now()) {
  return {
    id: 'mission-0001',
    goalId: 'goal-0001',
    goalStepId: 'goal-step-0001',
    challengeId: null,
    sourceType: 'ai',
    title: '스쿼트 20개',
    description: null,
    categoryCode: 'exercise',
    difficultyCode: 'normal',
    exerciseCode: 'squat',
    verificationMethod: 'camera',
    targetValue: 20,
    targetUnit: 'reps',
    estimatedDurationSeconds: 600,
    scheduledDate: todayKst(nowMs),
    isRequired: true,
    status: 'scheduled',
    memo: null,
    rewardPreview,
    ...overrides,
  };
}

/** `MissionDetail` */
export function missionDetail(overrides = {}, nowMs = Date.now()) {
  const base = mission(overrides, nowMs);
  return {
    ...base,
    latestRecord: null,
    submissionCount: 0,
    remainingSubmissions: 4,
    canStart: base.status === 'scheduled' || base.status === 'in_progress',
    canEdit: base.status === 'scheduled' && base.challengeId === null,
    guide: base.exerciseCode
      ? '온몸이 화면에 들어오도록 2~3m 떨어진 곳에 기기를 세워 주세요.'
      : null,
  };
}

/** 개발용 미션 묶음: 오늘 3개(카메라·사진·러닝) + 어제 완료 1개 */
export function seedMissions(nowMs = Date.now()) {
  const today = todayKst(nowMs);
  return [
    mission({ id: 'mission-0001', title: '스쿼트 20개', targetValue: 20, scheduledDate: today }, nowMs),
    mission({
      id: 'mission-0002',
      goalId: null,
      goalStepId: null,
      sourceType: 'user',
      title: '영어 단어 30개 외우기',
      categoryCode: 'study',
      exerciseCode: null,
      verificationMethod: 'camera',
      targetValue: 30,
      targetUnit: 'pages',
      scheduledDate: today,
    }, nowMs),
    mission({
      id: 'mission-0003',
      goalId: null,
      goalStepId: null,
      sourceType: 'template',
      title: '3km 달리기',
      exerciseCode: 'running',
      verificationMethod: 'sensor',
      targetValue: 3000,
      targetUnit: 'meters',
      estimatedDurationSeconds: 1800,
      scheduledDate: today,
    }, nowMs),
    mission({
      id: 'mission-0004',
      title: '스쿼트 15개',
      targetValue: 15,
      scheduledDate: dayOffset(-1, nowMs),
      status: 'completed',
    }, nowMs),
  ];
}

/** A35 `MissionDefinition` */
export function missionDefinition(overrides = {}) {
  return {
    id: 'definition-0001',
    origin: 'admin',
    title: '스쿼트 20개',
    description: '기본 자세로 천천히.',
    categoryCode: 'exercise',
    difficultyCode: 'normal',
    exerciseCode: 'squat',
    verificationMethod: 'camera',
    targetValue: 20,
    targetUnit: 'reps',
    estimatedDurationSeconds: 600,
    rewardPreview,
    ...overrides,
  };
}

export const missionDefinitions = [
  missionDefinition(),
  missionDefinition({ id: 'definition-0002', title: '플랭크 60초', exerciseCode: 'plank', targetValue: 60, targetUnit: 'seconds', estimatedDurationSeconds: 300 }),
  missionDefinition({ id: 'definition-0003', title: '책 20쪽 읽기', categoryCode: 'study', exerciseCode: null, targetValue: 20, targetUnit: 'pages', estimatedDurationSeconds: 1800 }),
  missionDefinition({ id: 'definition-0004', title: '물 8잔 마시기', categoryCode: 'lifestyle', exerciseCode: null, targetValue: 8, targetUnit: 'times', estimatedDurationSeconds: 60 }),
];

/** A29 `HomeSummary` */
export function homeSummary(date, missions, nowMs = Date.now()) {
  const visible = missions.filter((m) => m.scheduledDate === date && m.status !== 'cancelled');
  const completedCount = visible.filter((m) => m.status === 'completed').length;
  const totalCount = visible.length;

  // 그 날짜가 속한 주 월~일
  const base = Date.parse(`${date}T00:00:00+09:00`);
  const weekday = new Date(base + 9 * 3600000).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = todayKst(base + (mondayOffset + i) * 86400000);
    const dayMissions = missions.filter((m) => m.scheduledDate === d && m.status !== 'cancelled');
    return {
      date: d,
      completedCount: dayMissions.filter((m) => m.status === 'completed').length,
      totalCount: dayMissions.length,
      isToday: d === todayKst(nowMs),
    };
  });

  return {
    date,
    message: '오늘도 한 걸음!',
    week,
    summary: {
      completedCount,
      totalCount,
      progressRate: totalCount === 0 ? 0 : Number((completedCount / totalCount).toFixed(4)),
      streakDays: 5,
    },
    missions: visible,
    recommendation: null,
    activeChallenge: { id: 'challenge-0001', title: '2주 스쿼트 챌린지', todayStatus: 'pending' },
  };
}

export default {
  mission,
  missionDetail,
  seedMissions,
  missionDefinition,
  missionDefinitions,
  homeSummary,
  rewardPreview,
};
