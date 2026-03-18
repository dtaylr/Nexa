import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 15000,
    reporters: ['default', 'html', 'junit'],
    outputFile: {
      html: 'results/vitest/index.html',
      junit: 'results/vitest/junit.xml',
    },
    coverage: {
      provider: 'v8',
      reporters: ['text', 'json', 'html'],
      reportsDirectory: 'results/coverage',
      exclude: ['node_modules', 'tests/**', 'apps/web/**'],
    },
  },
});
