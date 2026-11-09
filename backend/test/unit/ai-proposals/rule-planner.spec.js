import { buildRulePlan } from '../../../src/ai-proposals/rule-planner.js';

const context = {
  categoryCode: 'exercise',
  difficultyCode: 'normal',
  today: '2026-11-09',
};
const goal = (overrides = {}) => ({
  title: '스쿼트 50개',
  startDate: '2026-11-09',
  endDate: '2026-11-29', // 21일
  targetFrequency: 3,
  dailyAvailableMinutes: 20,
  ...overrides,
});
const allMissions = (plan) => plan.steps.flatMap((s) => s.missions);

describe('buildRulePlan', () => {
  it('3주 목표는 3단계, 주 3회로 9개 미션', () => {
    const plan = buildRulePlan(goal(), context);
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps.map((s) => s.dueDate)).toEqual([
      '2026-11-15',
      '2026-11-22',
      '2026-11-29',
    ]);
    expect(allMissions(plan)).toHaveLength(9);
    expect(plan.engineVersion).toBe('rule-plan@0.1.0');
  });

  it('미션 날짜는 오늘 이후, 목표 기간 안, 단계 안에 있고 하루에 하나', () => {
    const plan = buildRulePlan(goal(), context);
    const dates = allMissions(plan).map((m) => m.scheduledDate);
    expect(new Set(dates).size).toBe(dates.length);
    for (const step of plan.steps) {
      for (const mission of step.missions) {
        expect(mission.scheduledDate >= context.today).toBe(true);
        expect(mission.scheduledDate <= step.dueDate).toBe(true);
      }
    }
    expect(dates.every((d) => d <= '2026-11-29')).toBe(true);
  });

  it('시작일이 미래면 시작일부터, 과거면 오늘부터', () => {
    const future = buildRulePlan(
      goal({ startDate: '2026-12-01', endDate: '2026-12-07' }),
      context,
    );
    expect(allMissions(future)[0].scheduledDate >= '2026-12-01').toBe(true);
    const past = buildRulePlan(goal({ startDate: '2026-10-01' }), context);
    expect(allMissions(past)[0].scheduledDate >= '2026-11-09').toBe(true);
  });

  it('미션은 목표의 분야·난이도와 하루 가용 시간을 따름', () => {
    const [first] = allMissions(buildRulePlan(goal(), context));
    expect(first).toMatchObject({
      categoryCode: 'exercise',
      difficultyCode: 'normal',
      verificationMethod: 'camera',
      estimatedDurationSeconds: 1200,
      isRequired: true,
    });
  });

  it('빈도·시간이 없으면 기본값(주 3회, 30분)', () => {
    const plan = buildRulePlan(
      goal({ targetFrequency: null, dailyAvailableMinutes: null }),
      context,
    );
    expect(allMissions(plan)).toHaveLength(9);
    expect(allMissions(plan)[0].estimatedDurationSeconds).toBe(1800);
  });

  it('1년짜리 매일 목표도 100개를 넘지 않고 최대 4단계', () => {
    const plan = buildRulePlan(
      goal({ endDate: '2027-11-08', targetFrequency: 7 }),
      context,
    );
    expect(plan.steps.length).toBeLessThanOrEqual(4);
    expect(allMissions(plan).length).toBeLessThanOrEqual(100);
  });

  it('남은 기간이 없으면 null', () => {
    expect(
      buildRulePlan(
        goal({ startDate: '2026-10-01', endDate: '2026-11-01' }),
        context,
      ),
    ).toBeNull();
  });

  it('하루짜리 목표는 1단계 1미션', () => {
    const plan = buildRulePlan(goal({ endDate: '2026-11-09' }), context);
    expect(plan.steps).toHaveLength(1);
    expect(allMissions(plan)).toHaveLength(1);
  });
});
