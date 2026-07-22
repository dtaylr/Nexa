---
name: fullstack-execution
description: Production engineering standards for Nexa / 1Platform. Use when building API routes, React flows, test automation, data validation, or quality-gate tooling.
user-invocable: false
---

# Fullstack Execution Standards

## Stack

- Express 4 API with TypeScript and better-sqlite3.
- React 18 client with Vite and react-router-dom.
- SQLite for local development and in-memory test execution.
- Vitest/Supertest, Playwright, Pact, Cucumber, k6, Stryker, and Bruno for
  verification.

## API

- Validate request bodies server-side.
- Enforce auth and ownership boundaries at route/service edges.
- Return safe error payloads without stack traces, internal IDs, or PII.
- Keep response shapes stable and covered by tests or contracts.
- Preserve seeded bugs unless the task explicitly changes showcase scope.

## Data

- Use synthetic seed data only.
- Avoid exposing account numbers, patient identifiers, payment details, JWTs, or
  password hashes in responses, logs, reports, screenshots, or docs.
- Update seed data, builders, contracts, and tests together when schemas change.

## Web

- Keep token handling consistent with existing domain localStorage keys.
- Cover loading, empty, validation, auth, and API error states.
- Use stable selectors or accessible roles for Playwright coverage.
- Keep mobile layout constraints testable with viewport/device projects.

## Architecture Rules

- No unnecessary dependencies.
- Prefer small helpers over broad rewrites.
- Security-sensitive changes need negative tests.
- Browser changes need a targeted Playwright check.
