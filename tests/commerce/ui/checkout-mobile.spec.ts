import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['iPhone 12'] });

const BASE = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Commerce — Mobile Checkout (390px viewport)', () => {
  test('guest checkout completes from product page to confirmation', async ({ page }) => {
    await page.goto('/products');

    const firstProduct = page.locator('[data-testid="product-title"]').first();

    if (!(await firstProduct.isVisible())) {
      await page.goto(`${BASE}/products`);
      await page.waitForSelector('a[href^="/products/"]');
    }

    await page.locator('a[href^="/products/"]').first().click();

    const productTitle = page.getByTestId('product-title');
    await expect(productTitle).toBeVisible();

    const priceEl = page.getByTestId('product-price');
    const priceText = await priceEl.textContent();
    const price = parseFloat(priceText!.replace('£', ''));
    expect(price.toString(), 'COM-006: price has too many decimal places').toMatch(/^\d+(\.\d{1,2})?$/);

    const addButton = page.getByRole('button', { name: 'Add to Basket' });
    const box = await addButton.boundingBox();
    expect(box!.height, 'Touch target too small — minimum 44px (WCAG)').toBeGreaterThanOrEqual(44);

    await addButton.tap();

    const proceedButton = page.getByRole('button', { name: 'Proceed to Checkout' });
    await expect(proceedButton).toBeVisible();
    const proceedBox = await proceedButton.boundingBox();
    expect(proceedBox!.height).toBeGreaterThanOrEqual(44);

    await proceedButton.tap();

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth, `COM-005: horizontal scroll at ${bodyWidth}px — should be ≤390px`).toBeLessThanOrEqual(390);

    await page.getByLabel('Email').fill('test@nexacore.dev');
    await page.getByLabel('First name').fill('Test');
    await page.getByLabel('Last name').fill('User');
    await page.getByLabel('Address line 1').fill('123 Test Street');
    await page.getByLabel('Postcode').fill('SW1A 1AA');

    await page.getByRole('button', { name: 'Continue to payment' }).tap();

    await page.getByLabel('Card number').fill('4242 4242 4242 4242');
    await page.getByLabel('Expiry').fill('12/26');
    await page.getByLabel('CVV').fill('123');

    await page.getByRole('button', { name: 'Place Order' }).tap();

    await expect(page.getByTestId('order-confirmation-heading')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('order-number')).toBeVisible();
  });

  test('product list has no horizontal overflow on 390px viewport', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth, `Horizontal overflow: ${scrollWidth}px > 390px`).toBeLessThanOrEqual(390);
  });
});
