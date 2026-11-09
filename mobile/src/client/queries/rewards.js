/**
 * 포인트·상점·스트릭·업적 훅 (A70~A77).
 */
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

import queryKeys from './keys.js';
import { infiniteListOptions, flattenItems } from '../http/cursor.js';
import { useAppMutation } from './mutation.js';
import * as rewardsApi from '../api/rewardsApi.js';
import { afterShopOrder, afterBadgeChanged } from './invalidate.js';

/** A70 상점 상품 (`ShopItem[]`) */
export function useShopItems() {
  return useQuery({ queryKey: queryKeys.shopItems, queryFn: rewardsApi.getShopItems });
}

/** A71 교환하기 (멱등). 입력 `{itemId, priceVersionId, quantity}` */
export function useCreateShopOrder() {
  return useAppMutation({
    idempotent: true,
    mutationFn: rewardsApi.createShopOrder,
    onDone: afterShopOrder,
  });
}

/** A72 보관함 (`InventoryItem[]`) */
export function useInventory() {
  return useQuery({ queryKey: queryKeys.inventory, queryFn: rewardsApi.getInventory });
}

/** A73 포인트 잔액 (`PointBalance`) */
export function usePoints() {
  return useQuery({ queryKey: queryKeys.points, queryFn: rewardsApi.getPoints });
}

/**
 * A74 포인트 내역 (무한 스크롤).
 * @param {{direction?: 'earn'|'spend'}} [params]
 */
export function usePointTransactions(params = {}) {
  const query = useInfiniteQuery(infiniteListOptions({
    queryKey: queryKeys.pointTransactions(params),
    fetchPage: ({ cursor, limit }) => rewardsApi.listPointTransactions({ ...params, cursor, limit }),
  }));
  return { ...query, items: flattenItems(query.data) };
}

/** A75 스트릭 (`StreakStatus`) */
export function useStreak() {
  return useQuery({ queryKey: queryKeys.streak, queryFn: rewardsApi.getStreak });
}

/**
 * A76 업적 (`Achievement[]`).
 * @param {{rarity?: 'common'|'rare'|'legendary'}} [params]
 */
export function useAchievements(params = {}) {
  return useQuery({
    queryKey: queryKeys.achievements(params),
    queryFn: () => rewardsApi.getAchievements(params),
  });
}

/** A77 대표 배지 설정. 입력 `{achievementId}` (`null`이면 해제) */
export function useSetRepresentativeBadge() {
  return useAppMutation({
    mutationFn: rewardsApi.setRepresentativeBadge,
    onDone: afterBadgeChanged,
  });
}

export default {
  useShopItems,
  useCreateShopOrder,
  useInventory,
  usePoints,
  usePointTransactions,
  useStreak,
  useAchievements,
  useSetRepresentativeBadge,
};
