import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:6173';

async function loginAndGetToken(page: any, email: string, password: string): Promise<string> {
  const res = await page.request.post(`${BASE.replace('6173', '3001')}/api/auth/login`, {
    data: { email, password },
  });
  const { token } = await res.json();
  return token;
}

test.describe('Finance — Transfer Flow', () => {
  test.beforeEach(async ({ page }) => {
    const token = await loginAndGetToken(page, 'alice@1platform.dev', 'password123');
    await page.goto('/BrightBank/dashboard');
    await page.evaluate(t => localStorage.setItem('fin_token', t), token);
    await page.reload();
  });

  test('transfer flow shows confirmation with audit reference', async ({ page }) => {
    await page.goto('/BrightBank/dashboard');
    await page.getByRole('link', { name: 'New Transfer' }).click();

    await page.getByLabel('From account').selectOption({ label: /Current Account/ });
    await page.getByLabel(/To account/).fill('GB29NWBK60161331926819');
    await page.getByLabel('Amount').fill('150.00');
    await page.getByLabel('Reference').fill('Rent - October');

    await page.getByRole('button', { name: 'Review Transfer' }).click();

    await expect(page.getByTestId('transfer-amount')).toHaveText('.00');
    await expect(page.getByTestId('transfer-reference')).toHaveText('Rent - October');

    await page.getByRole('button', { name: 'Confirm Transfer' }).click();

    await expect(page.getByTestId('transfer-status')).toHaveText('Transfer Submitted');
    await expect(page.getByTestId('audit-reference')).toBeVisible();

    const auditRef = await page.getByTestId('audit-reference').textContent();
    expect(auditRef, 'Audit reference should not be empty (AUDIT_SILENT_FAILURE catch)').toBeTruthy();
    expect(auditRef!.length).toBeGreaterThan(10);
  });
});
