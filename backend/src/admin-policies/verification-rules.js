import { BadRequestException } from '@nestjs/common';

/**
 * 인증 기준(verification_criteria_versions.rules_json)의 키 계약.
 * 빈 객체는 "AI 서버 기본값 사용"이다. 값이 있는 키만 AI가 기본값 대신 쓴다.
 * 모르는 키·범위를 벗어난 값은 저장하지 않는다(오타가 조용히 무시되는 것을 막음).
 */
export const RULE_KEYS = {
  minSteps: { type: 'integer', min: 0, max: 10_000_000 },
  minDurationSeconds: { type: 'integer', min: 1, max: 86_400 },
  minDistanceMeters: { type: 'number', min: 0, max: 1_000_000 },
  minConfidence: { type: 'number', min: 0, max: 1 },
  window: { type: 'window' }, // { start: 'HH:MM', end: 'HH:MM' } 이 시간대 안의 수행만 인정
};

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 문제 목록을 돌려준다. 비어 있으면 통과 */
export function checkRules(rules) {
  const problems = [];
  for (const [key, value] of Object.entries(rules)) {
    const spec = RULE_KEYS[key];
    if (!spec) {
      problems.push(`rules.${key}: 알 수 없는 기준 키`);
    } else if (spec.type === 'window') {
      const ok =
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value).every((k) => k === 'start' || k === 'end') &&
        CLOCK.test(value.start ?? '') &&
        CLOCK.test(value.end ?? '');
      if (!ok) problems.push(`rules.${key}: { start, end } 를 HH:MM 형식으로`);
    } else {
      const numeric = typeof value === 'number' && Number.isFinite(value);
      const intOk = spec.type !== 'integer' || Number.isInteger(value);
      if (!numeric || !intOk || value < spec.min || value > spec.max) {
        problems.push(
          `rules.${key}: ${spec.min}~${spec.max} 범위의 ${spec.type === 'integer' ? '정수' : '숫자'}여야 함`,
        );
      }
    }
  }
  return problems;
}

export function assertRules(rules) {
  const problems = checkRules(rules);
  if (problems.length > 0) throw new BadRequestException(problems);
}
