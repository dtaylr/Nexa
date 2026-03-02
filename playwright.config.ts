import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html'], ['junit', { outputFile: 'results/junit.xml' }]],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/ui/**/*.spec.ts', '**/accessibility/**/*.spec.ts'],
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 12'] },
      testMatch: '**/ui/checkout-mobile.spec.ts',
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: 'concurrently "npm run dev:api" "npm run dev:web"',
        port: 3000,
        reuseExistingServer: true,
        timeout: 30000,
      },
});
