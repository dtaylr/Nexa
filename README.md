# NexaCore Platform

A multi-domain quality engineering showcase built to demonstrate SDET work across three industries: **Finance**, **Healthcare**, and **E-Commerce**.

The platform is two things in one repo:

1. **NexaCore** — a Node.js + Express API and React frontend that models real domain logic for each industry, including intentionally seeded bugs that mirror the failure modes these industries actually care about.
2. **TestOps Intelligence** — the test suite, CI pipeline, and AI triage engine that runs against it.

Every bug, every test assertion, and every CI job maps to a real business risk in its domain.

---

## Prerequisites

- Node.js 20+
- npm 10+

No external services, databases, or paid APIs required. Everything runs locally with SQLite.

---

## Getting Started

```bash
npm install
npm run seed       # creates data/nexacore.db with fixture data
npm run dev        # starts API on :3001 and web on :3000 concurrently
```

The API health check is at `http://localhost:3001/health`.

### Demo credentials (created by seed)

| User | Email | Password | Role |
|---|---|---|---|
| Alice | alice@nexacore.dev | password123 | banker |
| Bob | bob@nexacore.dev | password123 | banker |
| Patient 1 | patient.one@nexacore.dev | password123 | patient |
| Patient 2 | patient.two@nexacore.dev | password123 | patient |
| Shopper | shopper@nexacore.dev | password123 | shopper |

Get a token:
```bash
curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@nexacore.dev","password":"password123"}' | jq .token
```

---

## Finance Domain

Models a retail banking module. Business logic covers account balances (stored as integer pence), inter-account transfers, audit trail integrity, and monthly reporting.

### Endpoints

```
POST /api/auth/login
GET  /api/finance/accounts/:id
GET  /api/finance/accounts/:id/transactions
POST /api/finance/transfers
GET  /api/finance/transfers/:id/audit
GET  /api/finance/reports/monthly-summary
```

### Seeded bugs

| ID | What it is | Where |
|---|---|---|
| FIN-001 | Audit log write is fire-and-forget — can silently fail under load | `apps/api/src/finance/transfers.ts` |
| FIN-002 | Monthly summary uses plain JS addition — `0.1 + 0.2 = 0.30000000000000004` | `apps/api/src/finance/reports.ts` |
| FIN-003 | JWT tokens are accepted for 30 seconds after expiry (grace period bug) | `apps/api/src/middleware/auth.ts` |
| FIN-004 | Balance check and debit are not wrapped in a transaction — race condition | `apps/api/src/finance/transfers.ts` |
| FIN-005 | Account ID is echoed back in 404 error response body | `apps/api/src/finance/accounts.ts` |

### Run finance tests

```bash
npm run test:api:finance
```

---

## Healthcare Domain

Models a patient portal. Business logic covers patient records, appointment scheduling, and medication data. FHIR-adjacent response shapes are used for medication resources.

### Endpoints

```
POST /api/auth/login
GET  /api/health/patients/:id
GET  /api/health/patients/:id/records
GET  /api/health/patients/:id/appointments
POST /api/health/appointments
PUT  /api/health/appointments/:id/cancel
GET  /api/health/patients/:id/medications
```

### Seeded bugs

| ID | What it is | Where |
|---|---|---|
| HLT-001 | Medication dosage is stored as `TEXT` — returned as `"10"` not `10` | `apps/api/src/db.ts` schema + `medications.ts` |
| HLT-002 | Patient ID is echoed in 400 error response (PII leakage) | `apps/api/src/health/patients.ts` |
| HLT-003 | No conflict check on concurrent appointment booking — double-booking possible | `apps/api/src/health/appointments.ts` |
| HLT-004 | Cancel appointment dialog has no focus trap or autofocus (keyboard navigation broken) | `apps/web/src/health/Appointments.tsx` |
| HLT-005 | Patient records have no ownership check — any authenticated user can access any patient by ID (IDOR) | `apps/api/src/health/patients.ts` |

### Run health tests

```bash
# API tests
npm run test:api:health

# WCAG 2.1 AA accessibility tests (requires running web server)
npm run test:a11y
```

---

## E-Commerce Domain

Models a product catalogue, cart, and checkout flow. Business logic covers inventory management, promotion validation, order creation, and payment sequencing.

### Endpoints

```
GET  /api/commerce/products
GET  /api/commerce/products/:id
POST /api/commerce/cart
PUT  /api/commerce/cart/:id/items
POST /api/commerce/orders
POST /api/commerce/orders/:id/payment
GET  /api/commerce/orders/:id
POST /api/commerce/promotions/validate
```

### Seeded products

| ID | Name | Price | Stock |
|---|---|---|---|
| (uuid) | Running Shoes V2 | £89.99 | 47 |
| (uuid) | Waterproof Trail Jacket | £149.99 | 23 |
| (uuid) | Technical Backpack 28L | £74.95 | 31 |
| (uuid) | GPS Sport Watch | £199.99 | 12 |
| PROD-999 | Limited Edition Cap | £29.99 | 1 (last item — race condition test) |

### Seeded promotion codes

| Code | Type | Value |
|---|---|---|
| SAVE10 | percentage | 10% |
| FLAT5 | fixed | £5 |

### Seeded bugs

