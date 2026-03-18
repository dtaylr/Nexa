/**
 * Smoke tests — run after every staging deployment.
 * Fast, shallow, and focused on the happy path.
 * Failure here triggers automatic rollback in cd-staging.yml.
 */

import { test, expect } from '@playwright/test';

const API = process.env.API_URL ?? 'http://localhost:3001';
const BASE = process.env.BASE_URL ?? 'http://localhost:6173';

test.describe('API health', () => {
  test('GET /health returns 200 ok', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeTruthy();
  });

  test('auth endpoint responds', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: 'nonexistent', password: 'wrong' },
    });
    // 401 is fine — we just need the server to respond, not deadlock
    expect([200, 401, 400]).toContain(res.status());
  });
});

test.describe('Finance API smoke', () => {
  test('GET /api/BrightBank/accounts responds', async ({ request }) => {
    const res = await request.get(`${API}/api/BrightBank/accounts`);
    expect([200, 401]).toContain(res.status());
  });
});

test.describe('Commerce API smoke', () => {
  test('GET /api/commerce/products responds', async ({ request }) => {
    const res = await request.get(`${API}/api/commerce/products`);
    expect([200, 401]).toContain(res.status());
  });
});

test.describe('Web smoke', () => {
  test('homepage loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(BASE);
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toHaveLength(0);
  });

  test('page title is present', async ({ page }) => {
    await page.goto(BASE);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
