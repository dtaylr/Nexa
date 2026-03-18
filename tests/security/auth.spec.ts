/**
 * Security test suite — authentication and authorization controls.
 *
 * Tests are organised around OWASP API Security Top 10 categories:
 * API1: Broken Object Level Authorization (IDOR)
 * API2: Broken Authentication
 * API3: Broken Object Property Level Authorization (mass assignment)
 * API5: Broken Function Level Authorization
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { makeToken, makeExpiredToken, seedUser, seedAccount } from '../helpers/helpers';

describe('Security — Auth & Authorization', () => {
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

  describe('API1 — Broken Object Level Authorization (IDOR)', () => {
    it('patient cannot access another patient\'s records via ID enumeration', async () => {
      const p1Id = seedUser(db, `idor-p1-${uuidv4()}@sec.dev`, 'patient');
      const p2Id = seedUser(db, `idor-p2-${uuidv4()}@sec.dev`, 'patient');

      const r2 = db.prepare(
        "INSERT INTO hlt_patients (userId, nhsNumber, firstName, lastName) VALUES (?, ?, ?, ?)"
      ).run(p2Id, '999 888 7777', 'Target', 'Patient');
      const targetPatientId = r2.lastInsertRowid;

      const attackerToken = makeToken({ id: p1Id, email: 'attacker@sec.dev', role: 'patient' });

      const res = await supertest(app)
        .get(`/api/HealthyU/patients/${targetPatientId}/records`)
        .set('Authorization', `Bearer ${attackerToken}`);

      // BUG PATIENT_RECORDS_IDOR: IDOR — no ownership check, returns 200 instead of 403
      expect(res.status, 'IDOR: patient accessed another patient\'s records (PATIENT_RECORDS_IDOR)').toBe(403);
    });

    it('user cannot access another user\'s financial account', async () => {
      const u1Id = seedUser(db, `fin-u1-${uuidv4()}@sec.dev`, 'banker');
      const u2Id = seedUser(db, `fin-u2-${uuidv4()}@sec.dev`, 'banker');
      const u2Account = seedAccount(db, u2Id, 50000);

      const attackerToken = makeToken({ id: u1Id, email: 'attacker@sec.dev', role: 'banker' });

      const res = await supertest(app)
        .get(`/api/BrightBank/accounts/${u2Account}`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain('50000');
    });

    it('user cannot read another user\'s cart or order', async () => {
      const owner = seedUser(db, `cart-owner-${uuidv4()}@sec.dev`, 'shopper');
      const attacker = seedUser(db, `cart-attacker-${uuidv4()}@sec.dev`, 'shopper');

      const cartId = uuidv4();
      db.prepare("INSERT INTO com_carts (id, userId, status) VALUES (?, ?, 'active')").run(cartId, owner);

      const attackerToken = makeToken({ id: attacker, email: 'attacker@sec.dev', role: 'shopper' });
      const res = await supertest(app)
        .put(`/api/commerce/cart/${cartId}/items`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ productId: 'any', quantity: 1 });

      expect(res.status).toBe(403);
    });
  });

  describe('API2 — Broken Authentication', () => {
    it('missing Authorization header returns 401', async () => {
      const [fin, hlt, com] = await Promise.all([
        supertest(app).get('/api/BrightBank/accounts'),
        supertest(app).get('/api/HealthyU/patients/1'),
        supertest(app).post('/api/commerce/cart'),
      ]);
      expect(fin.status).toBe(401);
      expect(hlt.status).toBe(401);
      expect(com.status).toBe(401);
    });

    it('malformed Bearer token returns 401', async () => {
      const res = await supertest(app)
        .get('/api/BrightBank/accounts')
        .set('Authorization', 'Bearer not.a.jwt');
      expect(res.status).toBe(401);
    });

    it('token signed with wrong secret is rejected', async () => {
      const fakeToken = require('jsonwebtoken').sign(
        { sub: 1, email: 'hacker@evil.com', role: 'admin' },
        'wrong-secret',
        { expiresIn: 3600 }
      );
      const res = await supertest(app)
        .get('/api/BrightBank/accounts')
        .set('Authorization', `Bearer ${fakeToken}`);
      expect(res.status).toBe(401);
    });

    it('token expired 2 minutes ago is rejected', async () => {
      const userId = seedUser(db, `expired-${uuidv4()}@sec.dev`, 'banker');
      const token = makeExpiredToken({ id: userId, email: 'e@sec.dev', role: 'banker' });
      const res = await supertest(app)
        .get('/api/BrightBank/accounts')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it('algorithm confusion: "none" algorithm is rejected', async () => {
      const payload = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const claims = Buffer.from(JSON.stringify({ sub: 1, role: 'admin', exp: 9999999999 })).toString('base64url');
      const noneToken = `${payload}.${claims}.`;

      const res = await supertest(app)
        .get('/api/BrightBank/accounts')
        .set('Authorization', `Bearer ${noneToken}`);
      expect(res.status).toBe(401);
    });

    it('SQL injection in login email does not cause a 500', async () => {
      const res = await supertest(app)
        .post('/api/auth/login')
        .send({ email: "' OR '1'='1", password: 'anything' });
      expect(res.status).toBeLessThan(500);
      expect(res.status).toBe(401);
    });
  });

  describe('API5 — Broken Function Level Authorization', () => {
    it('regular user cannot elevate role via registration', async () => {
      const res = await supertest(app)
        .post('/api/auth/register')
        .send({ email: `priv-${uuidv4()}@sec.dev`, password: 'password', role: 'admin' });

      if (res.status === 201) {
        expect(res.body.user.role).not.toBe('admin');
      }
    });
  });

  describe('Security Headers', () => {
    it('API responses include security headers from helmet', async () => {
      const res = await supertest(app).get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeTruthy();
    });

    it('sensitive endpoints do not expose server version', async () => {
      const res = await supertest(app).get('/api/BrightBank/accounts').set('Authorization', 'Bearer bad');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });
});
