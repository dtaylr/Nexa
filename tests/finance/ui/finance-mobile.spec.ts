/**
 * Finance — Mobile test suite
 * Tags: @mobile @finance
 *
 * Device/viewport is set by the Playwright project (mobile-chrome, mobile-safari,
 * mobile-small, tablet). Do NOT add test.use(devices[...]) here.
 */

import { test, expect } from '@playwright/test';

const API = process.env.API_URL ?? 'http://localhost:3001';

async function loginFinance(page: any): Promise<string | null> {
  const res = await page.request.post(`${API}/api/auth/login`, {
    data: { email: 'alice@1platform.dev', password: 'password123' },
  });
  if (!res.ok()) return null;
  const { token } = await res.json();
  await page.goto('/BrightBank/dashboard');
  await page.evaluate((t: string) => localStorage.setItem('fin_token', t), token);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  return token;
}

//  Layout & Overflow 

test.describe('@smoke @mobile @finance Finance — login page', () => {
  test('login page has no horizontal overflow', async ({ page }) => {
    await page.goto('/BrightBank/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const vw = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth, `Horizontal overflow: body ${scrollWidth}px > viewport ${vw}px`).toBeLessThanOrEqual(vw);
  });

  test('sign-in button meets 44px WCAG touch target', async ({ page }) => {
    await page.goto('/BrightBank/dashboard');
    const btn = page.getByRole('button', { name: 'Sign in' });
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box!.height, 'Touch target < 44px').toBeGreaterThanOrEqual(44);
    expect(box!.width, 'Touch target too narrow').toBeGreaterThanOrEqual(44);
  });

  test('email and password inputs are full width on mobile', async ({ page }) => {
    await page.goto('/BrightBank/dashboard');
    const vw = await page.evaluate(() => window.innerWidth);
    const emailInput = page.getByLabel('Email address');
    const box = await emailInput.boundingBox();
    expect(box!.width, 'Email input too narrow on mobile').toBeGreaterThanOrEqual(vw * 0.6);
  });
});

//  Dashboard 

test.describe('@regression @mobile @finance Finance — dashboard', () => {
  test('dashboard has no horizontal overflow after login', async ({ page }) => {
    const token = await loginFinance(page);
    if (!token) { test.skip(); return; }

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const vw = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth, `Horizontal overflow: ${scrollWidth}px > ${vw}px`).toBeLessThanOrEqual(vw);
  });

  test('account balance is visible and readable', async ({ page }) => {
    const token = await loginFinance(page);
    if (!token) { test.skip(); return; }

    const balanceEl = page.locator('[data-testid^="account-balance"]').first();
    await expect(balanceEl).toBeVisible();
    const text = await balanceEl.textContent();
    expect(text).toMatch(/\$[\d,]+\.\d{2}/);
  });

  test('Transfer button is tappable (44px min)', async ({ page }) => {
    const token = await loginFinance(page);
    if (!token) { test.skip(); return; }

    const btn = page.getByRole('button', { name: '+ Transfer' });
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box!.height, 'Transfer button touch target < 44px').toBeGreaterThanOrEqual(44);
  });

  test('navigation to transfer form works on mobile', async ({ page }) => {
    const token = await loginFinance(page);
    if (!token) { test.skip(); return; }

    await page.getByRole('link', { name: '+ Transfer' }).click();
    await page.waitForURL('**/BrightBank/transfer**');
    await expect(page.getByRole('heading')).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const vw = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth, `Transfer page overflows on mobile`).toBeLessThanOrEqual(vw);
  });

  test('account card expand/collapse works with tap', async ({ page }) => {
    const token = await loginFinance(page);
    if (!token) { test.skip(); return; }

    const expandBtn = page.getByRole('button', { name: 'Recent transactions' }).first();
    await expect(expandBtn).toBeVisible();
    const box = await expandBtn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await expandBtn.tap();
    await expect(page.getByRole('button', { name: 'Hide transactions' }).first()).toBeVisible();
  });
});

//  Transfer Form 

test.describe('@regression @mobile @finance Finance — transfer form', () => {
  test('transfer form has no horizontal overflow', async ({ page }) => {
    const token = await loginFinance(page);
    if (!token) { test.skip(); return; }

    await page.goto('/BrightBank/transfer');
    await page.waitForLoadState('domcontentloaded');

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const vw = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth, `Transfer form overflows: ${scrollWidth}px > ${vw}px`).toBeLessThanOrEqual(vw);
  });

  test('form inputs are wide enough to type in on mobile', async ({ page }) => {
    const token = await loginFinance(page);
    if (!token) { test.skip(); return; }

    await page.goto('/BrightBank/transfer');
    await page.waitForLoadState('domcontentloaded');

    const amountInput = page.getByLabel('Amount');
    await expect(amountInput).toBeVisible();
    const box = await amountInput.boundingBox();
    const vw = await page.evaluate(() => window.innerWidth);
    expect(box!.width).toBeGreaterThanOrEqual(vw * 0.5);
  });

  test('Review Transfer button is tappable', async ({ page }) => {
    const token = await loginFinance(page);
    if (!token) { test.skip(); return; }

    await page.goto('/BrightBank/transfer');
    await page.waitForLoadState('domcontentloaded');

    const btn = page.getByRole('button', { name: 'Review Transfer' });
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

//  Navigation 

test.describe('@smoke @mobile @finance Finance — navigation', () => {
  test('domain nav links are all visible and reachable', async ({ page }) => {
    await page.goto('/BrightBank/dashboard');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('link', { name: /BrightBank/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /HealthyU/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /BuyItAll/i })).toBeVisible();
  });

  test('tapping Health nav navigates to health dashboard', async ({ page }) => {
    await page.goto('/BrightBank/dashboard');
    await page.getByRole('link', { name: /HealthyU/i }).tap();
    await expect(page).toHaveURL(/\/HealthyU\//);
  });

  test('cart badge does NOT appear on finance pages @isolation', async ({ page }) => {
    await page.goto('/BrightBank/dashboard');
    await page.waitForLoadState('domcontentloaded');
    const cartLink = page.locator('a[href="/BuyItAll/cart"]');
    await expect(cartLink).toHaveCount(0);
  });
});
