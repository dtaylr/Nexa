import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['node_modules', '**/accessibility/**', '**/ui/**', '**/e2e/**', '**/playwright/**', '**/visual/**', '**/smoke/**'],
    testTimeout: 15000,
    reporters: ['default', 'json', 'junit'],
    outputFile: {
      json: 'results/vitest/results.json',
      junit: 'results/vitest/junit.xml',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'results/coverage',
      exclude: ['node_modules', 'tests/**', 'apps/web/**'],
    },
  },
});
