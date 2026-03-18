# 1Platform — Quality Engineering Showcase

A full-stack multi-domain application with 15 intentional bugs and a test suite built to catch all of them.

---

## What It Is

1Platform is a production-realistic web application spanning three business domains — Finance, Health, and Commerce. The application contains intentional bugs modeled after real engineering mistakes: race conditions, float arithmetic errors, IDOR vulnerabilities, PII leakage, and accessibility failures. The test suite is designed to catch every one of them including failures.

The goal is to show a test suite that surfaces the bugs which may appear for a variety of reasons. It documents exactly what broke and why and integrates into a CI pipeline that blocks bad code from merging.

---

## Tech Stack

| Layer    | Technology                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------- |
| API      | Express 4 + TypeScript, better-sqlite3 (WAL mode), jsonwebtoken, bcryptjs, uuid                          |
| Web      | React 18 + Vite + react-router-dom (TypeScript)                                                          |
| Tests    | Vitest, Playwright + @axe-core, Pact (consumer contracts), Stryker (mutation), k6 (load), Cucumber (BDD) |
| CI       | GitHub Actions — nightly regression pipeline, 5-layer architecture                                       |
| Database | SQLite file-based (dev), SQLite in-memory (tests) — no external services required                        |

---

## The Intentional Bugs

Every seeded bug has a dedicated test that catches it. Tests reference the bug ID in the assertion message so a developer reading a red build immediately understands what broke and how to fix it.

### Finance Domain

| ID                     | Description                                             | Location               |
| ---------------------- | ------------------------------------------------------- | ---------------------- |
| AUDIT_SILENT_FAILURE   | Async audit write (fire-and-forget) can silently fail   | `finance/transfers.ts` |
| SUMMARY_FLOAT_DRIFT    | Float arithmetic accumulation in monthly summary report | `finance/reports.ts`   |
| JWT_GRACE_PERIOD       | 30-second JWT grace period accepts expired tokens       | `middleware/auth.ts`   |
| BALANCE_RACE_CONDITION | Non-atomic balance check creates a race condition       | `finance/transfers.ts` |
| ACCOUNT_ID_DISCLOSURE  | Account ID leaked in 404 error response body            | `finance/accounts.ts`  |

### Health Domain

| ID                         | Description                                           | Location                            |
| -------------------------- | ----------------------------------------------------- | ----------------------------------- |
| DOSAGE_TYPE_MISMATCH       | Medication dosage stored as TEXT, not numeric         | DB schema + `health/medications.ts` |
| PATIENT_PII_DISCLOSURE     | Patient ID echoed in 400 error response (PII leakage) | `health/patients.ts`                |
| APPOINTMENT_DOUBLE_BOOKING | No conflict check on concurrent appointment booking   | `health/appointments.ts`            |
| CANCEL_DIALOG_FOCUS_TRAP   | No focus trap in cancel appointment dialog            | `web/health/Appointments.tsx`       |
| PATIENT_RECORDS_IDOR       | IDOR — no ownership check on patient endpoints        | `health/patients.ts`                |

### Commerce Domain

| ID                       | Description                                               | Location                    |
| ------------------------ | --------------------------------------------------------- | --------------------------- |
| PROMO_CODE_STACKING      | Promo code can be applied multiple times (no dedup check) | `commerce/promotions.ts`    |
| INVENTORY_OVERSELL_RACE  | Inventory check and decrement are not atomic              | `commerce/orders.ts`        |
| EMAIL_BEFORE_PAYMENT     | Fraud flag written before payment is confirmed            | `commerce/orders.ts`        |
| CHECKOUT_MOBILE_OVERFLOW | No max-width on checkout inputs causes horizontal scroll  | `web/commerce/Checkout.tsx` |
| PRICE_FLOAT_PRECISION    | Product prices returned as raw IEEE 754 floats            | `commerce/products.ts`      |

---

## Test Architecture

The suite is organized into distinct layers, each targeting a different failure class:

| Layer              | Tool                  | What It Targets                                                |
| ------------------ | --------------------- | -------------------------------------------------------------- |
| Smoke / P0         | Vitest + Supertest    | Core happy paths — confirms the app boots and basic flows work |
| Regression / P1    | Vitest + Supertest    | Known bug scenarios, edge cases, boundary values               |
| Negative           | Vitest + Supertest    | Invalid input, auth failures, 4xx/5xx response contracts       |
| Security           | Vitest + Supertest    | OWASP API Top 10 — injection, IDOR, broken auth, alg:none      |
| Consumer Contracts | Pact                  | API shape agreements between frontend and backend              |
| BDD                | Cucumber + Gherkin    | Business-readable scenarios for all three domains              |
| Accessibility      | Playwright + axe-core | WCAG 2.1 AA compliance across all domain UIs                   |
| E2E / Visual       | Playwright            | Browser flows, mobile viewports, screenshot regression         |
| Chaos / ML         | Vitest + custom       | Anomaly detection, flakiness scoring, domain-aware triage      |
| Load               | k6                    | Finance transfer throughput, commerce browse under concurrency |
| Mutation           | Stryker               | Test suite quality — confirms assertions are meaningful        |

