import { randomUUID } from 'node:crypto';
import { Dependencies, Injectable } from '@nestjs/common';
import {
  conflict,
  notFound,
  unprocessable,
} from '../common/errors/http-errors.js';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor.js';
import { DatabaseService } from '../database/database.service.js';
import { PointsService } from '../points/points.service.js';

const CURRENT_PRICE = `(SELECT pv.id FROM shop_item_price_versions pv
                         WHERE pv.item_id = i.id AND pv.effective_at <= now()
                         ORDER BY pv.effective_at DESC, pv.version_no DESC LIMIT 1)`;

const orderView = (row) => ({
  id: row.id,
  itemId: row.item_id,
  itemCode: row.item_code,
  itemName: row.item_name,
  quantity: row.quantity,
  unitPoints: row.unit_points,
  totalPoints: Number(row.total_points),
  status: row.status,
  cancelReason: row.cancel_reason,
  createdAt: row.created_at,
  cancelledAt: row.cancelled_at,
});

const ORDER_SELECT = `SELECT o.*, o.created_at::text AS created_at_raw,
       i.code AS item_code, i.name AS item_name
  FROM shop_orders o JOIN shop_items i ON i.id = o.item_id`;

/**
 * 포인트 상점: 상품 조회·주문·환불·보유 수량·사용 (docs/database/17-shop-policy.md)
 * 잠금 순서: 지갑 → 주문/재고, 지갑을 잠그는 PointsService 메서드를 가장 먼저 부른다
 */
@Injectable()
@Dependencies(DatabaseService, PointsService)
export class ShopService {
  constructor(database, points) {
    this.database = database;
    this.points = points;
  }

