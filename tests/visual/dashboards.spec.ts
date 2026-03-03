/**
 * Visual regression tests using Playwright's screenshot comparison.
 *
 * First run: generates baseline snapshots in tests/visual/__snapshots__/
 * Subsequent runs: diffs against baseline — any pixel change > threshold fails.
 *
 * Run with --update-snapshots to accept intentional design changes.
 * In CI, baselines are committed to the repo so PRs fail on visual regressions.
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Visual Regression — Commerce', () => {
  test('product listing page matches baseline', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('product-listing.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });

  test('product page matches baseline', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const firstLink = page.locator('a[href^="/products/"]').first();
    if (await firstLink.isVisible()) {
      await firstLink.click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('product-page.png', {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    }
  });

  test('cart page matches baseline', async ({ page }) => {
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('cart-empty.png', { animations: 'disabled' });
  });
});

test.describe('Visual Regression — Finance', () => {
  test('finance login page matches baseline', async ({ page }) => {
    await page.goto('/finance/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('finance-login.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    });
  });

  test('finance dashboard after login matches baseline', async ({ page }) => {
    const res = await page.request.post(`http://localhost:3001/api/auth/login`, {
      data: { email: 'alice@nexacore.dev', password: 'password123' },
    });
    if (!res.ok()) { test.skip(); return; }

    const { token } = await res.json();
    await page.goto('/finance/dashboard');
    await page.evaluate(t => localStorage.setItem('fin_token', t), token);
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('finance-dashboard.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
      mask: [page.locator('[data-testid^="account-balance"]')],
    });
  });
});

test.describe('Visual Regression — Health', () => {
  test('health portal login prompt matches baseline', async ({ page }) => {
    await page.goto('/health/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('health-login.png', { animations: 'disabled' });
  });
});

test.describe('Visual Regression — Mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('product listing is visually correct on mobile', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('product-listing-mobile.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });

  test('checkout form does not overflow on mobile', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('checkout-mobile.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });
});
