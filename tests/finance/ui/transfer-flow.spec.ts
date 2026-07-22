import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:6173';

async function loginAndGetToken(page: any, email: string, password: string): Promise<string> {
  const res = await page.request.post(`${BASE.replace('6173', '3001')}/api/auth/login`, {
    data: { email, password },
  });
  const { token } = await res.json();
  return token;
}

test.describe('@regression @finance Finance — Transfer Flow', () => {
  test.beforeEach(async ({ page }) => {
    const token = await loginAndGetToken(page, 'alice@1platform.dev', 'password123');
    // addInitScript injects the token before React mounts — reliable across all browsers
    await page.addInitScript((t: string) => {
      window.localStorage.setItem('fin_token', t);
    }, token);
    await page.goto('/BrightBank/transfer');
    // Wait for the accounts API to complete so #from-account options are populated
    await page.waitForLoadState('networkidle');
  });

  test('transfer flow shows confirmation with audit reference @smoke', async ({ page }) => {
    // networkidle in beforeEach guarantees the accounts fetch completed and React re-rendered.
    // selectOption waits for the <select> to be actionable; options are populated at this point.

    // Select first real account as source (index 0 is placeholder "Select an account…")
    await page.locator('#from-account').selectOption({ index: 1 });

    // Destination: own-account mode is default — select first destination account
    await page.locator('#to-account').selectOption({ index: 1 });

    // Fill amount and reference using input IDs (labels include nested spans)
    await page.locator('#amount').fill('150.00');
    await page.locator('#reference').fill('Rent - October');

    // Review step
    await page.getByRole('button', { name: 'Review transfer' }).click();

    await expect(page.getByTestId('transfer-amount')).toHaveText('$150.00');
    await expect(page.getByTestId('transfer-reference')).toHaveText('Rent - October');

    // Confirm
    await page.getByRole('button', { name: 'Confirm transfer' }).click();

    // Confirmation screen
    await expect(page.getByTestId('transfer-status')).toHaveText('Transfer submitted');
    await expect(page.getByTestId('audit-reference')).toBeVisible();

    const auditRef = await page.getByTestId('audit-reference').textContent();
    expect(auditRef, 'Audit reference should not be empty (AUDIT_SILENT_FAILURE catch)').toBeTruthy();
    expect(auditRef!.length).toBeGreaterThan(10);
  });
});
