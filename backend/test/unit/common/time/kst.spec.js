import {
  addDays,
  kstDate,
  kstDayStart,
} from '../../../../src/common/time/kst.js';
describe('kst', () => {
  it('UTC 15:00은 KST 다음 날 00:00', () => {
    expect(kstDate(new Date('2026-10-31T14:59:59Z'))).toBe('2026-10-31');
    expect(kstDate(new Date('2026-10-31T15:00:00Z'))).toBe('2026-11-01');
  });
  it('KST 날짜 시작은 전날 UTC 15:00', () => {
    expect(kstDayStart('2026-11-01').toISOString()).toBe(
      '2026-10-31T15:00:00.000Z',
    );
  });
  it('addDays는 월·연 경계 통과', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('잘못된 날짜 거부', () => {
    expect(() => kstDayStart('2026-02-31')).toThrow(RangeError);
    expect(() => kstDayStart('2026-1-1')).toThrow(RangeError);
    expect(() => addDays('abc', 1)).toThrow(RangeError);
  });
});
