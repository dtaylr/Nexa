import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('Beneficiaries API — regression', () => {
  let token: string;
  let beneficiaryId: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@1platform.dev', password: 'password123' });
    token = res.body.token;
  });

  it('adds a beneficiary', async () => {
    const res = await request(app).post('/api/BrightBank/beneficiaries').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bob Jones', accountNumber: '12345678', sortCode: '20-00-00', reference: 'Rent' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    beneficiaryId = res.body.id;
  });

  it('lists beneficiaries', async () => {
    const res = await request(app).get('/api/BrightBank/beneficiaries').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.beneficiaries)).toBe(true);
  });

  it('rejects invalid sort code', async () => {
    const res = await request(app).post('/api/BrightBank/beneficiaries').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test', accountNumber: '12345678', sortCode: 'ABCDEF' });
    expect(res.status).toBe(400);
  });

  it('deletes a beneficiary', async () => {
    if (!beneficiaryId) return;
    const res = await request(app).delete(`/api/BrightBank/beneficiaries/${beneficiaryId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  it('returns 404 for unknown beneficiary', async () => {
    const res = await request(app).delete('/api/BrightBank/beneficiaries/nonexistent').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
