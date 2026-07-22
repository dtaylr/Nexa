# Project

Nexa / 1Platform demonstrates senior QA strategy through a realistic
multi-domain application. It intentionally includes product, security, data,
accessibility, reliability, and concurrency failures so the automation suite can
surface and explain them.

## Domains

- BrightBank: accounts, transfers, cards, beneficiaries, statements, fraud.
- HealthyU: patients, appointments, medications, lab results, billing,
  insurance, messages, symptom triage.
- BuyItAll: catalog, cart, checkout, orders, returns, wishlist, loyalty.

## Quality Bar

- API tests run against the real Express app and SQLite test data.
- Browser tests cover desktop, mobile, accessibility, visual, release-gate, and
  self-healing locator workflows with Playwright.
- Security tests cover auth, authorization, IDOR, injection, and sensitive-data
  leakage.
- Reports and triage outputs must produce traceable evidence without committing
  generated artifacts.
