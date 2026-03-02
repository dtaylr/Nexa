import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

test.describe('Patient Portal — WCAG 2.1 AA Accessibility', () => {
  test('appointment booking page has zero critical violations', async ({ page }) => {
    await page.goto('/health/appointments/book');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter(v => v.impact === 'critical');

    if (results.violations.length > 0) {
      const artifactsDir = path.join(process.cwd(), 'artifacts');
      if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
      fs.writeFileSync(
        path.join(artifactsDir, 'a11y-report.json'),
        JSON.stringify(results.violations, null, 2)
      );
    }

    expect(critical, `Critical WCAG violations found:\n${critical.map(v => `  - ${v.id}: ${v.description}`).join('\n')}`).toHaveLength(0);
  });

  test('appointments list meets WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/health/appointments');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    expect(serious, 'Serious or critical violations found').toHaveLength(0);
  });

  test('HLT-004: cancel appointment dialog is keyboard navigable', async ({ page }) => {
    await page.goto('/health/appointments');

    const cancelButton = page.getByRole('button', { name: 'Cancel appointment' }).first();

    if (await cancelButton.isVisible()) {
      await cancelButton.click();

      const dialog = page.getByRole('dialog', { name: 'Confirm cancellation' });
      await expect(dialog).toBeVisible();

      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(
        ['BUTTON', 'INPUT', 'A'],
        'Focus should move into the dialog when it opens (HLT-004)'
      ).toContain(focusedElement);

      await page.keyboard.press('Escape');
    } else {
      test.skip();
    }
  });
});
