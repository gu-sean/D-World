import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearSession, setSession } from '../../api/session.js';
import { fetchMe, login, logout } from './api.js';

export const authKeys = { me: ['auth', 'me'] };

/** M01. On success the session (token in memory) is stored. */
export const useLogin = () =>
  useMutation({
    mutationFn: login,
    onSuccess: (session) => setSession(session),
  });

/** M03. Whatever the result, the session and every cached query of this admin are dropped. */
export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearSession();
      queryClient.clear();
    },
  });
};

/** M04. */
export const useMe = () => useQuery({ queryKey: authKeys.me, queryFn: fetchMe });
