import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCriteria,
  decideVerification,
  fetchAppeal,
  fetchAppeals,
  fetchCategories,
  fetchCriteria,
  fetchVerification,
  fetchVerificationRoute,
  fetchVerifications,
  resolveAppeal,
} from './api.js';
import { dashboardKeys } from '../dashboard/queries.js';
import { REFERENCE_STALE_MS } from '../../api/staleTime.js';

export const verificationKeys = {
  all: ['verifications'],
  list: (params) => ['verifications', 'list', params],
  detail: (id) => ['verifications', 'detail', id],
  route: (id) => ['verifications', 'route', id],
  appeals: (params) => ['verifications', 'appeals', params],
  appeal: (id) => ['verifications', 'appeal', id],
  categories: ['verifications', 'categories'],
  criteria: (params) => ['verifications', 'criteria', params],
};

export const useVerifications = (params) =>
  useQuery({
    queryKey: verificationKeys.list(params),
    queryFn: () => fetchVerifications(params),
    placeholderData: keepPreviousData,
  });

export const useVerification = (recordId) =>
  useQuery({
    queryKey: verificationKeys.detail(recordId),
    queryFn: () => fetchVerification(recordId),
  });

/** Route of a running record. A missing raw file (404) is a normal case, so it is not retried. */
export const useVerificationRoute = (recordId) =>
  useQuery({
    queryKey: verificationKeys.route(recordId),
    queryFn: () => fetchVerificationRoute(recordId),
    retry: false,
  });

/** After a decision the record, the lists and the appeals are stale. */
const useInvalidateAll = () => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: verificationKeys.all }),
      // 대시보드의 대기 건수(이의 신청·AI 판정 보류)도 바뀐다
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    ]);
};

export const useDecideVerification = () => {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: decideVerification, onSuccess: invalidate });
};

export const useAppeals = (params) =>
  useQuery({
    queryKey: verificationKeys.appeals(params),
    queryFn: () => fetchAppeals(params),
    placeholderData: keepPreviousData,
  });

export const useAppeal = (appealId) =>
  useQuery({
    queryKey: verificationKeys.appeal(appealId),
    queryFn: () => fetchAppeal(appealId),
  });

export const useResolveAppeal = () => {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: resolveAppeal, onSuccess: invalidate });
};

export const useCategories = () =>
  useQuery({
    queryKey: verificationKeys.categories,
    queryFn: fetchCategories,
    staleTime: REFERENCE_STALE_MS,
  });

export const useCriteria = (params) =>
  useQuery({
    queryKey: verificationKeys.criteria(params),
    queryFn: () => fetchCriteria(params),
  });

export const useCreateCriteria = () => {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: createCriteria, onSuccess: invalidate });
};