  /** 판매 중인 상품(현재 적용 가격이 있는 것)과 내 보유 수량 */
  async listItems(userId) {
    const { rows } = await this.database.query(
      `SELECT i.id, i.code, i.name, i.description, i.item_kind, i.display_order,
              i.is_active, pv.id AS price_version_id,
              pv.price_points, COALESCE(inv.quantity, 0) AS owned
         FROM shop_items i
         JOIN shop_item_price_versions pv ON pv.id = ${CURRENT_PRICE}
         LEFT JOIN user_inventory inv
                ON inv.item_id = i.id AND inv.user_id = $1
        WHERE i.is_active
        ORDER BY i.display_order, i.id`,
      [userId],
    );
    // 모바일 A70은 ShopItem 배열을 그대로 받는다
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      itemKind: row.item_kind,
      priceVersionId: row.price_version_id,
      pricePoints: row.price_points,
      ownedQuantity: row.owned,
      imageUrl: null,
      displayOrder: row.display_order,
      isActive: row.is_active,
    }));
  }

  /**
   * 주문: 지갑 잠금·결제(spend) → 주문 → 보유 수량(purchase 이벤트)을 한 트랜잭션으로
   * idempotencyKey는 요청의 Idempotency-Key, 같은 키로 이미 만든 주문이 있으면 그 주문을 돌려줌
   */
  async purchase(
    userId,
    { itemId, quantity, idempotencyKey, priceVersionId: expectedPriceVersion },
  ) {
    return this.database.withTransaction(async (tx) => {
      const { rows: item } = await tx.query(
        `SELECT i.id, i.is_active, pv.id AS price_version_id, pv.price_points
           FROM shop_items i
           LEFT JOIN shop_item_price_versions pv ON pv.id = ${CURRENT_PRICE}
          WHERE i.id = $1`,
        [itemId],
      );
      if (item.length === 0) {
        throw notFound('item_not_found', '상품을 찾을 수 없음');
      }
      if (!item[0].is_active || !item[0].price_version_id) {
        throw conflict('item_unavailable', '지금은 살 수 없는 상품');
      }
      const { price_version_id: priceVersionId, price_points: unit } = item[0];
      // 앱이 본 가격 버전과 다르면 가격이 바뀐 것 (모바일 SHOP_PRICE_CHANGED)
      if (expectedPriceVersion && expectedPriceVersion !== priceVersionId) {
        throw conflict('price_changed', '가격이 바뀜');
      }

      const orderId = randomUUID();
      const spendId = await this.points.spendForShopOrder(tx, {
        userId,
        orderId,
        amount: unit * quantity,
      });
      await tx.query(
        `INSERT INTO shop_orders
           (id, user_id, item_id, price_version_id, quantity, unit_points,
            spend_transaction_id, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          orderId,
          userId,
          itemId,
          priceVersionId,
          quantity,
          unit,
          spendId,
          idempotencyKey,
        ],
      );
      await tx.query(
        `INSERT INTO user_inventory_events
           (id, user_id, item_id, kind, quantity_delta, order_id, idempotency_key)
         VALUES ($1, $2, $3, 'purchase', $4, $5, $6)`,
        [
          randomUUID(),
          userId,
          itemId,
          quantity,
          orderId,
          `shop_order:${orderId}:purchase`,
        ],
      );
      const order = await this.getOrder(userId, orderId, tx);
      const { rows: wallet } = await tx.query(
        'SELECT available_points FROM point_wallets WHERE user_id = $1',
        [userId],
      );
      return {
        ...order,
        balanceAfter: Number(wallet[0]?.available_points ?? 0),
      };
    });
  }

  async getOrder(userId, orderId, db = this.database) {
    const { rows } = await db.query(
      `${ORDER_SELECT} WHERE o.id = $1 AND o.user_id = $2`,
      [orderId, userId],
    );
    if (rows.length === 0) {
      throw notFound('order_not_found', '주문을 찾을 수 없음');
    }
    return orderView(rows[0]);
  }

  async listOrders(userId, { limit, cursor }) {
    const after = decodeCursor(cursor);
    const { rows } = await this.database.query(
      `${ORDER_SELECT}
        WHERE o.user_id = $1
          AND ($2::timestamptz IS NULL
               OR (o.created_at, o.id) < ($2::timestamptz, $3::uuid))
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT $4`,
      [userId, after.t, after.id, limit + 1],
    );
    const page = rows.slice(0, limit);
    return {
      items: page.map(orderView),
      nextCursor:
        rows.length > limit
          ? encodeCursor(page[page.length - 1], 'created_at_raw')
          : null,
    };
  }

  /**
   * 주문 취소·환불: 해당 상품을 주문 이후 사용하지 않았을 때만 가능
   * refund 거래(필요하면 미회수액 정산) → 주문 취소 → 보유 수량 환수를 한 트랜잭션으로
   */
  async cancelOrder(userId, orderId, reason) {
    return this.database.withTransaction(async (tx) => {
      await this.points.lockUserWallet(tx, userId);
      const { rows } = await tx.query(
        'SELECT * FROM shop_orders WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [orderId, userId],
      );
      if (rows.length === 0) {
        throw notFound('order_not_found', '주문을 찾을 수 없음');
      }
      const order = rows[0];
      if (order.status !== 'completed') {
        throw conflict('order_not_cancellable', '이미 취소된 주문');
      }
      const { rows: used } = await tx.query(
        `SELECT 1 FROM user_inventory_events
          WHERE user_id = $1 AND item_id = $2 AND kind = 'use'
            AND occurred_at >= $3 LIMIT 1`,
        [userId, order.item_id, order.created_at],
      );
      if (used.length > 0) {
        throw unprocessable(
          'order_item_used',
          '사용한 상품이 있어 취소할 수 없음',
        );
      }
      const refundId = await this.points.refundShopOrder(tx, {
        userId,
        orderId,
        amount: Number(order.total_points),
        spendTransactionId: order.spend_transaction_id,
      });
      await tx.query(
        `UPDATE shop_orders
            SET status = 'cancelled', refund_transaction_id = $2,
                cancelled_at = now(), cancel_reason = $3
          WHERE id = $1`,
        [orderId, refundId, reason.trim()],
      );
      await tx.query(
        `INSERT INTO user_inventory_events
           (id, user_id, item_id, kind, quantity_delta, order_id, idempotency_key)
         VALUES ($1, $2, $3, 'refund', $4, $5, $6)`,
        [
          randomUUID(),
          userId,
          order.item_id,
          -order.quantity,
          orderId,
          `shop_order:${orderId}:refund`,
        ],
      );
      return this.getOrder(userId, orderId, tx);
    });
  }

  async listInventory(userId) {
    const { rows } = await this.database.query(
      `SELECT i.id, i.code, i.name, i.item_kind, inv.quantity, inv.updated_at
         FROM user_inventory inv JOIN shop_items i ON i.id = inv.item_id
        WHERE inv.user_id = $1 AND inv.quantity > 0
        ORDER BY i.display_order, i.id`,
      [userId],
    );
    return {
      items: rows.map((row) => ({
        itemId: row.id,
        code: row.code,
        name: row.name,
        itemKind: row.item_kind,
        quantity: row.quantity,
        updatedAt: row.updated_at,
      })),
    };
  }

  /**
   * 소모품 사용: 보유 수량만 줄이고 사용 내역을 남김 (효과는 아직 정해지지 않아 기록만)
   * 영구 상품은 사용 개념이 없어 거절, 수량이 모자라면 422
   */
  async useItem(userId, { itemId, quantity, idempotencyKey }) {
    return this.database.withTransaction(async (tx) => {
      const { rows: item } = await tx.query(
        'SELECT item_kind FROM shop_items WHERE id = $1',
        [itemId],
      );
      if (item.length === 0) {
        throw notFound('item_not_found', '상품을 찾을 수 없음');
      }
      if (item[0].item_kind !== 'consumable') {
        throw unprocessable('item_not_usable', '사용하는 상품이 아님');
      }
      const { rows: inv } = await tx.query(
        `SELECT quantity FROM user_inventory
          WHERE user_id = $1 AND item_id = $2 FOR UPDATE`,
        [userId, itemId],
      );
      if (!inv[0] || inv[0].quantity < quantity) {
        throw unprocessable('insufficient_quantity', '보유 수량이 부족함');
      }
      await tx.query(
        `INSERT INTO user_inventory_events
           (id, user_id, item_id, kind, quantity_delta, idempotency_key)
         VALUES ($1, $2, $3, 'use', $4, $5)`,
        [
          randomUUID(),
          userId,
          itemId,
          -quantity,
          `use:${userId}:${idempotencyKey}`,
        ],
      );
      const { rows } = await tx.query(
        `SELECT quantity FROM user_inventory WHERE user_id = $1 AND item_id = $2`,
        [userId, itemId],
      );
      return {
        itemId,
        usedQuantity: quantity,
        remainingQuantity: rows[0].quantity,
      };
    });
  }
}
