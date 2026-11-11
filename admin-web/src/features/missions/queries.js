import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addFeatured,
  createCatalogItem,
  createDefinition,
  createRewardRate,
  fetchCatalog,
  fetchDefinition,
  fetchDefinitions,
  fetchFeatured,
  fetchRewardRates,
  removeFeatured,
  reviewDefinition,
  updateCatalogItem,
  updateDefinition,
} from './api.js';

export const missionKeys = {
  definitions: ['missions', 'definitions'],
  definitionList: (params) => ['missions', 'definitions', 'list', params],
  definition: (id) => ['missions', 'definitions', 'detail', id],
  catalog: (kind) => ['missions', 'catalog', kind],
  featured: ['missions', 'featured'],
  rewardRates: (params) => ['missions', 'reward-rates', params],
};

/** M42 */
export const useDefinitions = (params) =>
  useQuery({
    queryKey: missionKeys.definitionList(params),
    queryFn: () => fetchDefinitions(params),
    placeholderData: keepPreviousData,
  });

/** M43 */
export const useDefinition = (id) =>
  useQuery({
    queryKey: missionKeys.definition(id),
    queryFn: () => fetchDefinition(id),
    enabled: Boolean(id),
  });

// Mutation variables always carry `idempotencyKey` (created once per user action).

/** M40. variables: `{body, idempotencyKey}` */
export const useCreateDefinition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }) => createDefinition(body, idempotencyKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: missionKeys.definitions }),
  });
};

/** M41. variables: `{id, body, idempotencyKey}` */
export const useUpdateDefinition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, idempotencyKey }) => updateDefinition(id, body, idempotencyKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: missionKeys.definitions }),
  });
};

/** M44. variables: `{id, body: {decision, reason}, idempotencyKey}` */
export const useReviewDefinition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, idempotencyKey }) => reviewDefinition(id, body, idempotencyKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: missionKeys.definitions }),
  });
};

/** kind: 'categories' | 'difficulties' */
export const useCatalog = (kind) =>
  useQuery({ queryKey: missionKeys.catalog(kind), queryFn: () => fetchCatalog(kind) });

/** variables: `{body, idempotencyKey}` */
export const useCreateCatalogItem = (kind) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }) => createCatalogItem(kind, body, idempotencyKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: missionKeys.catalog(kind) }),
  });
};

/** variables: `{id, body, idempotencyKey}` */
export const useUpdateCatalogItem = (kind) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, idempotencyKey }) => updateCatalogItem(kind, id, body, idempotencyKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: missionKeys.catalog(kind) }),
  });
};

/** M74 */
export const useRewardRates = (params) =>
  useQuery({ queryKey: missionKeys.rewardRates(params), queryFn: () => fetchRewardRates(params) });

/** M75. variables: `{body, idempotencyKey}` */
export const useCreateRewardRate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }) => createRewardRate(body, idempotencyKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['missions', 'reward-rates'] }),
  });
};

/** Featured missions (assumed API, see api.js) */
export const useFeatured = () =>
  useQuery({ queryKey: missionKeys.featured, queryFn: fetchFeatured });

/** variables: `{body: {definitionId, reason}, idempotencyKey}` */
export const useAddFeatured = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }) => addFeatured(body, idempotencyKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: missionKeys.featured }),
  });
};

/** variables: `{id, body: {reason}, idempotencyKey}` */
export const useRemoveFeatured = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, idempotencyKey }) => removeFeatured(id, body, idempotencyKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: missionKeys.featured }),
  });
};
