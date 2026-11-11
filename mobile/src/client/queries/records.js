/**
 * 수행 인증 훅 (A41·A42·A46). 촬영·러닝 흐름 자체는 `flows/`에 있다.
 */
import { useQuery } from '@tanstack/react-query';

import queryKeys from './keys.js';
import { useAppMutation } from './mutation.js';
import * as recordsApi from '../api/recordsApi.js';
import { afterVerificationDecided } from './invalidate.js';
import { FINAL_STATUSES } from '../flows/waitForDecision.js';

/**
 * A41 회차 조회 (결과 화면 VERIFY-07·08, MISSION-13).
 * 아직 판정 전이면 2초마다 다시 본다 — 흐름 밖에서 결과 화면만 열었을 때를 위해서다.
 * @param {string} recordId
 */
export function useRecord(recordId) {
  return useQuery({
    queryKey: queryKeys.record(recordId),
    queryFn: () => recordsApi.getRecord(recordId),
    enabled: Boolean(recordId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return false;
      return FINAL_STATUSES.includes(status) || status === 'aborted' ? false : 2000;
    },
  });
}

/** A42 회차 그만하기. 입력 `{recordId}` */
export function useAbortRecord() {
  return useAppMutation({
    mutationFn: ({ recordId }) => recordsApi.abortRecord(recordId),
    onDone: afterVerificationDecided,
  });
}

/** A46 이의 제기 (멱등). 입력 `{resultId, reason}` — `reason`은 10~500자 */
export function useAppeal() {
  return useAppMutation({
    idempotent: true,
    mutationFn: recordsApi.createAppeal,
    onDone: (queryClient) => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
    },
  });
}

export default { useRecord, useAbortRecord, useAppeal };
