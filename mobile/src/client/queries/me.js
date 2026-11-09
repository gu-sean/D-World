/**
 * 내 정보 훅 (A11~A14). 푸시 등록(A15·A16)은 `setup/pushRegistration.js`가 직접 부른다.
 */
import { useQuery } from '@tanstack/react-query';

import queryKeys from './keys.js';
import { useAppMutation } from './mutation.js';
import * as meApi from '../api/meApi.js';
import { afterProfileChanged } from './invalidate.js';
import session from '../auth/session.js';

/** A11 내 정보 (`Me`) */
export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: meApi.getMe });
}

/** A12 프로필 수정. 입력 `{nickname?, notificationEnabled?}` */
export function useUpdateProfile() {
  return useAppMutation({
    mutationFn: meApi.updateProfile,
    onDone: afterProfileChanged,
  });
}

/** A13 약관 재동의. 입력 `{consents: ConsentInput[]}` */
export function useSubmitConsents() {
  return useAppMutation({
    mutationFn: meApi.submitConsents,
    onDone: afterProfileChanged,
  });
}

/**
 * A14 탈퇴 신청 (멱등 필수).
 * 성공하면 서버가 모든 세션을 폐기하므로 로컬 세션도 바로 끊는다.
 */
export function useRequestWithdrawal() {
  return useAppMutation({
    idempotent: true,
    mutationFn: async (input) => {
      const result = await meApi.requestWithdrawal(input);
      await session.endSession();
      return result;
    },
  });
}

export default { useMe, useUpdateProfile, useSubmitConsents, useRequestWithdrawal };
