# Coding Standards

## TypeScript

- Match the existing Express, React, Vite, Vitest, and Playwright patterns.
- Prefer typed helpers over ad hoc string parsing when structured data is
  available.
- Keep validation and ownership checks close to API boundaries.
- Do not log tokens, passwords, JWTs, PII, local DB contents, or real secrets.

## Tests

- API tests live under `tests/<domain>/api`, `p0-smoke`, `p1-regression`,
  `negative`, `security`, and related layer folders.
- Playwright tests use title tags such as `@smoke`, `@regression`, `@finance`,
  `@health`, `@commerce`, `@mobile`, `@a11y`, `@visual`, and `@self-healing`.
- Known seeded bugs must keep explicit bug IDs in test names or assertion
  messages.
- Self-healing locator tests may warn and write evidence, but must not hide real
  behavior failures.

## Docs

- Human-facing docs live in `docs/`.
- Agent-facing routing, rules, prompts, plans, and context live in `agents/`.
- Reusable Codex skills live in root `skills/<skill-name>/SKILL.md`.
- Durable technical choices belong in `docs/adr/`.
- Operational triage instructions belong in `docs/runbooks/`.
