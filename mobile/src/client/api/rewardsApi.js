/**
 * 08 §9 포인트·상점·스트릭·업적 (A70~A77).
 */
import { request } from '../http/httpClient.js';

/**
 * A70 상점 상품.
 * @returns {Promise<object[]>} `ShopItem[]`
 */
export function getShopItems() {
  return request({ method: 'GET', path: '/shop/items' });
}

/**
 * A71 교환하기 (멱등 필수).
 * @param {{itemId: string, priceVersionId: string, quantity: number, idempotencyKey: string}} input
 * @returns {Promise<object>} `ShopOrder`
 */
export function createShopOrder({ idempotencyKey, ...body }) {
  return request({ method: 'POST', path: '/shop/orders', body, idempotent: true, idempotencyKey });
}

/**
 * A72 보관함.
 * @returns {Promise<object[]>} `InventoryItem[]`
 */
export function getInventory() {
  return request({ method: 'GET', path: '/me/inventory' });
}

/**
 * A73 포인트 잔액.
 * @returns {Promise<object>} `PointBalance`
 */
export function getPoints() {
  return request({ method: 'GET', path: '/me/points' });
}

/**
 * A74 포인트 내역.
 * @param {{direction?: 'earn'|'spend', cursor?: string, limit?: number}} query
 * @returns {Promise<{items: object[], nextCursor: string|null}>} `Page<PointTransaction>`
 */
export function listPointTransactions(query) {
  return request({ method: 'GET', path: '/me/point-transactions', query });
}

/**
 * A75 스트릭.
 * @returns {Promise<object>} `StreakStatus`
 */
export function getStreak() {
  return request({ method: 'GET', path: '/me/streak' });
}

/**
 * A76 업적 (공개된 것 전부 + 내 진행 상태).
 * @param {{rarity?: 'common'|'rare'|'legendary'}} [query]
 * @returns {Promise<object[]>} `Achievement[]`
 */
export function getAchievements(query) {
  return request({ method: 'GET', path: '/achievements', query });
}

/**
 * A77 대표 배지 설정. `achievementId: null`이면 해제.
 * @param {{achievementId: string|null}} input
 * @returns {Promise<null>}
 */
export function setRepresentativeBadge({ achievementId }) {
  return request({ method: 'PUT', path: '/me/representative-badge', body: { achievementId } });
}

export default {
  getShopItems,
  createShopOrder,
  getInventory,
  getPoints,
  listPointTransactions,
  getStreak,
  getAchievements,
  setRepresentativeBadge,
};
