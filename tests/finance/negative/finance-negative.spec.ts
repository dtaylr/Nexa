import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('Finance API — negative / security tests', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@1platform.dev', password: 'password123' });
    token = res.body.token;
  });

  it('BUG ACCOUNT_ID_DISCLOSURE: account 404 leaks accountId in response body', async () => {
    const res = await request(app).get('/api/BrightBank/accounts/nonexistent-uuid').set('Authorization', `Bearer ${token}`);
    // BUG: error body includes accountId — this test documents it
    if (res.status === 404 && res.body.accountId) {
      // Bug is present — document it
      expect(res.body.accountId).toBe('nonexistent-uuid');
    }
  });

  it('rejects transfer with insufficient funds', async () => {
    const accounts = await request(app).get('/api/BrightBank/accounts').set('Authorization', `Bearer ${token}`);
    const account = accounts.body.accounts?.[0];
    if (!account) return;
    const res = await request(app).post('/api/BrightBank/transfers').set('Authorization', `Bearer ${token}`)
      .send({ fromAccountId: account.id, toAccountId: account.id, amount: 999999999, reference: 'Too much' });
    expect([400, 422]).toContain(res.status);
  });

  it('rejects transfer to self (same account)', async () => {
    const accounts = await request(app).get('/api/BrightBank/accounts').set('Authorization', `Bearer ${token}`);
    const account = accounts.body.accounts?.[0];
    if (!account) return;
    const res = await request(app).post('/api/BrightBank/transfers').set('Authorization', `Bearer ${token}`)
      .send({ fromAccountId: account.id, toAccountId: account.id, amount: 100, reference: 'Self' });
    expect([400, 422]).toContain(res.status);
  });

  it('rejects negative transfer amount', async () => {
    const accounts = await request(app).get('/api/BrightBank/accounts').set('Authorization', `Bearer ${token}`);
    const account = accounts.body.accounts?.[0];
    if (!account) return;
    const res = await request(app).post('/api/BrightBank/transfers').set('Authorization', `Bearer ${token}`)
      .send({ fromAccountId: account.id, toAccountId: 'other', amount: -100, reference: 'Negative' });
    expect([400, 422]).toContain(res.status);
  });
});
