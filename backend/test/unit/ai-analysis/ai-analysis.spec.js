import { randomUUID } from 'node:crypto';
import {
  adjustmentCauses,
  adjustmentKey,
  consecutiveMissedDays,
  parseAdjustmentKey,
  pickWorstGoal,
  toPlanSteps,
} from '../../../src/ai-analysis/adjustment-input.js';
import {
  parseAdjustmentCallback,
  parseReportCallback,
} from '../../../src/ai-analysis/ai-analysis.controller.js';
import {
  lastMonth,
  lastWeek,
  mondayOf,
  previousPeriod,
  rateOf,
} from '../../../src/ai-analysis/periods.js';

describe('periods', () => {
  it('지난주는 이번 주 월요일 직전의 월~일', () => {
    expect(mondayOf('2026-11-11')).toBe('2026-11-09');
    expect(mondayOf('2026-11-15')).toBe('2026-11-09');
    expect(lastWeek('2026-11-11')).toEqual({
      start: '2026-11-02',
      end: '2026-11-08',
    });
    expect(lastWeek('2026-11-09')).toEqual({
      start: '2026-11-02',
      end: '2026-11-08',
    });
  });

  it('지난달은 1일부터 말일까지(연초·윤년 포함)', () => {
    expect(lastMonth('2026-11-09')).toEqual({
      start: '2026-10-01',
      end: '2026-10-31',
    });
    expect(lastMonth('2027-01-05')).toEqual({
      start: '2026-12-01',
      end: '2026-12-31',
    });
    expect(lastMonth('2028-03-01')).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    });
  });

  it('바로 앞 기간과 달성률', () => {
    expect(
      previousPeriod('weekly_report', {
        start: '2026-11-02',
        end: '2026-11-08',
      }),
    ).toEqual({ start: '2026-10-26', end: '2026-11-01' });
    expect(
      previousPeriod('monthly_report', {
        start: '2026-10-01',
        end: '2026-10-31',
      }),
    ).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(rateOf(3, 4)).toBe(0.75);
    expect(rateOf(1, 3)).toBe(0.3333);
    expect(rateOf(0, 0)).toBeNull();
  });
});

