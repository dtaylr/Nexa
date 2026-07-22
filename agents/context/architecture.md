# Architecture

1Platform is a workspace-based TypeScript app.

## Runtime Flow

- `apps/api/src/app.ts` builds the Express application and mounts domain routers.
- `apps/api/src/index.ts` starts the API server.
- `apps/api/src/db.ts` owns SQLite connection and schema setup.
- `apps/web/src/App.tsx` routes between BrightBank, HealthyU, and BuyItAll.
- `apps/web/src/<domain>/` contains domain UI components.

## Test Flow

- Vitest/Supertest cover API, regression, negative, security, ML, chaos, and
  concurrency checks.
- Playwright covers browser smoke, domain UI, mobile, accessibility, visual,
  release-gate, and self-healing locator checks.
- Pact covers consumer contracts.
- Cucumber features capture business-readable behavior.
- k6 covers load scenarios.
- Stryker checks mutation quality.

## Evidence Flow

Generated outputs go to `results/`, `artifacts/`, `test-results/`,
`playwright-report/`, or coverage/report folders. These paths are ignored and
must not be committed.
