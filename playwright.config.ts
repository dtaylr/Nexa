import { defineConfig, devices } from '@playwright/test';

/**
 * Cross-browser / cross-device Playwright config.
 *
 * Desktop projects  — chromium, firefox, webkit, edge
 * Mobile projects   — mobile-chrome (Pixel 5), mobile-safari (iPhone 12),
 *                     mobile-small (iPhone SE), tablet (iPad Pro 11)
 *
 * Tag-based filtering (use with --tag):
 *   @smoke      — fast happy-path sanity checks
 *   @regression — full regression suite
 *   @mobile     — mobile-specific tests
 *   @a11y       — accessibility tests
 *   @finance | @health | @commerce — domain filter
 *
 * Note: Edge requires `npx playwright install msedge` locally.
 *       In CI, msedge is installed in the browser-install step.
 */

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  reporter: [
    ['html', { outputFolder: 'results/playwright', open: 'never' }],
    ['json', { outputFile: 'results/playwright/results.json' }],
    ['junit', { outputFile: 'results/playwright/junit.xml' }],
    ['list'],

    ...(process.env.CI ? [['github'] as const] : []),
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:6173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    //  Desktop — Chrome (Chromium)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [
        '**/ui/**/*.spec.ts',
        '**/accessibility/**/*.spec.ts',
        '**/visual/**/*.spec.ts',
        '**/smoke/**/*.spec.ts',
      ],
      testIgnore: '**/*-mobile.spec.ts',
    },

    //  Desktop — Firefox
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: [
        '**/ui/**/*.spec.ts',
        '**/smoke/**/*.spec.ts',
      ],
      testIgnore: '**/*-mobile.spec.ts',
    },

    //  Desktop — Safari (WebKit)
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: [
        '**/ui/**/*.spec.ts',
        '**/smoke/**/*.spec.ts',
      ],
      testIgnore: '**/*-mobile.spec.ts',
    },

    //  Desktop — Edge
    // Requires: npx playwright install msedge  (set PLAYWRIGHT_MSEDGE=1 to enable)
    ...(process.env.PLAYWRIGHT_MSEDGE ? [{
      name: 'edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
      testMatch: [
        '**/ui/**/*.spec.ts',
        '**/smoke/**/*.spec.ts',
      ],
      testIgnore: '**/*-mobile.spec.ts',
    }] : []),

    //  Mobile — Android Chrome (Pixel 5, 393×851) 
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: '**/*-mobile.spec.ts',
    },

    //  Mobile — iOS Safari (iPhone 12, 390×844) 
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
      testMatch: '**/*-mobile.spec.ts',
    },

    //  Mobile — iOS Safari small (iPhone SE, 375×667) 
    {
      name: 'mobile-small',
      use: { ...devices['iPhone SE'] },
      testMatch: '**/*-mobile.spec.ts',
    },

    //  Tablet — iPad Pro 11 (834×1194) 
    {
      name: 'tablet',
      use: { ...devices['iPad Pro 11'] },
      testMatch: '**/*-mobile.spec.ts',
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: 'concurrently "npm run dev:api" "npm run dev:web"',
        port: 6173,
        reuseExistingServer: true,
        timeout: 30000,
      },
});
