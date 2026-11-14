import { addDays } from '../common/time/kst.js';

const TARGET_UNITS = new Set([
  'reps',
  'seconds',
  'times',
  'pages',
  'steps',
  'meters',
]);
const MIN_PLANNED = 3;
const MAX_MISSED = 30;
const DAY_MS = 86_400_000;

const daysBetween = (from, to) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );

/** 어제까지 연속으로 빠진 날 수. 완료한 적이 없으면 목표 시작일부터 센다(최대 30) */
export function consecutiveMissedDays({ lastDone, goalStart, today }) {
  const yesterday = addDays(today, -1);
  const since = lastDone ?? addDays(goalStart, -1);
  return Math.min(Math.max(daysBetween(since, yesterday), 0), MAX_MISSED);
}

/**
 * 재조정이 필요한 원인 (AI 계약 AdjustmentCause)
 * - low_completion: 달성률 50% 미만 (value = 달성률)
 * - overload: 실패 3건 이상이면서 달성률 70% 미만 (value = 실패 비율)
 * - missed_days: 3일 이상 연속으로 빠짐 (value = 일수)
 * 지난주 계획이 3건 미만이면 판단 안 함
 */
export function adjustmentCauses({ planned, done, failed, missedDays }) {
  if (planned < MIN_PLANNED) return [];
  const rate = done / planned;
  const causes = [];
  if (rate < 0.5) {
    causes.push({ code: 'low_completion', value: Number(rate.toFixed(4)) });
  }
  if (failed >= 3 && rate < 0.7) {
    causes.push({
      code: 'overload',
      value: Number((failed / planned).toFixed(4)),
    });
  }
  if (missedDays >= 3) {
    causes.push({ code: 'missed_days', value: missedDays });
  }
  return causes;
}

/** 회원마다 재조정할 목표 하나: 달성률이 가장 낮은 것(같으면 원인이 많은 것) */
export function pickWorstGoal(candidates) {
  return [...candidates].sort(
    (a, b) =>
      a.rate - b.rate ||
      b.causes.length - a.causes.length ||
      String(a.goalId).localeCompare(String(b.goalId)),
  )[0];
}

/**
 * 앞으로 남은 예정 미션 행 → AI 계약 PlanStep[] (before_plan)
 * 단계가 없는 미션은 마지막에 "기타" 단계로 묶고, 단계 번호는 1부터 다시 매긴다
 */
export function toPlanSteps(rows, goalEnd) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.step_no ?? 'none';
    if (!groups.has(key)) {
      groups.set(key, {
        title: row.step_title ?? '기타',
        description: row.step_description ?? null,
        dueDate: row.step_due_date ?? goalEnd,
        missions: [],
      });
    }
    groups.get(key).missions.push({
      scheduledDate: row.scheduled_date,
      title: row.title,
      description: row.description ?? null,
      categoryCode: row.category_code,
      difficultyCode: row.difficulty_code,
      exerciseCode: row.exercise_code ?? null,
      verificationMethod: row.verification_method,
      targetValue: Math.max(1, Math.round(Number(row.target_value ?? 1))),
      targetUnit: TARGET_UNITS.has(row.target_unit) ? row.target_unit : 'times',
      estimatedDurationSeconds: Math.min(
        Math.max(row.estimated_duration_seconds ?? 600, 60),
        14_400,
      ),
      isRequired: row.is_required,
    });
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => {
    if (a === 'none') return 1;
    if (b === 'none') return -1;
    return a - b;
  });
  return ordered.map(([, step], index) => ({ stepNo: index + 1, ...step }));
}

export const ADJUSTMENT_KEY = /^plan-adjust:([0-9A-Za-z]{8}):([0-9A-Za-z]{8})$/;

/** ingestKey = plan-adjust:{runId}:{goalId} */
export function adjustmentKey(runId, goalId) {
  return `plan-adjust:${runId}:${goalId}`;
}

export function parseAdjustmentKey(key) {
  const match = ADJUSTMENT_KEY.exec(key ?? '');
  return match ? { runId: match[1], goalId: match[2] } : null;
}
