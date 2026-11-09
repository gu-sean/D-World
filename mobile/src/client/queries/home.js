/**
 * 홈 훅 (A29).
 */
import { useQuery } from '@tanstack/react-query';

import queryKeys from './keys.js';
import * as homeApi from '../api/homeApi.js';
import { todayKst } from '../format/format.js';

/**
 * A29 홈 요약.
 * @param {string} [date] `YYYY-MM-DD`. 없으면 오늘(KST)
 */
export function useHome(date) {
  const day = date ?? todayKst();
  return useQuery({
    queryKey: queryKeys.home(day),
    queryFn: () => homeApi.getHome(day),
  });
}

export default { useHome };
