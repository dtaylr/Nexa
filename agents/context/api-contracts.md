# API Contracts

Canonical behavior lives in route handlers, Pact files, Bruno collections, and
Supertest assertions.

## Primary Routes

- Auth: `apps/api/src/auth/router.ts`
- Finance: `apps/api/src/finance/router.ts`
- Health: `apps/api/src/health/router.ts`
- Commerce: `apps/api/src/commerce/router.ts`
- Admin reset: `apps/api/src/admin/router.ts`

## Executable Contract Sources

- Pact contracts: `tests/*/contracts/` and `pacts/`
- API suites: `tests/*/api/`, `tests/*/p0-smoke/`, `tests/*/p1-regression/`,
  and `tests/*/negative/`
- Security suites: `tests/security/`
- Bruno collections: `bruno/1platform-api/`

When endpoint behavior changes, update tests, contracts, docs, and Bruno
requests together.
