/**
 * 기준 데이터 가짜 응답 (A17~A19). 07 §3 모양.
 * 값은 `db/seeds/dev/`와 04 §4의 고정 목록을 따른다.
 */

/** A17 `GoalCategory[]` */
export const goalCategories = [
  { code: 'exercise', name: '운동', displayOrder: 1 },
  { code: 'study', name: '학습', displayOrder: 2 },
  { code: 'lifestyle', name: '생활습관', displayOrder: 3 },
];

/** A18 `DifficultyLevel[]` */
export const difficultyLevels = [
  { code: 'easy', name: '쉬움', displayOrder: 1 },
  { code: 'normal', name: '보통', displayOrder: 2 },
  { code: 'hard', name: '어려움', displayOrder: 3 },
];

/** A19 `ExerciseType[]` — 04 §4 고정 6종, 범위는 11 §8.2 */
export const exerciseTypes = [
  { code: 'push_up', name: '푸시업', verificationMethod: 'camera', targetUnit: 'reps', minTarget: 1, maxTarget: 100 },
  { code: 'burpee', name: '버피 테스트', verificationMethod: 'camera', targetUnit: 'reps', minTarget: 1, maxTarget: 50 },
  { code: 'squat', name: '스쿼트', verificationMethod: 'camera', targetUnit: 'reps', minTarget: 1, maxTarget: 200 },
  { code: 'lunge', name: '런지', verificationMethod: 'camera', targetUnit: 'reps', minTarget: 2, maxTarget: 100 },
  { code: 'plank', name: '플랭크', verificationMethod: 'camera', targetUnit: 'seconds', minTarget: 10, maxTarget: 90 },
  { code: 'running', name: '러닝', verificationMethod: 'sensor', targetUnit: 'meters', minTarget: 500, maxTarget: 21000 },
];

export default { goalCategories, difficultyLevels, exerciseTypes };
