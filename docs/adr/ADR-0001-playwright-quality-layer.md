# ADR-0001 - Playwright Quality Layer

## Status

Accepted

## Context

1Platform needs browser automation that can demonstrate release readiness,
mobile coverage, accessibility checks, visual regression, and self-healing
locator evidence without adding a second E2E framework.

## Decision

Use Playwright as the browser automation standard. Tests are selected with title
tags and Playwright projects through `scripts/playwright-select.ts`.

Shared Playwright support lives under `tests/playwright/`:

- `global-setup.ts` records run context and prepares evidence directories.
- `fixtures.ts` exposes shared fixtures.
- `hooks.ts` contains reusable navigation, login, layout, and artifact helpers.
- `tagging.md` documents supported tags.

## Consequences

- A second browser E2E framework is out of scope for this repo.
- Browser filtering happens by tag, domain, browser, and device.
- Self-healing locator behavior must write evidence and remain warning-oriented.
- Generated artifacts remain ignored and must not be committed.
