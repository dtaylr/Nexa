/**
 * Commerce — Mobile checkout and browsing tests
 * Tags: @mobile @commerce
 *
 * Device/viewport is set by the Playwright project (mobile-chrome, mobile-safari,
 * mobile-small, tablet). Do NOT add test.use(devices[...]) here.
 */

import { test, expect } from '@playwright/test';

const API = process.env.API_URL ?? 'http://localhost:3001';

//  Product Listing 

test.describe('@smoke @mobile @commerce Commerce — product listing', () => {
  test('product list has no horizontal overflow', async ({ page }) => {
    await page.goto('/BuyItAll/products');
    await page.waitForLoadState('domcontentloaded');

    const vw = await page.evaluate(() => window.innerWidth);
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth, `Horizontal overflow: ${scrollWidth}px > ${vw}px`).toBeLessThanOrEqual(vw);
  });

  test('at least one product card is visible', async ({ page }) => {
    await page.goto('/BuyItAll/products');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('a[href^="/BuyItAll/products/"]').first()).toBeVisible();
  });

  test('category filter buttons are tappable (44px min)', async ({ page }) => {
    await page.goto('/BuyItAll/products');
    await page.waitForLoadState('domcontentloaded');

    const filterBtns = page.getByRole('button').filter({ hasText: /Electronics|Clothing|Sports|Home|Books|All/i });
    const count = await filterBtns.count();
    if (count === 0) { test.skip(); return; }

    const box = await filterBtns.first().boundingBox();
    expect(box!.height, 'Category filter touch target < 44px').toBeGreaterThanOrEqual(44);
  });
});

//  Product Page 

