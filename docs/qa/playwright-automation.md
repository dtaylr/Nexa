# Playwright Automation

This repo uses Playwright for browser, mobile, accessibility, visual, release
gate, and self-healing locator checks.

## Selection Model

Tests are selected by title tags and Playwright projects:

| Filter | Examples |
| --- | --- |
| Tag | `@smoke`, `@regression`, `@release-gate`, `@a11y`, `@visual`, `@self-healing` |
| Domain | `@finance`, `@health`, `@commerce` |
| Browser | `chromium`, `firefox`, `webkit`, optional `edge` |
| Device | `mobile-chrome`, `mobile-safari`, `mobile-small`, `tablet` |

Use the helper script for readable commands:

```bash
npm run pw -- --tag @smoke --project chromium
npm run pw -- --tag @regression --domain finance --browser firefox
npm run pw -- --tag @mobile --device mobile-safari
npm run pw -- --tag @a11y --browser chromium
npm run pw -- --tag @self-healing --project chromium
```

## Shared Test Support

| File | Purpose |
| --- | --- |
| `tests/playwright/global-setup.ts` | Creates evidence/report directories and records run context |
| `tests/playwright/fixtures.ts` | Exposes `apiURL`, `selfHealingPage`, and console-error attachments |
| `tests/playwright/hooks.ts` | Shared login, domain navigation, overflow, touch-target, and artifact helpers |
| `tests/helpers/self-healing-page.ts` | Ranked locator fallback with healing event logging |
| `scripts/playwright-select.ts` | Composes tag, domain, browser, and device filters |

Self-healing is warning-oriented. A healed locator writes
`artifacts/healing-events.json` so QA can repair brittle selectors before they
become failures.

## Evidence

Generated outputs stay out of Git:

| Output | Path |
| --- | --- |
| Playwright HTML/JSON/JUnit | `results/playwright/` |
| Run context and release evidence | `artifacts/` |
| Traces, screenshots, videos | `test-results/` |
