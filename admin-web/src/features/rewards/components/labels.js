import { labels } from '../../../constants/labels.js';

// Status texts and colors come from constants/labels.js (<StatusTag kind=... />). This file only
// keeps what that table does not have.

/** Select options `{value, label}` from one kind of constants/labels.js. */
export const optionsOf = (kind, values) =>
  Object.entries(labels[kind])
    .filter(([value]) => !values || values.includes(value))
    .map(([value, { text }]) => ({ value, label: text }));

export const ACHIEVEMENT_CONDITIONS = {
  first_goal_completed: '첫 목표 완료',
  approved_mission_count: '승인된 미션 수',
  category_approved_mission_count: '분야별 승인된 미션 수',
  streak_milestone: '스트릭 마일스톤',
};

export const UNLOCK_CONDITIONS = {
  none: '조건 없음',
  approved_mission_count: '승인된 미션 수',
  category_approved_mission_count: '분야별 승인된 미션 수',
  streak_milestone: '스트릭 마일스톤',
  achievement_earned: '업적 달성',
};

export const conditionOptions = (texts) =>
  Object.entries(texts).map(([value, label]) => ({ value, label }));

// A pet has 3 stages in this order (stage 1~3).
export const STAGE_CODES = ['egg', 'baby', 'adult'];
export const stageText = (stageNo) => labels.petStageCode[STAGE_CODES[stageNo - 1]].text;

export const STREAK_TARGET_DAYS = [7, 30, 100];
export const MAX_POINTS = 1_000_000;
