import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAccountAction,
  fetchUser,
  fetchUserActivities,
  fetchUsers,
  fetchWithdrawals,
  liftAccountAction,
  updateWithdrawal,
} from './api.js';

export const userKeys = {
  all: ['users'],
  list: (params) => ['users', 'list', params],
  detail: (userId) => ['users', 'detail', userId],
  activities: (userId, params) => ['users', 'activities', userId, params],
  withdrawals: (params) => ['users', 'withdrawals', params],
};

/** M10 */
export const useUsers = (params) =>
  useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => fetchUsers(params),
    placeholderData: keepPreviousData,
  });

/** M11 */
export const useUser = (userId) =>
  useQuery({ queryKey: userKeys.detail(userId), queryFn: () => fetchUser(userId) });

/** M12 */
export const useUserActivities = (userId, params) =>
  useQuery({
    queryKey: userKeys.activities(userId, params),
    queryFn: () => fetchUserActivities(userId, params),
    placeholderData: keepPreviousData,
  });

/** M15 */
export const useWithdrawals = (params) =>
  useQuery({
    queryKey: userKeys.withdrawals(params),
    queryFn: () => fetchWithdrawals(params),
    placeholderData: keepPreviousData,
  });

// Every change of this menu asks the menu's lists and details again (docs/parts/admin-web.md §7).
function useMenuMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
}

/** M13. Call with `{userId, body, idempotencyKey}`. */
export const useCreateAccountAction = () =>
  useMenuMutation(({ userId, body, idempotencyKey }) =>
    createAccountAction(userId, body, idempotencyKey),
  );

/** M14. Call with `{actionId, body, idempotencyKey}`. */
export const useLiftAccountAction = () =>
  useMenuMutation(({ actionId, body, idempotencyKey }) =>
    liftAccountAction(actionId, body, idempotencyKey),
  );

/** M16. Call with `{requestId, body, idempotencyKey}`. */
export const useUpdateWithdrawal = () =>
  useMenuMutation(({ requestId, body, idempotencyKey }) =>
    updateWithdrawal(requestId, body, idempotencyKey),
  );
