import { describe, expect, it } from 'vitest';
import { countDays, lastDays, MAX_PERIOD_DAYS, resolvePeriod } from './period.js';

describe('countDays', () => {
  it('counts both ends', () => {
    expect(countDays('2026-11-01', '2026-11-01')).toBe(1);
    expect(countDays('2026-11-01', '2026-11-07')).toBe(7);
  });
});

describe('lastDays', () => {
  it('ends today and spans the requested number of days', () => {
    const { from, to } = lastDays(7);
    expect(countDays(from, to)).toBe(7);
    expect(lastDays(1).from).toBe(lastDays(1).to);
  });
});

describe('resolvePeriod', () => {
  it('uses one date for both ends', () => {
    expect(resolvePeriod({ from: '2026-11-05' })).toEqual({
      from: '2026-11-05',
      to: '2026-11-05',
      error: null,
    });
  });

  it('defaults to today..today', () => {
    const period = resolvePeriod({});
    expect(period.from).toBe(period.to);
    expect(period.error).toBeNull();
  });

  it('reports a reversed period', () => {
    expect(resolvePeriod({ from: '2026-11-10', to: '2026-11-01' }).error).toBe('reversed');
  });

  it('reports a period longer than the limit', () => {
    expect(resolvePeriod({ from: '2026-10-01', to: '2026-11-19' }).error).toBe('tooLong');
    expect(MAX_PERIOD_DAYS).toBe(31);
    expect(resolvePeriod({ from: '2026-10-20', to: '2026-11-19' }).error).toBeNull();
  });
});
