/**
 * 변경 훅 공통 틀 (parts/mobile-client §3.2·§4.1).
 *
 * 모든 변경 훅이 똑같이 해야 하는 두 가지를 여기 모았다.
 *  1. 멱등 키는 `mutate(vars)`가 불릴 때 정한다. `vars.idempotencyKey`가 있으면 그걸 쓴다.
 *     → "다시 시도"가 **같은 키**로 가야 서버가 두 번 처리하지 않는다 (05 §5.1).
 *  2. 성공하면 §5.2 표대로 캐시를 무효화한다.
 *
 * 돌려주는 값은 `useMutation` 결과 + `retry()`다.
 */
import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { newIdempotencyKey } from '../http/idempotency.js';

/**
 * @param {object} options
 * @param {(vars: any) => Promise<any>} options.mutationFn 실제 API 호출
 * @param {boolean} [options.idempotent=false] 08에 "멱등: 필수"로 적힌 API인지
 * @param {(queryClient: import('@tanstack/react-query').QueryClient, data: any, vars: any) => void} [options.onDone]
 *        성공 후 캐시 무효화 (`queries/invalidate.js`의 함수)
 * @returns {object} `useMutation` 결과 + `retry(options?)`
 */
export function useAppMutation({ mutationFn, idempotent = false, onDone }) {
  const queryClient = useQueryClient();
  const lastVars = useRef(null);

  const mutation = useMutation({
    mutationFn: (vars) => {
      const prepared = idempotent
        ? { ...(vars ?? {}), idempotencyKey: vars?.idempotencyKey ?? newIdempotencyKey() }
        : vars;
      lastVars.current = prepared;
      return mutationFn(prepared);
    },
    onSuccess: (data, vars) => {
      onDone?.(queryClient, data, vars);
    },
  });

  return {
    ...mutation,
    /**
     * 직전과 **같은 입력·같은 멱등 키**로 다시 보낸다 (§3.2).
     * 아직 한 번도 안 보냈으면 아무 일도 하지 않는다.
     */
    retry(options) {
      if (lastVars.current === null) return;
      mutation.mutate(lastVars.current, options);
    },
  };
}

export default useAppMutation;
