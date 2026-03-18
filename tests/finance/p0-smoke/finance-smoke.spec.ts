import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('P0 Finance API smoke', () => {
  let token: string;
  let accountId: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@1platform.dev', password: 'password123' });
    token = res.body.token;
    const accounts = await request(app).get('/api/BrightBank/accounts').set('Authorization', `Bearer ${token}`);
    accountId = accounts.body.accounts?.[0]?.id;
  });

  it('GET /finance/accounts returns array', async () => {
    const res = await request(app).get('/api/BrightBank/accounts').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.accounts)).toBe(true);
  });

  it('GET /finance/cards returns cards array', async () => {
    const res = await request(app).get('/api/BrightBank/cards').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cards)).toBe(true);
  });

  it('GET /finance/beneficiaries returns array', async () => {
    const res = await request(app).get('/api/BrightBank/beneficiaries').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.beneficiaries)).toBe(true);
  });

  it('GET /finance/fraud-events returns events', async () => {
    const res = await request(app).get('/api/BrightBank/fraud-events').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it('GET /finance/accounts/:id/statement returns statement', async () => {
    if (!accountId) return;
    const res = await request(app).get(`/api/BrightBank/accounts/${accountId}/statement`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('transactions');
    expect(res.body).toHaveProperty('totalIn');
  });

  it('unauthenticated returns 401', async () => {
    const res = await request(app).get('/api/BrightBank/accounts');
    expect(res.status).toBe(401);
  });
});