test.describe('@regression @mobile @commerce Commerce — product page', () => {
  test('product page has no horizontal overflow', async ({ page }) => {
    await page.goto('/BuyItAll/products');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('a[href^="/BuyItAll/products/"]').first().click();
    await page.waitForLoadState('domcontentloaded');

    const vw = await page.evaluate(() => window.innerWidth);
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth, `Product page overflow: ${scrollWidth}px > ${vw}px`).toBeLessThanOrEqual(vw);
  });

  test('price has at most 2 decimal places (PRICE_FLOAT_PRECISION guard)', async ({ page }) => {
    await page.goto('/BuyItAll/products');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('a[href^="/BuyItAll/products/"]').first().click();

    const priceEl = page.getByTestId('product-price');
    await expect(priceEl).toBeVisible();
    const priceText = await priceEl.textContent();
    const price = parseFloat(priceText!.replace('$', ''));
    expect(price.toString(), 'PRICE_FLOAT_PRECISION: price has too many decimal places').toMatch(/^\d+(\.\d{1,2})?$/);
  });

  test('Add to Basket button meets 44px WCAG touch target', async ({ page }) => {
    await page.goto('/BuyItAll/products');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('a[href^="/BuyItAll/products/"]').first().click();

    const addBtn = page.getByRole('button', { name: 'Add to Basket' });
    await expect(addBtn).toBeVisible();
    const box = await addBtn.boundingBox();
    expect(box!.height, 'Touch target too small — minimum 44px (WCAG)').toBeGreaterThanOrEqual(44);
  });

  test('add to basket shows Proceed to Checkout button', async ({ page }) => {
    await page.goto('/BuyItAll/products');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('a[href^="/BuyItAll/products/"]').first().click();

    await page.getByRole('button', { name: 'Add to Basket' }).tap();

    const proceedBtn = page.getByRole('button', { name: 'Proceed to Checkout' });
    await expect(proceedBtn).toBeVisible();
    const box = await proceedBtn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

//  Full Checkout Flow 

test.describe('@regression @mobile @commerce Commerce — checkout flow', () => {
  test('guest checkout completes end-to-end on mobile', async ({ page }) => {
    await page.goto('/BuyItAll/products');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('a[href^="/BuyItAll/products/"]').first().click();

    const productTitle = page.getByTestId('product-title');
    await expect(productTitle).toBeVisible();

    await page.getByRole('button', { name: 'Add to Basket' }).tap();
    await page.getByRole('button', { name: 'Proceed to Checkout' }).tap();

    const vw = await page.evaluate(() => window.innerWidth);
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth, `CHECKOUT_MOBILE_OVERFLOW: horizontal scroll at ${bodyWidth}px — should be ≤${vw}px`).toBeLessThanOrEqual(vw);

    await page.getByLabel('Email').fill('test@1platform.dev');
    await page.getByLabel('First name').fill('Test');
    await page.getByLabel('Last name').fill('User');
    await page.getByLabel('Address line 1').fill('123 Test Street');
    await page.getByLabel('Postcode').fill('10001');

    await page.getByRole('button', { name: 'Continue to payment' }).tap();

    await page.getByLabel('Card number').fill('4242 4242 4242 4242');
    await page.getByLabel('Expiry').fill('12/26');
    await page.getByLabel('CVV').fill('123');

    await page.getByRole('button', { name: 'Place Order' }).tap();

    await expect(page.getByTestId('order-confirmation-heading')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('order-number')).toBeVisible();
  });

  test('empty checkout page has no horizontal scroll (CHECKOUT_MOBILE_OVERFLOW)', async ({ page }) => {
    await page.goto('/BuyItAll/checkout');
    await page.waitForLoadState('domcontentloaded');

    const vw = await page.evaluate(() => window.innerWidth);
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth, `CHECKOUT_MOBILE_OVERFLOW: checkout overflows at ${scrollWidth}px > ${vw}px`).toBeLessThanOrEqual(vw);
  });
});

//  Cart 

test.describe('@regression @mobile @commerce Commerce — cart', () => {
  test('empty cart page has no horizontal overflow', async ({ page }) => {
    await page.goto('/BuyItAll/cart');
    await page.waitForLoadState('domcontentloaded');

    const vw = await page.evaluate(() => window.innerWidth);
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth, `Cart overflow: ${scrollWidth}px > ${vw}px`).toBeLessThanOrEqual(vw);
  });

  test('cart badge is absent on finance pages @isolation', async ({ page }) => {
    await page.goto('/BrightBank/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('a[href="/BuyItAll/cart"]')).toHaveCount(0);
  });

  test('cart badge appears on commerce pages @isolation', async ({ page }) => {
    await page.goto('/BuyItAll/products');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('a[href="/BuyItAll/cart"]').first()).toBeVisible();
  });
});

//  Wishlist & Orders 

test.describe('@regression @mobile @commerce Commerce — wishlist and orders', () => {
  test('wishlist page has no horizontal overflow', async ({ page }) => {
    const res = await page.request.post(`${API}/api/auth/login`, {
      data: { email: 'shopper@1platform.dev', password: 'password123' },
    });
    if (!res.ok()) { test.skip(); return; }
    const { token } = await res.json();

    await page.goto('/BuyItAll/wishlist');
    await page.evaluate((t: string) => localStorage.setItem('com_token', t), token);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const vw = await page.evaluate(() => window.innerWidth);
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth, `Wishlist overflow: ${scrollWidth}px > ${vw}px`).toBeLessThanOrEqual(vw);
  });

  test('order history page has no horizontal overflow', async ({ page }) => {
    const res = await page.request.post(`${API}/api/auth/login`, {
      data: { email: 'shopper@1platform.dev', password: 'password123' },
    });
    if (!res.ok()) { test.skip(); return; }
    const { token } = await res.json();

    await page.goto('/BuyItAll/orders');
    await page.evaluate((t: string) => localStorage.setItem('com_token', t), token);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const vw = await page.evaluate(() => window.innerWidth);
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth, `Orders overflow: ${scrollWidth}px > ${vw}px`).toBeLessThanOrEqual(vw);
  });
});
