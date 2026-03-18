import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { makeToken, seedUser } from '../../helpers/helpers';

describe('Commerce API — Promotions & Inventory', () => {
  let db: Database.Database;
  let app: any;
  let supertest: any;
  let shopperId: number;
  let shopperToken: string;
  let cartId: string;
  let productId: string;

  beforeAll(async () => {
    const { db: testDb } = await import('../../../apps/api/src/db');
    db = testDb;
    const { app: testApp } = await import('../../../apps/api/src/app');
    app = testApp;
    supertest = (await import('supertest')).default;
  });

  beforeEach(() => {
    shopperId = seedUser(db, `shopper-${uuidv4()}@test.dev`, 'shopper');
    shopperToken = makeToken({ id: shopperId, email: 'shopper@test.dev', role: 'shopper' });

    productId = uuidv4();
    db.prepare(
      "INSERT INTO com_products (id, name, description, price, inventory) VALUES (?, ?, ?, ?, ?)"
    ).run(productId, 'Test Product', 'A test product', 49.99, 10);

    const promoId = uuidv4();
    db.prepare(
      "INSERT INTO com_promotions (id, code, discountType, discountValue, maxUses) VALUES (?, ?, ?, ?, ?)"
    ).run(promoId, `SAVE10-${shopperId}`, 'percentage', 10, 100);

    cartId = uuidv4();
    db.prepare("INSERT INTO com_carts (id, userId, status) VALUES (?, ?, 'active')").run(cartId, shopperId);
    db.prepare(
      "INSERT INTO com_cart_items (id, cartId, productId, quantity) VALUES (?, ?, ?, ?)"
    ).run(uuidv4(), cartId, productId, 1);
  });

  it.fails('PROMO_CODE_STACKING: promotion code cannot be applied more than once to the same cart', async () => {
    const code = `SAVE10-${shopperId}`;

    const first = await supertest(app)
      .post('/api/commerce/promotions/validate')
      .set('Authorization', `Bearer ${shopperToken}`)
      .send({ cartId, code });

    expect(first.status).toBe(200);
    expect(first.body.discountApplied).toBeGreaterThan(0);

    const second = await supertest(app)
      .post('/api/commerce/promotions/validate')
      .set('Authorization', `Bearer ${shopperToken}`)
      .send({ cartId, code });

    // BUG PROMO_CODE_STACKING: second application currently returns 200 — stacking allowed
    expect(second.status, 'Duplicate promo application should be rejected (PROMO_CODE_STACKING)').toBe(409);
    expect(second.body.error).toBe('PROMOTION_ALREADY_APPLIED');
  });

  it('INVENTORY_OVERSELL_RACE: concurrent last-item checkout prevents oversell', async () => {
    const rareId = 'PROD-RARE-' + uuidv4();
    db.prepare(
      "INSERT INTO com_products (id, name, description, price, inventory) VALUES (?, ?, ?, ?, ?)"
    ).run(rareId, 'Limited Item', 'Only 1 left', 99.99, 1);

    const makeCart = () => {
      const cid = uuidv4();
      db.prepare("INSERT INTO com_carts (id, userId, status) VALUES (?, ?, 'active')").run(cid, shopperId);
      db.prepare(
        "INSERT INTO com_cart_items (id, cartId, productId, quantity) VALUES (?, ?, ?, ?)"
      ).run(uuidv4(), cid, rareId, 1);
      return cid;
    };

    const cart1 = makeCart();
    const cart2 = makeCart();

    const [order1, order2] = await Promise.all([
      supertest(app)
        .post('/api/commerce/orders')
        .set('Authorization', `Bearer ${shopperToken}`)
        .send({ cartId: cart1 }),
      supertest(app)
        .post('/api/commerce/orders')
        .set('Authorization', `Bearer ${shopperToken}`)
        .send({ cartId: cart2 }),
    ]);

    const results = [order1, order2];
    const succeeded = results.filter(r => r.status === 201);
    const failed = results.filter(r => r.status === 409);

    // BUG INVENTORY_OVERSELL_RACE: both may succeed with concurrent requests
    expect(succeeded.length, 'Exactly one order should succeed (INVENTORY_OVERSELL_RACE)').toBe(1);
    expect(failed.length).toBe(1);
    expect(failed[0].body.error).toBe('OUT_OF_STOCK');

    const inventory = (db.prepare('SELECT inventory FROM com_products WHERE id = ?').get(rareId) as any).inventory;
    expect(inventory, `Inventory went to ${inventory} — should be 0 (INVENTORY_OVERSELL_RACE)`).toBe(0);
  });

  it.fails('EMAIL_BEFORE_PAYMENT: order creation should not mark email as sent before payment', async () => {
    const res = await supertest(app)
      .post('/api/commerce/orders')
      .set('Authorization', `Bearer ${shopperToken}`)
      .send({ cartId });

    expect(res.status).toBe(201);

    // BUG EMAIL_BEFORE_PAYMENT: emailQueued is true even before payment is processed
    expect(res.body.emailQueued, 'Email should not be queued before payment (EMAIL_BEFORE_PAYMENT)').toBe(false);

    const order = db.prepare('SELECT emailSent FROM com_orders WHERE id = ?').get(res.body.orderId) as any;
    expect(order.emailSent, 'emailSent should be 0 before payment (EMAIL_BEFORE_PAYMENT)').toBe(0);
  });

  it('PRICE_FLOAT_PRECISION: product price must be returned with correct decimal precision', async () => {
    const res = await supertest(app).get('/api/commerce/products');

    expect(res.status).toBe(200);

    for (const product of res.body.products) {
      const priceStr = product.price.toString();
      const decimal = priceStr.includes('.') ? priceStr.split('.')[1] : '';
      expect(decimal.length, `Price ${product.price} has too many decimal places (PRICE_FLOAT_PRECISION)`).toBeLessThanOrEqual(2);
    }
  });
});
