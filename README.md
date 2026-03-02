# NexaCore Platform

A multi-domain quality engineering showcase built to demonstrate realistic SDET work across three industries: **Finance**, **Healthcare**, and **E-Commerce**.

The platform is two things in one repo:

1. **NexaCore** — a Node.js + Express API and React frontend that models real domain logic for each industry, including intentionally seeded bugs that mirror the failure modes these industries actually care about.
2. **TestOps Intelligence** — the test suite, CI pipeline, and AI triage engine that runs against it.

The point is not to test a toy app. Every bug, every test assertion, and every CI job maps to a real business risk in its domain.

---

## Prerequisites

- Node.js 20+
- npm 10+

No external services, databases, or paid APIs required. Everything runs locally with SQLite.

---

## Getting Started

```bash
npm install
npm run seed       # creates data/nexacore.db with realistic fixture data
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

```bash
# All API tests across all domains
npm run test:api:finance
npm run test:api:health
npm run test:api:commerce

# E2E (start dev servers first with `npm run dev`)
npx playwright test tests/finance/ui
npx playwright test tests/health/ui
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

Output is printed to stdout and written to `artifacts/triage-report.json`. Finance and healthcare CRITICAL failures set exit code 1 to block automated merges.

---

## CI Cost Report

```bash
npm run cost:report
```

Produces `artifacts/cost-report.json` with estimated runner cost, total defects caught, and cost-per-defect for the current month. GitHub Actions public repo usage is free (2000 min/month); the report uses private repo pricing as a reference baseline.

---

## CI Pipeline

The nightly regression workflow (`.github/workflows/nightly-regression.yml`) runs on a schedule at 02:00 UTC Monday–Friday and on every pull request against `main`.

```
contract-tests (per domain, parallel)
  → api-tests (per domain, parallel)
    → e2e-tests (per domain × 2 shards = 6 runners, parallel)
    → accessibility-tests
      → lighthouse-audit
post-run-analysis (always, collects all JUnit results)
```

Each domain fails independently — a health test failure does not suppress finance results.

---

## Docker

```bash
docker compose up
```

Builds and starts the API on `:3001` and the web frontend on `:3000`. The API container seeds the database on first run.

---

## Architecture Decisions

See [docs/INTERVIEW_DECISIONS.md](docs/INTERVIEW_DECISIONS.md) for the reasoning behind every major choice in this project — database selection, monetary storage format, intentional bug implementation patterns, and test strategy choices.
