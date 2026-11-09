/**
 * 목표·계획 가짜 응답 (A20~A28). 07 §5·§6 모양.
 */
import { todayKst } from '../../format/format.js';

/** 오늘에서 며칠 떨어진 날짜 (`YYYY-MM-DD`). */
export function dayOffset(days, nowMs = Date.now()) {
  return todayKst(nowMs + days * 86400000);
}

/** `Goal` 하나 */
export function goal(overrides = {}, nowMs = Date.now()) {
  return {
    id: 'goal-0001',
    title: '한 달 안에 스쿼트 50개',
    description: '하루 한 번, 꾸준히.',
    categoryCode: 'exercise',
    difficultyCode: 'normal',
    startDate: dayOffset(-7, nowMs),
    endDate: dayOffset(21, nowMs),
    targetFrequency: 5,
    dailyAvailableMinutes: 30,
    status: 'active',
    progressRate: 0.25,
    hasAcceptedPlan: true,
    completedAt: null,
    createdAt: new Date(nowMs - 7 * 86400000).toISOString(),
    ...overrides,
  };
}

/** `GoalStep` */
export function goalStep(stepNo, overrides = {}, nowMs = Date.now()) {
  return {
    id: `goal-step-000${stepNo}`,
    stepNo,
    title: `${stepNo}단계`,
    description: null,
    dueDate: dayOffset(stepNo * 7, nowMs),
    status: stepNo === 1 ? 'active' : 'active',
    missionCount: 7,
    completedMissionCount: stepNo === 1 ? 3 : 0,
    isCurrent: stepNo === 1,
    ...overrides,
  };
}

/** `GoalDetail` = `Goal` + steps·집계 */
export function goalDetail(overrides = {}, nowMs = Date.now()) {
  const base = goal(overrides, nowMs);
  return {
    ...base,
    steps: [goalStep(1, {}, nowMs), goalStep(2, {}, nowMs), goalStep(3, {}, nowMs)],
    totalMissionCount: 21,
    completedMissionCount: 5,
    todayMissionIds: ['mission-0001'],
  };
}

/** `PlanMission` */
function planMission(scheduledDate, targetValue) {
  return {
    scheduledDate,
    title: `스쿼트 ${targetValue}개`,
    description: null,
    categoryCode: 'exercise',
    difficultyCode: 'normal',
    exerciseCode: 'squat',
    verificationMethod: 'camera',
    targetValue,
    targetUnit: 'reps',
    estimatedDurationSeconds: 600,
    isRequired: true,
  };
}

/** `PlanProposal` (A25·A26) */
export function planProposal(goalId = 'goal-0001', nowMs = Date.now()) {
  return {
    id: 'plan-proposal-0001',
    goalId,
    generationNo: 1,
    status: 'draft',
    summary: '3주에 걸쳐 조금씩 횟수를 늘려 가는 계획이에요.',
    steps: [
      {
        stepNo: 1,
        title: '몸 만들기',
        description: null,
        dueDate: dayOffset(7, nowMs),
        missions: [planMission(dayOffset(1, nowMs), 20), planMission(dayOffset(3, nowMs), 25)],
      },
      {
        stepNo: 2,
        title: '횟수 늘리기',
        description: null,
        dueDate: dayOffset(14, nowMs),
        missions: [planMission(dayOffset(9, nowMs), 35)],
      },
      {
        stepNo: 3,
        title: '마무리',
        description: null,
        dueDate: dayOffset(21, nowMs),
        missions: [planMission(dayOffset(18, nowMs), 50)],
      },
    ],
    engineVersion: 'mock-plan@0.1.0',
    generatedAt: new Date(nowMs).toISOString(),
    acceptedAt: null,
  };
}

/** `PlanAdjustment` (A50·A51) */
export function planAdjustment(overrides = {}, nowMs = Date.now()) {
  return {
    id: 'adjustment-0001',
    goalId: 'goal-0001',
    goalTitle: '한 달 안에 스쿼트 50개',
    status: 'proposed',
    reason: '지난주 달성률이 낮아 목표를 조금 낮춰 봤어요.',
    createdAt: new Date(nowMs - 86400000).toISOString(),
    expiresAt: new Date(nowMs + 6 * 86400000).toISOString(),
    decidedAt: null,
    proposedPlan: planProposal('goal-0001', nowMs).steps,
    ...overrides,
  };
}

export default { goal, goalDetail, goalStep, planProposal, planAdjustment, dayOffset };
