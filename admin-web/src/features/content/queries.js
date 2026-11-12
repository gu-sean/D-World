import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelNotice,
  createNotice,
  createPolicyDocument,
  createRecommendationMessage,
  fetchNotices,
  fetchPolicyDocuments,
  fetchRecommendationMessages,
  publishNotice,
  publishPolicyDocument,
  updateNotice,
  updateRecommendationMessage,
} from './api.js';

export const contentKeys = {
  all: ['content'],
  notices: (params) => ['content', 'notices', params],
  policies: (params) => ['content', 'policies', params],
  messages: (params) => ['content', 'messages', params],
};

const useList = (key, fetcher, params) =>
  useQuery({
    queryKey: key(params),
    queryFn: () => fetcher(params),
    placeholderData: keepPreviousData,
  });

/** M90 */
export const useNotices = (params) => useList(contentKeys.notices, fetchNotices, params);
/** M95 */
export const usePolicyDocuments = (params) =>
  useList(contentKeys.policies, fetchPolicyDocuments, params);
/** M98 */
export const useRecommendationMessages = (params) =>
  useList(contentKeys.messages, fetchRecommendationMessages, params);

// Every change of this menu asks the menu's lists again (docs/parts/admin-web.md §7). A notice
// that points to a policy version also needs the policy list, so the whole menu is refreshed.
function useMenuMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: contentKeys.all }),
  });
}

/** M91. Call with `{body, idempotencyKey}`. */
export const useCreateNotice = () =>
  useMenuMutation(({ body, idempotencyKey }) => createNotice(body, idempotencyKey));
/** M92. Call with `{noticeId, body, idempotencyKey}`. */
export const useUpdateNotice = () =>
  useMenuMutation(({ noticeId, body, idempotencyKey }) =>
    updateNotice(noticeId, body, idempotencyKey),
  );
/** M93. Call with `{noticeId, body, idempotencyKey}`. */
export const usePublishNotice = () =>
  useMenuMutation(({ noticeId, body, idempotencyKey }) =>
    publishNotice(noticeId, body, idempotencyKey),
  );
/** M94. Call with `{noticeId, body, idempotencyKey}`. */
export const useCancelNotice = () =>
  useMenuMutation(({ noticeId, body, idempotencyKey }) =>
    cancelNotice(noticeId, body, idempotencyKey),
  );
/** M96. Call with `{body, idempotencyKey}`. */
export const useCreatePolicyDocument = () =>
  useMenuMutation(({ body, idempotencyKey }) => createPolicyDocument(body, idempotencyKey));
/** M97. Call with `{versionId, body, idempotencyKey}`. */
export const usePublishPolicyDocument = () =>
  useMenuMutation(({ versionId, body, idempotencyKey }) =>
    publishPolicyDocument(versionId, body, idempotencyKey),
  );
/** M99. Call with `{body, idempotencyKey}`. */
export const useCreateRecommendationMessage = () =>
  useMenuMutation(({ body, idempotencyKey }) => createRecommendationMessage(body, idempotencyKey));
/** M100. Call with `{messageId, body, idempotencyKey}`. */
export const useUpdateRecommendationMessage = () =>
  useMenuMutation(({ messageId, body, idempotencyKey }) =>
    updateRecommendationMessage(messageId, body, idempotencyKey),
  );
