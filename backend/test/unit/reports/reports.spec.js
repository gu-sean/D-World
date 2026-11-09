import {
  monthRange,
  periodRange,
} from '../../../src/reports/reports.service.js';

describe('periodRange', () => {
  it('week는 월요일부터 일요일까지', () => {
    expect(periodRange('week', '2026-11-11')).toEqual({
      start: '2026-11-09',
      end: '2026-11-15',
    });
    expect(periodRange('week', '2026-11-15')).toEqual({
      start: '2026-11-09',
      end: '2026-11-15',
    });
    expect(periodRange('week', '2026-11-09').start).toBe('2026-11-09');
  });

  it('month는 그 달 1일부터 말일까지(윤년 포함)', () => {
    expect(periodRange('month', '2026-11-20')).toEqual({
      start: '2026-11-01',
      end: '2026-11-30',
    });
    expect(periodRange('month', '2028-02-10').end).toBe('2028-02-29');
    expect(periodRange('month', '2026-12-31').end).toBe('2026-12-31');
  });

  it('all은 시작 없이 기준일까지', () => {
    expect(periodRange('all', '2026-11-09')).toEqual({
      start: null,
      end: '2026-11-09',
    });
  });
});

describe('monthRange', () => {
  it('YYYY-MM을 기간으로 바꿈', () => {
    expect(monthRange('2026-02')).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('형식이 틀리면 거절', () => {
    expect(() => monthRange('2026-13')).toThrow();
    expect(() => monthRange('2026-1')).toThrow();
    expect(() => monthRange('hello')).toThrow();
  });
});
