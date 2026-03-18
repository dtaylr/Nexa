import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('Wishlist API — regression', () => {
  let token: string;
  let productId: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'shopper@1platform.dev', password: 'password123' });
    token = res.body.token;
    const products = await request(app).get('/api/commerce/products');
    productId = products.body.products?.[0]?.id;
  });

  it('adds a product to wishlist', async () => {
    if (!productId) return;
    const res = await request(app).post('/api/commerce/wishlist').set('Authorization', `Bearer ${token}`)
      .send({ productId });
    expect([201, 409]).toContain(res.status); // 409 if already exists (idempotent)
  });

  it('prevents duplicate wishlist entries', async () => {
    if (!productId) return;
    await request(app).post('/api/commerce/wishlist').set('Authorization', `Bearer ${token}`).send({ productId });
    const res = await request(app).post('/api/commerce/wishlist').set('Authorization', `Bearer ${token}`).send({ productId });
    expect(res.status).toBe(409);
  });

  it('removes from wishlist', async () => {
    if (!productId) return;
    await request(app).post('/api/commerce/wishlist').set('Authorization', `Bearer ${token}`).send({ productId });
    const res = await request(app).delete(`/api/commerce/wishlist/${productId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.removed).toBe(true);
  });

  it('returns 404 for product not in wishlist', async () => {
    const res = await request(app).delete('/api/commerce/wishlist/nonexistent-product').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
