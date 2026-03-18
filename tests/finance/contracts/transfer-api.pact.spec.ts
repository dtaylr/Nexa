/**
 * Consumer-driven contract tests for the Finance Transfer API.
 *
 * The test frontend (consumer) defines what shape it expects from the API (provider).
 * If a backend developer changes the response schema, this test fails in their PR
 * before integration — the shift-left benefit of Pact.
 *
 * Key assertion: `auditId` must appear in every successful transfer response.
 * This contract catches AUDIT_SILENT_FAILURE at the API design layer.
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';

const { like, string, regex, decimal, uuid, boolean, eachLike } = MatchersV3;

const provider = new PactV3({
  consumer: '1Platform-Web',
  provider: '1Platform-Finance-API',
  dir: path.join(process.cwd(), 'pacts'),
  logLevel: 'warn',
});

describe('Finance Transfer API — Consumer Contract', () => {
  it('successful transfer returns canonical response including auditId', async () => {
    await provider
      .given('accounts acc-001 and acc-002 exist with sufficient balance')
      .uponReceiving('a valid transfer request')
      .withRequest({
        method: 'POST',
        path: '/api/BrightBank/transfers',
        headers: {
          'Content-Type': 'application/json',
          Authorization: like('Bearer eyJhbGciOiJIUzI1NiJ9'),
        },
        body: {
          fromAccountId: string('acc-001'),
          toAccountId: string('acc-002'),
          amount: like(50),
          currency: string('USD'),
          reference: string('Test transfer'),
        },
      })
      .willRespondWith({
        status: 201,
        body: {
          transferId: 'a4b3c2d1-e5f6-7890-abcd-ef1234567890',
          status: 'PENDING',
          auditId: 'b5c4d3e2-f1a0-1234-bcde-fa0987654321',
          timestamp: '2024-01-01T00:00:00.000Z',
          amount: 50,
          currency: 'USD',
        },
      })
      .executeTest(async (mockserver) => {
        const res = await fetch(`${mockserver.url}/api/BrightBank/transfers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9',
          },
          body: JSON.stringify({
            fromAccountId: 'acc-001',
            toAccountId: 'acc-002',
            amount: 50,
            currency: 'USD',
            reference: 'Test transfer',
          }),
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.transferId).toBeTruthy();
        expect(body.auditId).toBeTruthy();
        expect(body.status).toBe('PENDING');
      });
  });

  it('transfer with insufficient funds returns structured error without PII', async () => {
    await provider
      .given('account acc-001 has a balance of $5.00')
      .uponReceiving('a transfer request exceeding available balance')
      .withRequest({
        method: 'POST',
        path: '/api/BrightBank/transfers',
        headers: {
          'Content-Type': 'application/json',
          Authorization: like('Bearer token'),
        },
        body: {
          fromAccountId: string('acc-001'),
          toAccountId: string('acc-002'),
          amount: like(100),
          currency: string('USD'),
        },
      })
      .willRespondWith({
        status: 422,
        body: {
          error: 'INSUFFICIENT_FUNDS',
          availableBalance: like(5),
          requestedAmount: like(100),
        },
      })
      .executeTest(async (mockserver) => {
        const res = await fetch(`${mockserver.url}/api/BrightBank/transfers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
          body: JSON.stringify({ fromAccountId: 'acc-001', toAccountId: 'acc-002', amount: 100.00, currency: 'USD' }),
        });

        expect(res.status).toBe(422);
        const body = await res.json();
        expect(body.error).toBe('INSUFFICIENT_FUNDS');
        expect(body.availableBalance).toBeDefined();
        expect(body.requestedAmount).toBeDefined();
        // Contract explicitly excludes accountId — catches ACCOUNT_ID_DISCLOSURE
        expect(body.accountId).toBeUndefined();
      });
  });

  it('accounts list returns all accounts for authenticated user', async () => {
    await provider
      .given('user has two accounts')
      .uponReceiving('a request for all user accounts')
      .withRequest({
        method: 'GET',
        path: '/api/BrightBank/accounts',
        headers: { Authorization: like('Bearer token') },
      })
      .willRespondWith({
        status: 200,
        body: {
          accounts: eachLike({
            id: string('acc-001'),
            accountNumber: string('60161331001234'),
            balance: like(100),
            currency: string('USD'),
            type: string('current'),
          }),
        },
      })
      .executeTest(async (mockserver) => {
        const res = await fetch(`${mockserver.url}/api/BrightBank/accounts`, {
          headers: { Authorization: 'Bearer token' },
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.accounts)).toBe(true);
        expect(body.accounts.length).toBeGreaterThan(0);
      });
  });
});
