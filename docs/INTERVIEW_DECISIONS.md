# Engineering Decisions

Key choices made in this project and the reasoning behind each.

---

## Database: SQLite over PostgreSQL

SQLite keeps the project self-contained — no external service, no credentials, no cost. WAL mode enables concurrent reads. The race-condition bugs (FIN-004, COM-002) are deliberately implemented with check-then-act patterns that are correctably wrong in any RDBMS, not SQLite-specific. Swapping to PostgreSQL requires only changing the `better-sqlite3` import and adjusting the connection string — the schema is ANSI-compatible.

## Monetary storage in pence (integer), not decimal

Finance accounts store balance as `INTEGER` (pence), never float. This avoids IEEE 754 drift at the storage layer. The float bug in the monthly summary report (FIN-002) is deliberate: the API uses plain JS `+` when accumulating, which is the real-world mistake we want the test to catch.

## Intentional bugs are real code patterns, not stubs

Every seeded bug is an actual engineering mistake a developer might make under time pressure — async audit writes without error handling (FIN-001), string-typed DB columns (HLT-001), missing ownership checks (HLT-005), no transaction around inventory decrement (COM-002). They exist to demonstrate that the test suite catches real failure modes, not manufactured ones.

## JWT grace period (FIN-003) implemented at middleware level

Real-world implementations sometimes add grace periods to handle clock skew. The 30-second window here is a known bad pattern that the test documents rather than skips. The fix is one line: remove `ignoreExpiration: true` and compare `decoded.exp < Math.floor(Date.now() / 1000)` directly.

## Supertest for API tests, Playwright for E2E

Supertest hits the Express app directly (no network round-trip), making API tests fast and deterministic. Playwright handles the browser layer where network, rendering, and CSS interact. Mixing them in the same repo means CI can run API tests in 10s and only spin up the browser for the ~20 tests that genuinely need it.

## Test assertions document bugs explicitly

Tests that catch known bugs include the bug ID in the assertion message and a comment explaining what the correct behaviour should be. This means a developer reading a red test understands both what broke and what the fix is, without digging through the issue tracker.

## No mocking of internal dependencies

API tests run against the real Express app with a real SQLite (in-memory) database. No stubs, no manual DI containers. This catches integration failures at the layer where most bugs actually live — the interaction between route handler, business logic, and persistence.

## Domain taxonomy in the triage engine

Finance failures default to `escalate: true` for any CRITICAL severity because financial data integrity issues warrant human review before any automated merge. Healthcare PII leakage is similarly blocked. Commerce failures are lower-stakes by default (MEDIUM/HIGH) unless checkout flow is broken, which is treated as CRITICAL due to direct revenue impact.
