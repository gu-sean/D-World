import { StreakService } from '../../../src/streak/streak.service.js';

const service = new StreakService(null, null, null);
const day = (n, status) => ({
  streak_date: `2026-01-${String(n).padStart(2, '0')}`,
  status,
});
const run = (from, to, status = 'success') =>
  Array.from({ length: to - from + 1 }, (_, i) => day(from + i, status));

describe('StreakService.summarize', () => {
  it('행이 없으면 모두 0', () => {
    expect(service.summarize([])).toEqual({
      current: 0,
      longest: 0,
      lastSuccess: null,
      hasPending: false,
      achieved: {},
    });
  });

  it('연속 성공을 세고 실패가 끊으며 마일스톤은 처음 도달한 날짜로 한 번만', () => {
    const rows = [...run(1, 7), day(8, 'failed'), ...run(9, 15)];
    const result = service.summarize(rows);
    expect(result).toMatchObject({
      current: 7,
      longest: 7,
      lastSuccess: '2026-01-15',
      hasPending: false,
    });
    expect(result.achieved).toEqual({ 7: '2026-01-07' });
  });

  it('예정 미션이 없는 날(행 없음)은 끊지도 더하지도 않음', () => {
    // 1~3일, 4~5일 행 없음, 6일 → 연속 4일
    const result = service.summarize([...run(1, 3), day(6, 'success')]);
    expect(result.current).toBe(4);
  });

  it('pending이 끼어 있으면 그 구간에서는 마일스톤을 확정하지 않고, 성공으로 바뀌면 그 날짜가 달성일', () => {
    const rows = [...run(1, 3), day(4, 'pending'), ...run(5, 8)];
    const open = service.summarize(rows);
    expect(open).toMatchObject({ current: 7, hasPending: true });
    expect(open.achieved).toEqual({});

    const settled = service.summarize([...run(1, 8)]);
    expect(settled.achieved).toEqual({ 7: '2026-01-07' });
  });

  it('실패로 끝난 pending은 구간을 끊어 pending 표시도 사라짐', () => {
    const rows = [...run(1, 3), day(4, 'pending'), day(5, 'failed')];
    expect(service.summarize(rows)).toMatchObject({
      current: 0,
      longest: 3,
      hasPending: false,
    });
  });

  it('30·100일 마일스톤', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      streak_date: new Date(Date.UTC(2026, 0, 1 + i))
        .toISOString()
        .slice(0, 10),
      status: 'success',
    }));
    const result = service.summarize(rows);
    expect(result.achieved).toEqual({
      7: '2026-01-07',
      30: '2026-01-30',
      100: '2026-04-10',
    });
    expect(result).toMatchObject({ current: 100, longest: 100 });
  });
});
