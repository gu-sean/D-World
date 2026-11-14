import { parseLimit } from '../common/pagination/limit.js';
import {
  dateString,
  integer,
  number,
  object,
  oneOf,
  string,
  shortId,
} from '../common/validation.js';
import {
  DEFAULT_LIMIT,
  EXERCISE_CODES,
  MAX_LIMIT,
} from './challenges.constants.js';
import { VERIFICATION_METHODS } from '../missions/missions.constants.js';

/** 챌린지 컨트롤러 공용 입력 규칙(사용자·관리자 공통) */
export const limitOf = (query) => parseLimit(query, DEFAULT_LIMIT, MAX_LIMIT);
export const text = (max, optional = false) =>
  string({
    min: 1,
    max,
    pattern: /\S/,
    patternMessage: '공백만 입력할 수 없음',
    optional,
  });

const rewardRule = (optional = false) =>
  object(
    {
      points: integer({ min: 0, max: 1_000_000 }),
      // 사용자 XP는 관리자 화면에서 뺐다 (없으면 등록 0, 수정은 지금 값 유지)
      userXp: integer({ min: 0, max: 1_000_000, optional: true }),
      petXp: integer({ min: 0, max: 1_000_000 }),
      badgeAchievementVersionId: shortId({ optional: true }),
    },
    { optional },
  );

export const definitionRules = (optional) => ({
  title: text(200, optional),
  description: text(5000, optional),
  categoryId: shortId({ optional }),
  difficultyId: shortId({ optional }),
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
