import { randomInt, randomUUID } from 'node:crypto';
import { createTestApp } from '../support/app.js';
import { createUser } from '../support/users.js';
import { PointsService } from '../../src/points/points.service.js';

// 포인트 상점 (사용자 쪽): 상품 조회·주문·환불·보유·사용
const databaseUrl = process.env.DATABASE_URL;
const RUN = randomInt(100_000, 999_999);

describe.skipIf(!databaseUrl)('포인트 상점 (PostgreSQL)', () => {
  let app;
  let db;
  let http;
  let adminId;
  let snack; // 소모품 100P
  let hat; // 영구 상품 500P

  const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
  const get = (u, path) => http.get(`/api/v1${path}`).set(auth(u));
  const post = (u, path, body = {}, key) => {
    const req = http.post(`/api/v1${path}`).set(auth(u));
    if (key) req.set('Idempotency-Key', key);
    return req.send(body);
  };

  async function createItem(code, kind, price, extra = {}) {
    const id = randomUUID();
    await db.query(
      `INSERT INTO shop_items (id, code, name, item_kind, display_order, is_active)
       VALUES ($1, $2, $3, $4, 900, $5)`,
      [id, `${code}_${RUN}`, `${code}${RUN}`, kind, extra.active ?? true],
    );
    await db.query(
      `INSERT INTO shop_item_price_versions
         (id, item_id, version_no, price_points, effective_at, created_by_admin_id)
       VALUES ($1, $2, 1, $3, $4, $5)`,
      [
        randomUUID(),
        id,
        price,
        extra.effectiveAt ?? new Date(Date.now() - 60_000).toISOString(),
        adminId,
      ],
    );
    return id;
  }

  async function fundedUser(points) {
    const u = await createUser(app, db);
    if (points > 0) {
      await db.withTransaction((tx) =>
        app.get(PointsService).manualAdjust(tx, {
          adminId,
          userId: u.id,
          kind: 'manual_grant',
          amount: points,
          reason: '테스트 지급',
        }),
      );
    }
    return u;
  }

  const balance = async (u) =>
    Number((await get(u, '/me/points').expect(200)).body.availablePoints);

  beforeAll(async () => {
    ({ app, http, db } = await createTestApp());
    adminId = randomUUID();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash) VALUES ($1,$2,$3,'x')`,
      [adminId, `sh_${RUN}`, `${adminId}@example.com`],
    );
    snack = await createItem('snack', 'consumable', 100);
    hat = await createItem('hat', 'permanent', 500);
  });

  afterAll(async () => {
    await app.close();
  });

  it('판매 중이고 현재 가격이 있는 상품만 보임', async () => {
    const inactive = await createItem('off', 'consumable', 10, {
      active: false,
    });
    const future = await createItem('soon', 'consumable', 10, {
      effectiveAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const u = await fundedUser(0);
    const res = await get(u, '/shop/items').expect(200);
    const ids = res.body.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining([snack, hat]));
    expect(ids).not.toContain(inactive);
    expect(ids).not.toContain(future);
    expect(res.body.find((i) => i.id === snack)).toMatchObject({
      pricePoints: 100,
      itemKind: 'consumable',
      ownedQuantity: 0,
    });
  });

  describe('주문', () => {
    it('포인트를 차감하고 보유 수량을 늘림, 같은 키로 다시 보내면 한 번만 처리', async () => {
      const u = await fundedUser(1000);
      const key = randomUUID();
      const first = await post(
        u,
        '/shop/orders',
        { itemId: snack, quantity: 3 },
        key,
      ).expect(201);
      expect(first.body).toMatchObject({
        itemId: snack,
        quantity: 3,
        unitPoints: 100,
        totalPoints: 300,
        status: 'completed',
      });
      const replay = await post(
        u,
        '/shop/orders',
        { itemId: snack, quantity: 3 },
        key,
      );
      expect(replay.body.id).toBe(first.body.id);
      expect(await balance(u)).toBe(700);

      const inventory = await get(u, '/shop/inventory').expect(200);
      expect(inventory.body.items).toEqual([
        expect.objectContaining({ itemId: snack, quantity: 3 }),
      ]);
      const { rows } = await db.query(
        `SELECT kind, available_delta FROM point_transactions
          WHERE user_id = $1 AND source_type = 'shop_order'`,
        [u.id],
      );
      expect(rows).toEqual([{ kind: 'spend', available_delta: '-300' }]);
    });

    it('잔액 부족·판매 불가·없는 상품·잘못된 수량 거절', async () => {
      const u = await fundedUser(150);
      const poor = await post(u, '/shop/orders', {
        itemId: hat,
        quantity: 1,
      }).expect(422);
      expect(poor.body.error.code).toBeDefined();
      expect(await balance(u)).toBe(150);

      const inactive = await createItem('off2', 'consumable', 10, {
        active: false,
      });
      await post(u, '/shop/orders', { itemId: inactive, quantity: 1 }).expect(
        409,
      );
      await post(u, '/shop/orders', {
        itemId: randomUUID(),
        quantity: 1,
      }).expect(404);
      await post(u, '/shop/orders', { itemId: snack, quantity: 0 }).expect(400);
      await post(u, '/shop/orders', { itemId: snack, quantity: 100 }).expect(
        400,
      );
    });

    it('동시에 여러 주문을 넣어도 잔액을 넘겨 쓰지 못함', async () => {
      const u = await fundedUser(250); // 100P 상품 3개는 살 수 없음
      const results = await Promise.all(
        [1, 2, 3, 4, 5].map(() =>
          post(u, '/shop/orders', { itemId: snack, quantity: 1 }),
        ),
      );
      const ok = results.filter((r) => r.status === 201);
      expect(ok).toHaveLength(2);
      expect(results.filter((r) => r.status === 422)).toHaveLength(3);
      expect(await balance(u)).toBe(50);
      const inventory = await get(u, '/shop/inventory').expect(200);
      expect(inventory.body.items[0].quantity).toBe(2);
    });

    it('목록은 최신순 커서, 남의 주문은 404', async () => {
      const u = await fundedUser(1000);
      const other = await fundedUser(0);
      const a = await post(u, '/shop/orders', { itemId: snack, quantity: 1 });
      const b = await post(u, '/shop/orders', { itemId: snack, quantity: 2 });
      const page1 = await get(u, '/shop/orders?limit=1').expect(200);
      expect(page1.body.items[0].id).toBe(b.body.id);
      const page2 = await get(
        u,
        `/shop/orders?limit=1&cursor=${page1.body.nextCursor}`,
      ).expect(200);
      expect(page2.body.items[0].id).toBe(a.body.id);
      expect(page2.body.nextCursor).toBeNull();
      await get(other, `/shop/orders/${a.body.id}`).expect(404);
      await get(u, `/shop/orders/${a.body.id}`).expect(200);
    });
  });

  describe('취소·환불', () => {
    it('미사용 주문은 전액 환불되고 보유 수량이 줄어듦, 다시 취소는 409', async () => {
      const u = await fundedUser(1000);
      const order = await post(u, '/shop/orders', {
        itemId: hat,
        quantity: 1,
      }).expect(201);
      expect(await balance(u)).toBe(500);

      const cancelled = await post(u, `/shop/orders/${order.body.id}/cancel`, {
        reason: '마음이 바뀜',
      }).expect(200);
      expect(cancelled.body).toMatchObject({
        status: 'cancelled',
        cancelReason: '마음이 바뀜',
      });
      expect(await balance(u)).toBe(1000);
      expect((await get(u, '/shop/inventory')).body.items).toEqual([]);

      const again = await post(u, `/shop/orders/${order.body.id}/cancel`, {
        reason: '또',
      }).expect(409);
      expect(again.body.error.code).toBeDefined();
      await post(u, `/shop/orders/${order.body.id}/cancel`, {
        reason: '   ',
      }).expect(400);
    });

    it('사용한 뒤에는 취소할 수 없음', async () => {
      const u = await fundedUser(1000);
      const order = await post(u, '/shop/orders', {
        itemId: snack,
        quantity: 2,
      }).expect(201);
      await post(u, `/shop/inventory/${snack}/use`, { quantity: 1 }).expect(
        200,
      );
      const res = await post(u, `/shop/orders/${order.body.id}/cancel`, {
        reason: '환불',
      }).expect(422);
      expect(res.body.error.code).toBeDefined();
      expect(await balance(u)).toBe(800);
    });
  });

  describe('보유·사용', () => {
    it('소모품만 사용할 수 있고 수량이 모자라면 422', async () => {
      const u = await fundedUser(1000);
      await post(u, '/shop/orders', { itemId: snack, quantity: 2 }).expect(201);
      await post(u, '/shop/orders', { itemId: hat, quantity: 1 }).expect(201);

      const used = await post(u, `/shop/inventory/${snack}/use`, {}).expect(
        200,
      );
      expect(used.body).toMatchObject({
        usedQuantity: 1,
        remainingQuantity: 1,
      });
      await post(u, `/shop/inventory/${snack}/use`, { quantity: 2 }).expect(
        422,
      );
      await post(u, `/shop/inventory/${hat}/use`, {}).expect(422);
      await post(u, `/shop/inventory/${randomUUID()}/use`, {}).expect(404);

      const inventory = await get(u, '/shop/inventory').expect(200);
      const bySnack = inventory.body.items.find((i) => i.itemId === snack);
      expect(bySnack.quantity).toBe(1);
    });
  });
});
