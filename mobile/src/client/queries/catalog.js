/**
 * 기준 데이터 훅 (A17~A19).
 * 거의 바뀌지 않으므로 앱이 사는 동안 한 번만 받는다 (`staleTime: Infinity`).
 */
import { useQuery } from '@tanstack/react-query';

import queryKeys from './keys.js';
import * as catalogApi from '../api/catalogApi.js';

const FOREVER = { staleTime: Infinity, gcTime: Infinity };

/** A17 목표 분야 (`GoalCategory[]`) */
export function useGoalCategories() {
  return useQuery({
    queryKey: queryKeys.catalog('categories'),
    queryFn: catalogApi.getGoalCategories,
    ...FOREVER,
  });
}

/** A18 난이도 (`DifficultyLevel[]`) */
export function useDifficultyLevels() {
  return useQuery({
    queryKey: queryKeys.catalog('difficulties'),
    queryFn: catalogApi.getDifficultyLevels,
    ...FOREVER,
  });
}

/** A19 운동 종류 (`ExerciseType[]`, 04 §4 고정 6종) */
export function useExerciseTypes() {
  return useQuery({
    queryKey: queryKeys.catalog('exercises'),
    queryFn: catalogApi.getExerciseTypes,
    ...FOREVER,
  });
}

export default { useGoalCategories, useDifficultyLevels, useExerciseTypes };
