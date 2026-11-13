import {
  alignDatesSql,
  alignSeedChallengeSql,
  SEED_CHALLENGE_ID,
  daysBetween,
  kstToday,
} from '../../../scripts/demo-align-dates.mjs';

describe('scripts/demo-align-dates.mjs', () => {
  it('두 날짜 사이 일수', () => {
    expect(daysBetween('2026-11-12', '2026-11-13')).toBe(1);
    expect(daysBetween('2026-11-12', '2026-11-12')).toBe(0);
    expect(daysBetween('2026-11-12', '2026-11-02')).toBe(-10);
  });

  it('한국 날짜는 UTC 15시부터 다음 날', () => {
    expect(kstToday(new Date('2026-11-12T14:59:00Z'))).toBe('2026-11-12');
    expect(kstToday(new Date('2026-11-12T15:00:00Z'))).toBe('2026-11-13');
  });

  it('0일이면 아무것도 하지 않음', () => {
    expect(alignDatesSql('+821099999999', 0)).toBe('');
  });

  it('정수가 아니면 거부', () => {
    expect(() => alignDatesSql('+821099999999', 1.5)).toThrow();
  });

  it('시험 계정만 두 번에 나눠 옮기고 트리거를 다시 켬', () => {
    const sql = alignDatesSql('+821099999999', 3);
    expect(sql.startsWith('BEGIN;')).toBe(true);
    expect(sql).toContain("phone_e164 = '+821099999999'");
    expect(sql).toContain('streak_date = streak_date + 100000');
    expect(sql).toContain('streak_date = streak_date + -99997');
    const disabled = sql.match(/DISABLE TRIGGER USER/g).length;
    expect(sql.match(/ENABLE TRIGGER USER/g).length).toBe(disabled);
    expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true);
  });

  it('시드 챌린지는 참가자가 없을 때만 오늘+2/+8로 맞추고 트리거를 다시 켬', () => {
    const sql = alignSeedChallengeSql();
    expect(sql).toContain(SEED_CHALLENGE_ID);
    expect(sql).toContain('+ 2');
    expect(sql).toContain('+ 8');
    expect(sql).toContain('NOT EXISTS');
    expect(sql.match(/DISABLE TRIGGER USER/g)).toHaveLength(1);
    expect(sql.match(/ENABLE TRIGGER USER/g)).toHaveLength(1);
  });
});
