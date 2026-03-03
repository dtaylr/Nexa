/**
 * Consumer-driven contract tests for the Finance Transfer API.
 *
 * The test frontend (consumer) defines what shape it expects from the API (provider).
 * If a backend developer changes the response schema, this test fails in their PR
 * before integration — the shift-left benefit of Pact.
 *
 * Key assertion: `auditId` must appear in every successful transfer response.
 * This contract catches FIN-001 at the API design layer.
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';

const { like, string, regex, decimal, uuid, boolean, eachLike } = MatchersV3;

const provider = new PactV3({
  consumer: 'NexaCore-Web',
  provider: 'NexaCore-Finance-API',
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
        path: '/api/finance/transfers',
        headers: {
          'Content-Type': 'application/json',
          Authorization: like('Bearer eyJhbGciOiJIUzI1NiJ9'),
        },
        body: {
          fromAccountId: string('acc-001'),
          toAccountId: string('acc-002'),
          amount: decimal(50.00),
          currency: regex({ generate: 'GBP', matcher: '^[A-Z]{3}$' }),
          reference: string('Test transfer'),
        },
      })
      .willRespondWith({
        status: 201,
        headers: { 'Content-Type': regex({ generate: 'application/json', matcher: 'application/json.*' }) },
        body: {
          transferId: uuid(),
          status: regex({ generate: 'PENDING', matcher: 'PENDING|COMPLETED|FAILED' }),
          auditId: uuid(),
          timestamp: string('2024-01-01T00:00:00.000Z'),
          amount: decimal(50.00),
          currency: string('GBP'),
        },
      })
      .executeTest(async (mockserver) => {
        const res = await fetch(`${mockserver.url}/api/finance/transfers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9',
          },
          body: JSON.stringify({
            fromAccountId: 'acc-001',
            toAccountId: 'acc-002',
            amount: 50.00,
            currency: 'GBP',
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
      .given('account acc-001 has a balance of £5.00')
      .uponReceiving('a transfer request exceeding available balance')
      .withRequest({
        method: 'POST',
        path: '/api/finance/transfers',
        headers: {
          'Content-Type': 'application/json',
          Authorization: like('Bearer token'),
        },
        body: {
          fromAccountId: string('acc-001'),
          toAccountId: string('acc-002'),
          amount: decimal(100.00),
          currency: string('GBP'),
        },
      })
      .willRespondWith({
        status: 422,
        body: {
          error: 'INSUFFICIENT_FUNDS',
          availableBalance: decimal(5.00),
          requestedAmount: decimal(100.00),
        },
      })
      .executeTest(async (mockserver) => {
        const res = await fetch(`${mockserver.url}/api/finance/transfers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
          body: JSON.stringify({ fromAccountId: 'acc-001', toAccountId: 'acc-002', amount: 100.00, currency: 'GBP' }),
        });

        expect(res.status).toBe(422);
        const body = await res.json();
        expect(body.error).toBe('INSUFFICIENT_FUNDS');
        expect(body.availableBalance).toBeDefined();
        expect(body.requestedAmount).toBeDefined();
        // Contract explicitly excludes accountId — catches FIN-005
        expect(body.accountId).toBeUndefined();
      });
  });

  it('accounts list returns all accounts for authenticated user', async () => {
    await provider
      .given('user has two accounts')
      .uponReceiving('a request for all user accounts')
      .withRequest({
        method: 'GET',
        path: '/api/finance/accounts',
        headers: { Authorization: like('Bearer token') },
      })
      .willRespondWith({
        status: 200,
        body: {
          accounts: eachLike({
            id: string('acc-001'),
            accountNumber: string('60161331001234'),
            balance: decimal(100.00),
            currency: string('GBP'),
            type: regex({ generate: 'current', matcher: 'current|savings' }),
          }),
        },
      })
      .executeTest(async (mockserver) => {
        const res = await fetch(`${mockserver.url}/api/finance/accounts`, {
          headers: { Authorization: 'Bearer token' },
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.accounts)).toBe(true);
        expect(body.accounts.length).toBeGreaterThan(0);
      });
  });
});
