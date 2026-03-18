import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('Cards API — regression', () => {
  let token: string;
  let accountId: string;
  let cardId: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@1platform.dev', password: 'password123' });
    token = res.body.token;
    const accounts = await request(app).get('/api/BrightBank/accounts').set('Authorization', `Bearer ${token}`);
    accountId = accounts.body.accounts?.[0]?.id;
  });

  it('issues a new virtual card', async () => {
    if (!accountId) return;
    const res = await request(app).post('/api/BrightBank/cards').set('Authorization', `Bearer ${token}`)
      .send({ accountId, cardholderName: 'Alice Smith', cardType: 'virtual', dailyLimit: 50000 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('lastFour');
    expect(res.body.status).toBe('active');
    cardId = res.body.id;
  });

  it('freezes and unfreezes a card', async () => {
    if (!cardId) return;
    const freeze = await request(app).put(`/api/BrightBank/cards/${cardId}/freeze`).set('Authorization', `Bearer ${token}`);
    expect(freeze.body.status).toBe('frozen');
    const unfreeze = await request(app).put(`/api/BrightBank/cards/${cardId}/freeze`).set('Authorization', `Bearer ${token}`);
    expect(unfreeze.body.status).toBe('active');
  });

  it('cancels a card', async () => {
    if (!accountId) return;
    const issue = await request(app).post('/api/BrightBank/cards').set('Authorization', `Bearer ${token}`)
      .send({ accountId, cardholderName: 'Alice Smith', cardType: 'virtual' });
    const id = issue.body.id;
    const cancel = await request(app).delete(`/api/BrightBank/cards/${id}`).set('Authorization', `Bearer ${token}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('cancelled');
  });

  it('returns 400 when issueCard missing required fields', async () => {
    const res = await request(app).post('/api/BrightBank/cards').set('Authorization', `Bearer ${token}`)
      .send({ cardholderName: 'Alice' }); // missing accountId
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown account', async () => {
    const res = await request(app).post('/api/BrightBank/cards').set('Authorization', `Bearer ${token}`)
      .send({ accountId: 'nonexistent', cardholderName: 'Test', cardType: 'virtual' });
    expect(res.status).toBe(404);
  });
});
