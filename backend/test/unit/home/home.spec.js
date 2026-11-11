import {
  kstHour,
  messageMatches,
  weekDates,
} from '../../../src/home/home.service.js';

describe('weekDates', () => {
  it('월요일부터 일요일까지 7일', () => {
    // 2026-11-09는 월요일
    expect(weekDates('2026-11-09')).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ]);
  });

  it('일요일은 그 주의 마지막 날', () => {
    const week = weekDates('2026-11-15');
    expect(week[0]).toBe('2026-11-09');
    expect(week[6]).toBe('2026-11-15');
  });

  it('달이 바뀌어도 이어짐', () => {
    expect(weekDates('2026-12-02')[0]).toBe('2026-11-30');
  });
});

describe('kstHour', () => {
  it('UTC 15시는 KST 0시', () => {
    expect(kstHour(new Date('2026-11-09T15:00:00Z'))).toBe(0);
    expect(kstHour(new Date('2026-11-09T00:00:00Z'))).toBe(9);
  });
});

describe('messageMatches', () => {
  const base = {
    date: '2026-11-09',
    isToday: true,
    totalCount: 2,
    completedCount: 0,
    streakDays: 3,
    lastSuccessDate: '2026-11-08',
    daysSinceLastCompleted: 4,
    hour: 22,
  };
  const msg = (condition_type, condition_params = {}) => ({
    condition_type,
    condition_params,
  });

  it('always / no_mission_today', () => {
    expect(messageMatches(msg('always'), base)).toBe(true);
    expect(messageMatches(msg('no_mission_today'), base)).toBe(false);
    expect(
      messageMatches(msg('no_mission_today'), { ...base, totalCount: 0 }),
    ).toBe(true);
  });

  it('streak_at_risk: 오늘 아직 못 했고 연속 기록이 있을 때', () => {
    expect(messageMatches(msg('streak_at_risk'), base)).toBe(true);
    expect(
      messageMatches(msg('streak_at_risk'), { ...base, completedCount: 1 }),
    ).toBe(false);
    expect(
      messageMatches(msg('streak_at_risk'), { ...base, isToday: false }),
    ).toBe(false);
    expect(
      messageMatches(msg('streak_at_risk'), { ...base, streakDays: 0 }),
    ).toBe(false);
  });

  it('inactive_days', () => {
    expect(messageMatches(msg('inactive_days', { days: 3 }), base)).toBe(true);
    expect(messageMatches(msg('inactive_days', { days: 7 }), base)).toBe(false);
    expect(
      messageMatches(msg('inactive_days', { days: 1 }), {
        ...base,
        daysSinceLastCompleted: null,
      }),
    ).toBe(false);
  });

  it('time_slot: 자정을 넘는 구간 포함', () => {
    expect(
      messageMatches(msg('time_slot', { start_hour: 20, end_hour: 23 }), base),
    ).toBe(true);
    expect(
      messageMatches(msg('time_slot', { start_hour: 6, end_hour: 12 }), base),
    ).toBe(false);
    expect(
      messageMatches(msg('time_slot', { start_hour: 21, end_hour: 3 }), base),
    ).toBe(true);
  });
});
