import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('P0 Commerce API smoke', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'shopper@1platform.dev', password: 'password123' });
    token = res.body.token;
  });

  it('GET /commerce/products returns products', async () => {
    const res = await request(app).get('/api/commerce/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  it('GET /commerce/wishlist returns array', async () => {
    const res = await request(app).get('/api/commerce/wishlist').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.wishlist)).toBe(true);
  });

  it('GET /commerce/orders returns orders', async () => {
    const res = await request(app).get('/api/commerce/orders').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  it('GET /commerce/loyalty returns loyalty data', async () => {
    const res = await request(app).get('/api/commerce/loyalty').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('points');
    expect(res.body).toHaveProperty('tier');
  });

  it('GET /commerce/returns returns returns array', async () => {
    const res = await request(app).get('/api/commerce/returns').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.returns)).toBe(true);
  });

  it('unauthenticated wishlist returns 401', async () => {
    const res = await request(app).get('/api/commerce/wishlist');
    expect(res.status).toBe(401);
  });
});
