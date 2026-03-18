/**
 * Injection and input validation security tests.
 * OWASP API8: Security Misconfiguration
 * OWASP API4: Unrestricted Resource Consumption
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { makeToken, seedUser, seedAccount } from '../helpers/helpers';

describe('Security — Injection & Input Validation', () => {
  let db: Database.Database;
  let app: any;
  let supertest: any;

  beforeAll(async () => {
    const { db: testDb } = await import('../../apps/api/src/db');
    db = testDb;
    const { app: testApp } = await import('../../apps/api/src/app');
    app = testApp;
    supertest = (await import('supertest')).default;
  });

  describe('Input Validation — Finance', () => {
    let userId: number;
    let token: string;
    let accountId: string;
    let destId: string;

    beforeAll(() => {
      userId = seedUser(db, `inj-fin-${uuidv4()}@sec.dev`, 'banker');
      token = makeToken({ id: userId, email: 'inj@sec.dev', role: 'banker' });
      accountId = seedAccount(db, userId, 100000);
      const otherId = seedUser(db, `inj-dest-${uuidv4()}@sec.dev`, 'banker');
      destId = seedAccount(db, otherId, 0);
    });

    it('transfer with negative amount is rejected', async () => {
      const res = await supertest(app)
        .post('/api/BrightBank/transfers')
        .set('Authorization', `Bearer ${token}`)
        .send({ fromAccountId: accountId, toAccountId: destId, amount: -100, currency: 'USD' });
      expect(res.status).toBe(400);
    });

    it('transfer with zero amount is rejected', async () => {
      const res = await supertest(app)
        .post('/api/BrightBank/transfers')
        .set('Authorization', `Bearer ${token}`)
        .send({ fromAccountId: accountId, toAccountId: destId, amount: 0, currency: 'USD' });
      expect(res.status).toBe(400);
    });

    it('transfer with extremely large amount does not cause integer overflow', async () => {
      const res = await supertest(app)
        .post('/api/BrightBank/transfers')
        .set('Authorization', `Bearer ${token}`)
        .send({ fromAccountId: accountId, toAccountId: destId, amount: Number.MAX_SAFE_INTEGER, currency: 'USD' });
      expect([400, 422]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });

    it('transfer with non-numeric amount is rejected', async () => {
      const res = await supertest(app)
        .post('/api/BrightBank/transfers')
        .set('Authorization', `Bearer ${token}`)
        .send({ fromAccountId: accountId, toAccountId: destId, amount: 'DROP TABLE fin_accounts;--', currency: 'USD' });
      expect([400, 422]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });

    it('SQL injection in account ID path does not cause 500', async () => {
      const malicious = "1' OR '1'='1";
      const res = await supertest(app)
        .get(`/api/BrightBank/accounts/${encodeURIComponent(malicious)}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).not.toBe(500);
    });
  });

  describe('Input Validation — Commerce', () => {
    let userId: number;
    let token: string;
    let cartId: string;

    beforeAll(async () => {
      userId = seedUser(db, `inj-com-${uuidv4()}@sec.dev`, 'shopper');
      token = makeToken({ id: userId, email: 'inj-com@sec.dev', role: 'shopper' });
      cartId = uuidv4();
      db.prepare("INSERT INTO com_carts (id, userId, status) VALUES (?, ?, 'active')").run(cartId, userId);
      const existingProd = db.prepare("SELECT id FROM com_products WHERE id = 'PROD-SEC-TEST'").get();
      if (!existingProd) {
        db.prepare("INSERT INTO com_products (id, name, price, inventory) VALUES (?, ?, ?, ?)")
          .run('PROD-SEC-TEST', 'Test Product', 9.99, 100);
      }
    });

    it('adding negative quantity to cart is handled gracefully', async () => {
      const res = await supertest(app)
        .put(`/api/commerce/cart/${cartId}/items`)
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: 'PROD-SEC-TEST', quantity: -5 });
      expect(res.status).not.toBe(500);
    });

    it('promotion code with SQL injection payload does not cause 500', async () => {
      const res = await supertest(app)
        .post('/api/commerce/promotions/validate')
        .set('Authorization', `Bearer ${token}`)
        .send({ cartId, code: "SAVE10' OR '1'='1" });
      expect(res.status).not.toBe(500);
      expect([404, 400]).toContain(res.status);
    });

    it('oversized JSON payload is rejected or handled', async () => {
      const payload = { cartId, code: 'A'.repeat(100000) };
      const res = await supertest(app)
        .post('/api/commerce/promotions/validate')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);
      expect(res.status).not.toBe(500);
    });
  });

  describe('Path Traversal', () => {
    it('path traversal in product ID does not expose filesystem', async () => {
      const res = await supertest(app).get('/api/commerce/products/../../etc/passwd');
      expect(res.status).not.toBe(200);
      expect(res.text || '').not.toContain('root:');
    });
  });
});
