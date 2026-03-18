module.exports = {
  ci: {
    collect: {
      // Audit a production build — avoids Vite HMR WebSocket keeping the
      // network permanently "active" and causing a 30s timeout.
      staticDistDir: './apps/web/dist',

      url: [
        'http://localhost/index.html',
        'http://localhost/',
      ],

      numberOfRuns: 2,

      settings: {
        chromeFlags: '--no-sandbox --disable-setuid-sandbox',
        preset: 'desktop',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        maxWaitForLoad: 30000,
      },
    },

    assert: {
      // Fail CI if any score drops below these thresholds
      assertions: {
        'categories:performance': ['warn', { minScore: 0.75 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.85 }],
        'categories:seo': ['warn', { minScore: 0.8 }],

        // Core Web Vitals gates
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 3500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        'interactive': ['warn', { maxNumericValue: 4000 }],

        // Catch missing essentials
        'document-title': 'error',
        'html-has-lang': 'error',
        'meta-description': 'warn',
        'uses-https': 'off',            // localhost won't pass HTTPS
        'canonical': 'off',             // no canonical in dev
      },
    },

    upload: {
      // Save reports locally — optionally push to LHCI server
      target: 'filesystem',
      outputDir: 'results/lighthouse',
    },
  },
};
