/**
 * Health — Mobile test suite
 * Tags: @mobile @health
 *
 * Device/viewport is set by the Playwright project. Do NOT add test.use(devices[...]).
 */

import { test, expect } from '@playwright/test';

const API = process.env.API_URL ?? 'http://localhost:3001';

async function loginHealth(page: any): Promise<string | null> {
  const res = await page.request.post(`${API}/api/auth/login`, {
    data: { email: 'patient.one@1platform.dev', password: 'password123' },
  });
  if (!res.ok()) return null;
  const { token, patientId } = await res.json();
  await page.goto('/HealthyU/dashboard');
  await page.evaluate((t: string) => localStorage.setItem('hlt_token', t), token);
  if (patientId) {
    await page.evaluate((id: string) => localStorage.setItem('hlt_patient_id', id), String(patientId));
  }
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  return token;
}

//  Login Page 

test.describe('@smoke @mobile @health Health — login page', () => {
  test('login page has no horizontal overflow', async ({ page }) => {
    await page.goto('/HealthyU/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const vw = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth, `Overflow: body ${scrollWidth}px > viewport ${vw}px`).toBeLessThanOrEqual(vw);
  });

  test('sign-in button meets 44px WCAG touch target', async ({ page }) => {
    await page.goto('/HealthyU/dashboard');
    const btn = page.getByRole('button', { name: 'Sign in' });
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box!.height, 'Touch target < 44px').toBeGreaterThanOrEqual(44);
  });

  test('email and password inputs are full-width on mobile', async ({ page }) => {
    await page.goto('/HealthyU/dashboard');
    const vw = await page.evaluate(() => window.innerWidth);
    const emailInput = page.getByLabel('Email address');
    await expect(emailInput).toBeVisible();
    const box = await emailInput.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(vw * 0.6);
  });
});

//  Dashboard 

test.describe('@regression @mobile @health Health — dashboard', () => {
  test('dashboard has no horizontal overflow after login', async ({ page }) => {
    const token = await loginHealth(page);
    if (!token) { test.skip(); return; }

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const vw = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth, `Overflow: ${scrollWidth}px > ${vw}px`).toBeLessThanOrEqual(vw);
  });

  test('quick action links are visible and tappable', async ({ page }) => {
    const token = await loginHealth(page);
    if (!token) { test.skip(); return; }

    const links = page.locator('a[href^="/HealthyU/"]');
    const count = await links.count();
    expect(count, 'No health navigation links found').toBeGreaterThan(0);

    const firstLink = links.first();
    const box = await firstLink.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('cart badge does NOT appear on health pages @isolation', async ({ page }) => {
    await page.goto('/HealthyU/dashboard');
    await page.waitForLoadState('domcontentloaded');
    const cartLink = page.locator('a[href="/BuyItAll/cart"]');
    await expect(cartLink).toHaveCount(0);
  });
});

//  Appointments 

test.describe('@regression @mobile @health Health — appointments', () => {
  test('appointments page has no horizontal overflow', async ({ page }) => {
    const token = await loginHealth(page);
    if (!token) { test.skip(); return; }

    await page.goto('/HealthyU/appointments');
    await page.waitForLoadState('domcontentloaded');

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const vw = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth, `Appointments overflow: ${scrollWidth}px > ${vw}px`).toBeLessThanOrEqual(vw);
  });

  test('Book appointment button is tappable', async ({ page }) => {
    const token = await loginHealth(page);
    if (!token) { test.skip(); return; }

    await page.goto('/HealthyU/appointments');
    await page.waitForLoadState('domcontentloaded');

    const btn = page.getByRole('link', { name: /Book/i }).or(page.getByRole('button', { name: /Book/i })).first();
    const isVisible = await btn.isVisible();
    if (!isVisible) { test.skip(); return; }

    const box = await btn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

//  Lab Results 

test.describe('@regression @mobile @health Health — lab results', () => {
  test('lab results page has no horizontal overflow', async ({ page }) => {
    const token = await loginHealth(page);
    if (!token) { test.skip(); return; }

    await page.goto('/HealthyU/lab-results');
    await page.waitForLoadState('domcontentloaded');

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const vw = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth, `Lab results overflow: ${scrollWidth}px > ${vw}px`).toBeLessThanOrEqual(vw);
  });
});

//  Prescriptions 

test.describe('@regression @mobile @health Health — prescriptions', () => {
  test('prescriptions page has no horizontal overflow', async ({ page }) => {
    const token = await loginHealth(page);
    if (!token) { test.skip(); return; }

    await page.goto('/HealthyU/prescriptions');
    await page.waitForLoadState('domcontentloaded');

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const vw = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth, `Prescriptions overflow: ${scrollWidth}px > ${vw}px`).toBeLessThanOrEqual(vw);
  });
});

//  Navigation 

test.describe('@smoke @mobile @health Health — navigation', () => {
  test('domain nav links all visible on mobile', async ({ page }) => {
    await page.goto('/HealthyU/dashboard');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('link', { name: /Finance/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Health/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Shop/i })).toBeVisible();
  });

  test('tapping Finance nav navigates to finance dashboard', async ({ page }) => {
    await page.goto('/HealthyU/dashboard');
    await page.getByRole('link', { name: /Finance/i }).tap();
    await expect(page).toHaveURL(/\/BrightBank\//);
  });
});
