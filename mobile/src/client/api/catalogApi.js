/**
 * 08 §2 기준 데이터 (A17~A19). 거의 바뀌지 않으므로 훅에서 `staleTime: Infinity`로 쓴다.
 */
import { request } from '../http/httpClient.js';

/**
 * A17 목표 분야 (`is_active`만, `displayOrder` 순).
 * @returns {Promise<Array<{code: string, name: string, displayOrder: number}>>} `GoalCategory[]`
 */
export function getGoalCategories() {
  return request({ method: 'GET', path: '/goal-categories' });
}

/**
 * A18 난이도.
 * @returns {Promise<Array<{code: string, name: string, displayOrder: number}>>} `DifficultyLevel[]`
 */
export function getDifficultyLevels() {
  return request({ method: 'GET', path: '/difficulty-levels' });
}

/**
 * A19 운동 종류 (04 §4 고정 6종).
 * @returns {Promise<Array<{code: string, name: string, verificationMethod: string,
 *   targetUnit: string, minTarget: number, maxTarget: number}>>} `ExerciseType[]`
 */
export function getExerciseTypes() {
  return request({ method: 'GET', path: '/exercise-types' });
}

export default { getGoalCategories, getDifficultyLevels, getExerciseTypes };
