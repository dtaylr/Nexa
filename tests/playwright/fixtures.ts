import { test as base, expect } from '@playwright/test';
import { SelfHealingPage } from '../helpers/self-healing-page';
import { attachJson } from './hooks';

interface QualityFixtures {
  apiURL: string;
  selfHealingPage: SelfHealingPage;
  consoleErrors: string[];
}

export const test = base.extend<QualityFixtures>({
  apiURL: [process.env.API_URL ?? 'http://localhost:3001', { option: true }],

  selfHealingPage: async ({ page }, use, testInfo) => {
    await use(new SelfHealingPage(page, testInfo.file));
  },

  consoleErrors: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
      });

      await use(errors);

      if (errors.length > 0) {
        await attachJson(testInfo, 'console-errors', errors);
      }
    },
    { auto: true },
  ],
});

export { expect };
