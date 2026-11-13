import { addDays } from '../common/time/kst.js';

export const RULE_PLAN_VERSION = 'rule-plan@0.1.0';

const MAX_STEPS = 4;
const MAX_MISSIONS = 100;
const DEFAULT_FREQUENCY = 3;
const DEFAULT_MINUTES = 30;
const DAY_MS = 86_400_000;

const daysBetween = (from, to) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );

/**
 * 규칙 기반 계획 초안 (AI 서버 연동 전의 대체 생성기)
 * - 오늘(또는 시작일) ~ 종료일을 최대 4단계로 분할, 단계마다 주당 목표 빈도에 맞춰 날짜를 고르게 배치
 * - 미션: 목표의 분야·난이도, 카메라 인증, 한 번에 100개 이하
 *
 * @param {{title: string, startDate: string, endDate: string,
 *   targetFrequency?: number|null, dailyAvailableMinutes?: number|null}} goal
 * @param {{categoryCode: string, difficultyCode: string, today: string}} context
 * @returns {{summary: string, steps: object[], engineVersion: string}|null}
 *   남은 기간이 없으면 null
 */
export function buildRulePlan(goal, { categoryCode, difficultyCode, today }) {
  const start = goal.startDate > today ? goal.startDate : today;
  if (goal.endDate < start) return null;

  const totalDays = daysBetween(start, goal.endDate) + 1;
  const stepCount = Math.min(MAX_STEPS, Math.max(1, Math.ceil(totalDays / 7)));
  const segmentDays = Math.ceil(totalDays / stepCount);
  const perWeek = goal.targetFrequency ?? DEFAULT_FREQUENCY;
  const seconds = (goal.dailyAvailableMinutes ?? DEFAULT_MINUTES) * 60;

  const segments = [];
  for (let i = 0; i < stepCount; i += 1) {
    const from = addDays(start, i * segmentDays);
    if (from > goal.endDate) break;
    const toCandidate = addDays(from, segmentDays - 1);
    const to = toCandidate > goal.endDate ? goal.endDate : toCandidate;
    const length = daysBetween(from, to) + 1;
    segments.push({
      from,
      to,
      length,
      count: Math.min(length, Math.max(1, Math.round((perWeek * length) / 7))),
    });
  }

  // 상한을 넘으면 단계별 개수를 같은 비율로 줄인다
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  if (total > MAX_MISSIONS) {
    const cap = Math.floor(MAX_MISSIONS / segments.length);
    for (const s of segments) s.count = Math.min(s.count, cap);
  }

  let order = 0;
  const steps = segments.map((segment, index) => ({
    stepNo: index + 1,
    title: `${index + 1}단계`,
    description: null,
    dueDate: segment.to,
    missions: Array.from({ length: segment.count }, (_, i) => {
      order += 1;
      const offset = Math.floor(((i + 0.5) * segment.length) / segment.count);
      return {
        scheduledDate: addDays(segment.from, offset),
        title: `${goal.title} ${order}번째`,
        description: null,
        categoryCode,
        difficultyCode,
        exerciseCode: null,
        verificationMethod: 'camera',
        targetValue: null,
        targetUnit: null,
        estimatedDurationSeconds: seconds,
        isRequired: true,
      };
    }),
  }));

  return {
    summary: `${start}부터 ${goal.endDate}까지 ${steps.length}단계, 일주일에 약 ${perWeek}번 하는 계획이에요.`,
    steps,
    engineVersion: RULE_PLAN_VERSION,
  };
}