describe('adjustment input', () => {
  it('연속으로 빠진 날 수', () => {
    const base = { goalStart: '2026-11-01', today: '2026-11-09' };
    expect(consecutiveMissedDays({ ...base, lastDone: '2026-11-08' })).toBe(0);
    expect(consecutiveMissedDays({ ...base, lastDone: '2026-11-05' })).toBe(3);
    expect(consecutiveMissedDays({ ...base, lastDone: null })).toBe(8);
    expect(
      consecutiveMissedDays({
        goalStart: '2026-01-01',
        today: '2026-11-09',
        lastDone: null,
      }),
    ).toBe(30);
  });

  it('원인 판정: 계획이 3건 미만이면 없음', () => {
    expect(
      adjustmentCauses({ planned: 2, done: 0, failed: 2, missedDays: 5 }),
    ).toEqual([]);
    expect(
      adjustmentCauses({ planned: 5, done: 5, failed: 0, missedDays: 0 }),
    ).toEqual([]);
  });

  it('원인 판정: 낮은 달성률, 과부하, 연속 결석', () => {
    expect(
      adjustmentCauses({ planned: 4, done: 1, failed: 0, missedDays: 0 }),
    ).toEqual([{ code: 'low_completion', value: 0.25 }]);
    expect(
      adjustmentCauses({ planned: 5, done: 3, failed: 2, missedDays: 3 }),
    ).toEqual([{ code: 'missed_days', value: 3 }]);
    expect(
      adjustmentCauses({ planned: 6, done: 2, failed: 4, missedDays: 4 }).map(
        (c) => c.code,
      ),
    ).toEqual(['low_completion', 'overload', 'missed_days']);
    // 실패 3건이어도 달성률 70% 이상이면 과부하 아님
    expect(
      adjustmentCauses({ planned: 10, done: 7, failed: 3, missedDays: 0 }),
    ).toEqual([]);
  });

  it('회원마다 달성률이 가장 낮은 목표를 고름', () => {
    const picked = pickWorstGoal([
      { goalId: 'b', rate: 0.4, causes: [1] },
      { goalId: 'a', rate: 0.2, causes: [1] },
      { goalId: 'c', rate: 0.2, causes: [1, 2] },
    ]);
    expect(picked.goalId).toBe('c');
  });

  it('ingestKey 만들기와 읽기', () => {
    const run = randomUUID();
    const goal = randomUUID();
    const key = adjustmentKey(run, goal);
    expect(parseAdjustmentKey(key)).toEqual({ runId: run, goalId: goal });
    expect(parseAdjustmentKey('plan-adjust:x:y')).toBeNull();
    expect(parseAdjustmentKey(undefined)).toBeNull();
  });

  it('남은 미션을 AI 계약 단계로: 단계 없는 미션은 마지막 "기타"', () => {
    const row = (extra) => ({
      step_no: 1,
      step_title: '1단계',
      step_description: null,
      step_due_date: '2026-11-15',
      scheduled_date: '2026-11-10',
      title: '미션',
      description: null,
      category_code: 'exercise',
      difficulty_code: 'easy',
      exercise_code: 'squat',
      verification_method: 'camera',
      target_value: '20.00',
      target_unit: 'reps',
      estimated_duration_seconds: 600,
      is_required: true,
      ...extra,
    });
    const steps = toPlanSteps(
      [
        row({}),
        row({ step_no: 3, step_title: '3단계', step_due_date: '2026-11-29' }),
        row({
          step_no: null,
          step_title: null,
          step_due_date: null,
          target_value: null,
          target_unit: '개',
          estimated_duration_seconds: 5,
        }),
      ],
      '2026-12-31',
    );
    expect(steps.map((s) => [s.stepNo, s.title, s.dueDate])).toEqual([
      [1, '1단계', '2026-11-15'],
      [2, '3단계', '2026-11-29'],
      [3, '기타', '2026-12-31'],
    ]);
    expect(steps[0].missions[0]).toMatchObject({
      targetValue: 20,
      targetUnit: 'reps',
      exerciseCode: 'squat',
    });
    // 값이 없거나 허용 밖이면 기본값으로 채움
    expect(steps[2].missions[0]).toMatchObject({
      targetValue: 1,
      targetUnit: 'times',
      estimatedDurationSeconds: 60,
    });
  });
});

describe('callback parsing', () => {
  const base = () => ({
    ingestKey: `report:${randomUUID()}`,
    runId: randomUUID(),
    engineVersion: 'gemini-report@0.1.0',
  });

  it('리포트: 완료는 제목·요약 필수, 실패는 사유만', () => {
    const ok = parseReportCallback({
      ...base(),
      status: 'completed',
      title: '주간 리포트',
      summary: '잘 하셨어요',
      feedback: null,
      nextGoals: [{ text: '내일은 아침에', categoryCode: null }],
      content: { highlights: ['5일 연속'] },
    });
    expect(ok).toMatchObject({ title: '주간 리포트', status: 'completed' });
    expect(ok.content.highlights).toEqual(['5일 연속']);
    expect(() =>
      parseReportCallback({ ...base(), status: 'completed', title: 'x' }),
    ).toThrow();
    expect(
      parseReportCallback({
        ...base(),
        status: 'failed',
        failureReason: 'AI_LLM_UNAVAILABLE',
      }).failureReason,
    ).toBe('AI_LLM_UNAVAILABLE');
    expect(() => parseReportCallback({ ...base(), status: 'done' })).toThrow();
  });

  it('재조정: 완료는 proposedPlan 필수', () => {
    const run = randomUUID();
    const body = {
      ingestKey: adjustmentKey(run, randomUUID()),
      runId: run,
      engineVersion: 'v',
    };
    expect(() =>
      parseAdjustmentCallback({ ...body, status: 'completed' }),
    ).toThrow();
    expect(() =>
      parseAdjustmentCallback({
        ...body,
        status: 'completed',
        proposedPlan: [],
      }),
    ).toThrow();
    expect(
      parseAdjustmentCallback({
        ...body,
        status: 'completed',
        reason: null,
        proposedPlan: [{ stepNo: 1 }],
      }).proposedPlan,
    ).toHaveLength(1);
    expect(
      parseAdjustmentCallback({
        ...body,
        status: 'failed',
        proposedPlan: null,
        failureReason: 'AI_X',
      }).status,
    ).toBe('failed');
  });
});
