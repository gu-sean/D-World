import { BadRequestException } from '@nestjs/common';
import {
  dateString,
  integer,
  number,
  object,
  oneOf,
  string,
  uuid,
} from '../common/validation.js';
import {
  DEFAULT_LIMIT,
  EXERCISE_CODES,
  MAX_LIMIT,
  VERIFICATION_METHODS,
} from './challenges.constants.js';

/** 챌린지 컨트롤러 공용 입력 규칙(사용자·관리자 공통) */
export const limitOf = (query) => {
  if (query.limit === undefined) return DEFAULT_LIMIT;
  const limit = Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new BadRequestException([`limit: 1~${MAX_LIMIT} 정수여야 함`]);
  }
  return limit;
};
export const text = (max, optional = false) =>
  string({
    min: 1,
    max,
    pattern: /\S/,
    patternMessage: '공백만 입력할 수 없음',
    optional,
  });

export const rewardRule = (optional = false) =>
  object(
    {
      points: integer({ min: 0, max: 1_000_000 }),
      userXp: integer({ min: 0, max: 1_000_000 }),
      petXp: integer({ min: 0, max: 1_000_000 }),
      badgeAchievementVersionId: uuid({ optional: true }),
    },
    { optional },
  );

export const definitionRules = (optional) => ({
  title: text(200, optional),
  description: text(5000, optional),
  categoryId: uuid({ optional }),
  difficultyId: uuid({ optional }),
  verificationMethod: oneOf(VERIFICATION_METHODS, { optional }),
  exerciseCode: oneOf(EXERCISE_CODES, { optional: true }),
  targetValue: number({ min: 0.01, max: 99_999_999, optional: true }),
  targetUnit: text(20, true),
  estimatedDurationSeconds: integer({ min: 1, max: 86_400, optional: true }),
  startDate: dateString({ optional }),
  endDate: dateString({ optional }),
  requiredSuccessDays: integer({ min: 1, max: 30, optional: true }),
  maxParticipants: integer({ min: 1, max: 1_000_000, optional: true }),
  reward: rewardRule(optional),
});

/** 사용자 개설: 공식 챌린지 정의에서 보상을 뺀 항목 */
export const userDefinitionRules = (optional = false) => {
  const { reward, ...rules } = definitionRules(optional);
  void reward;
  return rules;
};
