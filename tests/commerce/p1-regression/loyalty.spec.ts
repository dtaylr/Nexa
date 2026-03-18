import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('Loyalty API — regression', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'shopper@1platform.dev', password: 'password123' });
    token = res.body.token;
  });

  it('returns loyalty account with tier', async () => {
    const res = await request(app).get('/api/commerce/loyalty').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(['bronze', 'silver', 'gold', 'platinum']).toContain(res.body.tier);
    expect(typeof res.body.points).toBe('number');
  });

  it('rejects redemption below minimum', async () => {
    const res = await request(app).post('/api/commerce/loyalty/redeem').set('Authorization', `Bearer ${token}`)
      .send({ points: 50 }); // below 100 minimum
    expect(res.status).toBe(400);
  });

  it('rejects redemption with insufficient points', async () => {
    const res = await request(app).post('/api/commerce/loyalty/redeem').set('Authorization', `Bearer ${token}`)
      .send({ points: 999999 });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('INSUFFICIENT_POINTS');
  });
});
