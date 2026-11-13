import { checkRules } from '../../../src/admin-policies/verification-rules.js';

describe('인증 기준 키 계약', () => {
  it('빈 규칙과 알려진 키는 통과', () => {
    expect(checkRules({})).toEqual([]);
    expect(
      checkRules({
        minSteps: 3000,
        minDurationSeconds: 300,
        minDistanceMeters: 300.5,
        minConfidence: 0.7,
        window: { start: '06:00', end: '22:00' },
      }),
    ).toEqual([]);
  });

  it('모르는 키는 거부(오타 방지)', () => {
    expect(checkRules({ minStep: 1 })).toEqual([
      'rules.minStep: 알 수 없는 기준 키',
    ]);
  });

  it('범위·형식을 벗어나면 키별로 알려 줌', () => {
    const problems = checkRules({
      minSteps: -1,
      minDurationSeconds: 1.5,
      minConfidence: 2,
      minDistanceMeters: '300',
      window: { start: '6:00', end: '22:00' },
    });
    expect(problems).toHaveLength(5);
    expect(problems.every((p) => p.startsWith('rules.'))).toBe(true);
  });

  it('window에 다른 키가 섞이면 거부', () => {
    expect(
      checkRules({ window: { start: '06:00', end: '22:00', x: 1 } }),
    ).toHaveLength(1);
  });
});
