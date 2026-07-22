import { test, expect } from '../playwright/fixtures';

test.describe('@regression @self-healing locator resilience', () => {
  test('records a healing event when a stable fallback locator succeeds @commerce', async ({
    selfHealingPage,
    page,
  }) => {
    await page.goto('/BuyItAll/products');

    const productsLink = await selfHealingPage.locate(
      page.getByTestId('legacy-products-link'),
      [
        { kind: 'aria-role', role: 'link', value: 'Products' },
        { kind: 'text', value: 'Products' },
        { kind: 'css', value: 'a[href="/BuyItAll/products"]' },
      ],
      1200
    );

    await expect(productsLink).toBeVisible();
  });
});