| ID | What it is | Where |
|---|---|---|
| COM-001 | Same promotion code can be applied multiple times to one cart | `apps/api/src/commerce/promotions.ts` |
| COM-002 | Inventory check and decrement are not atomic — concurrent last-item orders both succeed | `apps/api/src/commerce/orders.ts` |
| COM-003 | `emailSent` is flagged at order creation, before payment is processed | `apps/api/src/commerce/orders.ts` |
| COM-005 | Checkout inputs have no `max-width` — causes horizontal scroll on 375px viewport | `apps/web/src/commerce/Checkout.tsx` |
| COM-006 | Product prices are returned as raw SQLite `REAL` floats without rounding | `apps/api/src/commerce/products.ts` |

### Run commerce tests

```bash
# API tests
npm run test:api:commerce

# Mobile checkout E2E (390px viewport, requires running web server)
npx playwright test tests/commerce/ui
```

---

## Running the Full Test Suite

### API Tests

```bash
npm run test:api:finance
npm run test:api:health
npm run test:api:commerce
```

### BDD — Cucumber / Gherkin

Executable Gherkin scenarios live in `features/`. Run them against a live server:

```bash
npm run dev          # start API + web in background
npm run test:bdd     # runs all .feature files, outputs HTML report to artifacts/
```

Feature files: `features/finance/transfer.feature`, `features/health/appointment.feature`, `features/commerce/checkout.feature`. Scenarios are written to be readable by non-engineers — each one maps directly to a seeded bug or business rule.

### Contract Tests (Pact)

Consumer-driven contract tests assert exact response shapes without a running server. They produce Pact files in `pacts/` that can be verified against the provider.

```bash
npm run test:contracts:finance    # transfer + accounts contracts
npm run test:contracts:commerce   # order + payment contracts
npm run test:contracts:health     # (placeholder — extend as needed)
```

Key assertions: Finance contracts enforce `auditId` presence (catches FIN-001) and the absence of `accountId` in 404 bodies (catches FIN-005). Commerce contracts enforce `emailQueued: false` at order creation time (catches COM-003).

### Security Tests (OWASP API Top 10)

```bash
npm run test:security
```

Covers: IDOR cross-user access (API1), missing/malformed/expired/wrong-secret/`alg:none` tokens (API2), role escalation via registration (API5), SQL injection in login and transfer endpoints, path traversal, negative amounts, oversized payloads, and security headers from Helmet.

### Mutation Testing (Stryker)

Measures test suite quality by introducing code mutations and checking that at least one test fails for each. Requires no running server.

```bash
npm run test:mutation
```

Targets `apps/api/src/finance/`, `health/`, and `commerce/`. Thresholds: break at 60%, low at 70%, high at 85%. Reports written to `artifacts/mutation-report.html` and `artifacts/mutation-report.json`.

### Load Tests (k6)

End-of-month volume simulation for Finance and catalogue-browse simulation for Commerce. Requires k6 installed (`brew install k6` on macOS).

```bash
npm run seed && npm run dev:api &
npm run test:load:finance    # ramps to 200 VUs, checks P95 < 500ms, audit ID presence, no account leakage
npm run test:load:commerce   # ramps to 50 VUs, checks P95 < 200ms, price decimal accuracy
```

Results written to `artifacts/k6-finance-summary.json` and `artifacts/k6-commerce-summary.json`.

### Visual Regression

Captures PNG baselines and diffs on subsequent runs. Finance dashboard balance values are masked to avoid noise from dynamic data.

```bash
# First run — generates baselines in tests/visual/__snapshots__/
npm run test:visual

# Accept intentional design changes
npm run test:visual:update
```

Viewports tested: desktop 1280×720 and mobile 390×844 (iPhone 14). Max pixel diff ratio: 2%.

### E2E and Accessibility

```bash
# E2E (start dev servers first with `npm run dev`)
npx playwright test tests/commerce/ui

# Accessibility (WCAG 2.1 AA)
npm run test:a11y
```

---

## AI Triage Report

After a test run that produces JUnit XML output, the triage engine classifies failures against a domain-specific pattern taxonomy and recommends remediation actions.

```bash
npm run triage:analyze
```

Output is written to `artifacts/triage-report.json`. Finance and healthcare CRITICAL failures set exit code 1 to block automated merges. On pull requests the CI pipeline posts a summary comment with severity icons directly to the PR.

---

## CI Cost Report

```bash
npm run cost:report
```

Produces `artifacts/cost-report.json` with estimated runner cost, total defects caught, and cost-per-defect for the current month. GitHub Actions public repo usage is free; the report uses private repo pricing as a reference baseline.

---

## CI Pipeline

The nightly regression workflow (`.github/workflows/nightly-regression.yml`) runs at 02:00 UTC Monday–Friday and on every pull request against `main`.

```
Layer 1 — Contract tests (per domain, parallel, no server needed)
  ↓
Layer 2 — API tests + Security tests (per domain, parallel)
  ↓
Layer 3 — BDD + E2E (sharded 2×) + Accessibility + Visual regression (all parallel)
  ↓
Layer 4 — Load tests (k6, nightly/manual only — skipped on PRs)
  ↓
Layer 5 — AI triage + cost report (always runs, posts PR comment on pull_request events)
```

Each domain fails independently. Load tests use `continue-on-error: true` so a threshold breach surfaces in the report without blocking the pipeline.

---

## Docker

```bash
docker compose up
```

Builds and starts the API on `:3001` and the web frontend on `:3000`. The API container seeds the database on first run.

---

## Architecture Decisions

See [docs/INTERVIEW_DECISIONS.md](docs/INTERVIEW_DECISIONS.md) for the reasoning behind choices in this project — database selection, monetary storage format, intentional bug implementation patterns, and test strategy choices.
