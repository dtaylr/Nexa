import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { makeToken, makeExpiredToken, makeRecentlyExpiredToken, seedUser, seedAccount, getAccountBalance } from '../../helpers/helpers';

describe('Finance API — Precision & Concurrency', () => {
  let db: Database.Database;
  let app: any;
  let supertest: any;
  let aliceId: number;
  let aliceToken: string;
  let aliceAccountId: string;
  let bobAccountId: string;

  beforeAll(async () => {
    const { db: testDb } = await import('../../../apps/api/src/db');
    db = testDb;
    const { app: testApp } = await import('../../../apps/api/src/app');
    app = testApp;
    supertest = (await import('supertest')).default;
  });

  beforeEach(() => {
    aliceId = seedUser(db, `alice-${uuidv4()}@test.dev`, 'banker');
    const bobId = seedUser(db, `bob-${uuidv4()}@test.dev`, 'banker');
    aliceToken = makeToken({ id: aliceId, email: 'alice@test.dev', role: 'banker' });
    aliceAccountId = seedAccount(db, aliceId, 10000);
    bobAccountId = seedAccount(db, bobId, 0);
  });

  it.fails('SUMMARY_FLOAT_DRIFT: monthly summary exposes floating-point arithmetic errors', async () => {
    const account2 = seedAccount(db, aliceId, 0);

    // Insert transactions that trigger 0.10 + 0.20 = 0.30000000000000004
    for (const amountPence of [10, 20]) {
      const tid = uuidv4(); const aid = uuidv4();
      db.prepare(`
        INSERT INTO fin_transfers (id, fromAccountId, toAccountId, amount, currency, reference, status, auditId)
        VALUES (?, ?, ?, ?, 'USD', 'test', 'PENDING', ?)
      `).run(tid, aliceAccountId, account2, amountPence, aid);
    }

    const res = await supertest(app)
      .get('/api/BrightBank/reports/monthly-summary')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);

    // BUG SUMMARY_FLOAT_DRIFT: this will likely be 0.30000000000000004 not 0.30
    // The test asserts exact precision — it should fail against the buggy implementation
    const { totalIn } = res.body;
    const isExact = parseFloat(totalIn.toFixed(2)) === parseFloat(totalIn.toString());
    expect(isExact, `Expected precise decimal but got ${totalIn}`).toBe(true);
    expect(totalIn.toFixed(2)).toBe('0.30');
  });

  it('AUDIT_SILENT_FAILURE: audit record must exist for every successful transfer', async () => {
    const res = await supertest(app)
      .post('/api/BrightBank/transfers')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ fromAccountId: aliceAccountId, toAccountId: bobAccountId, amount: 10, currency: 'USD', reference: 'test' });

    expect(res.status).toBe(201);
    const { transferId, auditId } = res.body;

    // Wait for the async setImmediate audit write to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    const auditRecord = db.prepare('SELECT * FROM fin_audit_log WHERE transferId = ?').get(transferId);
    expect(auditRecord, `Audit record missing for transfer ${transferId} (auditId: ${auditId})`).not.toBeNull();
  });

  it('BALANCE_RACE_CONDITION: concurrent transfers cannot create a negative balance', async () => {
    const accountId = seedAccount(db, aliceId, 10000); // $100.00
    const targetId = seedAccount(db, aliceId, 0);
    const token = makeToken({ id: aliceId, email: 'alice@test.dev', role: 'banker' });

    const transfers = Array.from({ length: 10 }, () =>
      supertest(app)
        .post('/api/BrightBank/transfers')
        .set('Authorization', `Bearer ${token}`)
        .send({ fromAccountId: accountId, toAccountId: targetId, amount: 20, currency: 'USD' })
    );

    const results = await Promise.all(transfers);
    const succeeded = results.filter(r => r.status === 201);

    expect(succeeded.length, 'More than 5 transfers succeeded on a $100 account at $20 each').toBeLessThanOrEqual(5);

    const finalBalance = getAccountBalance(db, accountId);
    expect(finalBalance, `Balance went negative: ${finalBalance}`).toBeGreaterThanOrEqual(0);
  });

  it.fails('ACCOUNT_ID_DISCLOSURE: account ID must not appear in error responses', async () => {
    const nonExistentId = 'acc-does-not-exist-999';
    const res = await supertest(app)
      .get(`/api/BrightBank/accounts/${nonExistentId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(404);
    const body = JSON.stringify(res.body);
    expect(body, 'Account ID was leaked in error response (ACCOUNT_ID_DISCLOSURE)').not.toContain(nonExistentId);
  });

  it('JWT_GRACE_PERIOD: expired tokens are rejected', async () => {
    const expiredToken = makeExpiredToken({ id: aliceId, email: 'alice@test.dev', role: 'banker' });
    const res = await supertest(app)
      .get(`/api/BrightBank/accounts/${aliceAccountId}`)
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  it.fails('JWT_GRACE_PERIOD: recently expired tokens should be rejected but are accepted (grace period bug)', async () => {
    const recentlyExpired = makeRecentlyExpiredToken({ id: aliceId, email: 'alice@test.dev', role: 'banker' });
    const res = await supertest(app)
      .get(`/api/BrightBank/accounts/${aliceAccountId}`)
      .set('Authorization', `Bearer ${recentlyExpired}`);

    // BUG JWT_GRACE_PERIOD: the API accepts this because of the 30-second grace period
    // This test documents the bug — it expects 401 but the implementation returns 200
    expect(res.status, 'BUG JWT_GRACE_PERIOD: recently expired token should be rejected').toBe(401);
  });

  it('transfer with insufficient funds returns structured error without PII', async () => {
    const res = await supertest(app)
      .post('/api/BrightBank/transfers')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ fromAccountId: aliceAccountId, toAccountId: bobAccountId, amount: 500, currency: 'USD' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('INSUFFICIENT_FUNDS');
    expect(res.body.availableBalance).toBeDefined();
    expect(res.body.requestedAmount).toBeDefined();
    expect(JSON.stringify(res.body)).not.toMatch(/\d{8,}/);
  });
});
