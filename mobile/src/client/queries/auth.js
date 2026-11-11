/**
 * 로그인·가입 훅 (A01~A10) + `useSession` (parts/mobile-client §4.2).
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';

import config from '../config.js';
import queryKeys from './keys.js';
import { useAppMutation } from './mutation.js';
import * as authApi from '../api/authApi.js';
import session, { subscribe, getSnapshot } from '../auth/session.js';
import { validateNickname } from '../validation/rules.js';

/** A03 닉네임 확인을 보내기 전에 기다리는 시간 (parts/mobile-client §4.2). */
export const NICKNAME_DEBOUNCE_MS = 400;

/**
 * 세션 상태.
 * @returns {{status: 'restoring'|'signedOut'|'signedIn', profile: object|null, signOut: () => Promise<void>}}
 */
export function useSession() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { status: snapshot.status, profile: snapshot.profile, signOut: session.signOut };
}

/** A01 인증번호 보내기. 입력 `{phoneNumber, purpose}` */
export function useRequestPhoneVerification() {
  return useAppMutation({ mutationFn: authApi.requestPhoneVerification });
}

/** A02 인증번호 확인. 입력 `{verificationId, code}` → `PhoneVerificationConfirmed` */
export function useConfirmPhoneVerification() {
  return useAppMutation({ mutationFn: authApi.confirmPhoneVerification });
}

/**
 * A03 닉네임 중복 확인.
 * 형식이 맞을 때만, 입력이 멈추고 400ms 뒤에 한 번 보낸다.
 * @param {string} nickname
 */
export function useNicknameAvailability(nickname) {
  const [debounced, setDebounced] = useState(nickname);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(nickname), NICKNAME_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [nickname]);

  const valid = validateNickname(debounced).ok;

  return useQuery({
    queryKey: queryKeys.nicknameAvailability(debounced),
    queryFn: () => authApi.checkNicknameAvailability(debounced),
    enabled: valid,
    staleTime: 0,
  });
}

/** A04 현재 약관 문서 */
export function useCurrentPolicies() {
  return useQuery({
    queryKey: queryKeys.currentPolicies,
    queryFn: authApi.getCurrentPolicies,
    staleTime: 5 * 60 * 1000,
  });
}

/** A05 가입. 성공하면 세션을 열어 `signedIn`이 된다. */
export function useSignup() {
  return useAppMutation({
    mutationFn: async (input) => {
      const result = await authApi.signup(input);
      await session.signIn(result);
      return result;
    },
  });
}

/** A06 휴대폰 로그인. 성공하면 세션을 연다. */
export function useLogin() {
  return useAppMutation({
    mutationFn: async (input) => {
      const result = await authApi.login(input);
      await session.signIn(result);
      return result;
    },
  });
}

/**
 * A07 소셜 로그인. 입력 `{provider}` (개발 모드) 또는 `{provider, credential}`.
 *
 * `SOCIAL_LOGIN_MODE=mock`이면 SDK를 부르지 않고
 * `mock:dev-{provider}-1:dev@example.com`을 `credential`로 보낸다 (12 §8.4).
 * 응답이 `SocialSignupRequired`면 아직 회원이 아니므로 **세션을 저장하지 않는다**.
 */
export function useSocialLogin() {
  return useAppMutation({
    mutationFn: async ({ provider, credential }) => {
      const value = credential
        ?? (config.SOCIAL_LOGIN_MODE === 'mock'
          ? `mock:dev-${provider}-1:dev@example.com`
          : undefined);
      const result = await authApi.socialLogin({ provider, credential: value });
      if (result?.signupRequired) return result;
      await session.signIn(result);
      return result;
    },
  });
}

/** A08 비밀번호 재설정. 입력 `{verificationToken, newPassword}` */
export function useResetPassword() {
  return useAppMutation({ mutationFn: authApi.resetPassword });
}

/** A10 로그아웃. 서버 호출이 실패해도 로컬 세션은 끊는다. */
export function useLogout() {
  return useAppMutation({ mutationFn: () => session.signOut() });
}

export default {
  useSession,
  useRequestPhoneVerification,
  useConfirmPhoneVerification,
  useNicknameAvailability,
  useCurrentPolicies,
  useSignup,
  useLogin,
  useSocialLogin,
  useResetPassword,
  useLogout,
};