API tests run against the real Express app with a real in-memory SQLite database. No mocks, no stubs for internal dependencies. This catches the class of bugs that only surface at the boundary between route handler, business logic, and persistence — which is where most of the seeded bugs live.

---

## Running the App

Prerequisites: Node.js 20+, npm 10+. No external services or paid APIs required.

```bash
npm install
npm run seed    # creates data/1platform.db with fixture data
npm run dev     # starts API on :3001 and web on :6173 concurrently
```

The API health check is at `http://localhost:3001/health`.

---

## Running Tests

```bash
# Domain API suites (smoke + regression + negative combined)
npm run test:api:finance
npm run test:api:health
npm run test:api:commerce

# Security (OWASP API Top 10)
npm run test:security

# Consumer contract tests
npm run test:contracts:finance
npm run test:contracts:health
npm run test:contracts:commerce

# Accessibility (WCAG 2.1 AA) — requires running web server
npm run test:a11y

# BDD / Gherkin — requires running web server
npm run test:bdd

# Load tests — requires k6 installed and running API
npm run test:load:finance
npm run test:load:commerce

# Mutation testing
npm run test:mutation

# All API domains + generate HTML report
npm run test:report
```

Approximately 10 tests fail by design. Each failing test documents a seeded bug with the bug ID and the expected correct behavior in the assertion message. These failures are informative as they are the documentation.

---

## Key Design Decisions

**SQLite, not PostgreSQL.** No credentials, no external service, no cost. WAL mode handles concurrent reads. The race-condition bugs (BALANCE_RACE_CONDITION, INVENTORY_OVERSELL_RACE) are standard check-then-act mistakes that reproduce on any RDBMS — switching to PostgreSQL requires only changing the driver import.

**Monetary values stored as integers (cents).** This prevents IEEE 754 drift at the storage layer. The float bug in SUMMARY_FLOAT_DRIFT is deliberate: the reporting query accumulates with plain JS `+`, which is the real-world mistake the test catches.

**bcrypt cost=1 in tests.** Hash computation dominates auth test runtime. Cost=1 keeps the suite fast without changing the production cost factor (12).

**In-memory SQLite per test file.** Each file gets a fresh database. No teardown scripts, no shared state, no ordering dependencies between files.

**No mocking of internal dependencies.** Supertest hits the real Express router. Bugs at the handler-to-persistence boundary are caught directly, not hidden behind mocks.

**JWT self-signed, no auth service.** The 30-second grace period in JWT_GRACE_PERIOD is a documented bad pattern. The test records it rather than skipping it. The fix is one line.

---

## CI Pipeline

The nightly regression workflow (`.github/workflows/nightly-regression.yml`) runs at 02:00 UTC Monday–Friday and on every pull request against `main`.

```
Layer 1 — Contract tests (per domain, parallel, no server required)
Layer 2 — API tests + Security tests (per domain, parallel)
Layer 3 — BDD + E2E + Accessibility + Visual regression (parallel)
Layer 4 — Load tests (nightly/manual only, skipped on PRs)
Layer 5 — AI triage + cost report (always runs, posts PR comment)
```

Finance and health CRITICAL failures set a non-zero exit code to block automated merges. Commerce failures are treated as lower severity unless the checkout flow is broken.

---

## Reports and Artifacts

| Report                          | Path                                |
| ------------------------------- | ----------------------------------- |
| Vitest JSON + HTML coverage     | `results/vitest/`                   |
| Playwright traces + screenshots | `results/playwright/`               |
| Mutation report                 | `artifacts/mutation-report.html`    |
| k6 load summaries               | `artifacts/k6-finance-summary.json` |
| AI triage output                | `artifacts/triage-report.json`      |
| CI cost estimate                | `artifacts/cost-report.json`        |

---

## Repository Structure

```
apps/api/src/          Express API — finance/, health/, commerce/, auth/, middleware/
apps/web/src/          React frontend — finance/, health/, commerce/
db/seed.ts             Realistic seed data for all three domains
tests/                 Test suites organized by domain and layer
ai/triage-engine/      Domain-aware failure classification
.github/workflows/     CI pipeline definitions
```

---
