# Agent Router

Nexa / 1Platform is a TypeScript quality-engineering showcase with an Express
API, React/Vite web app, SQLite data layer, and layered QA automation across
Finance, Health, and Commerce.

## Golden Rules

- Read `README.md`, `agents/project.md`, `agents/workflows.md`, and the relevant
  `agents/context/*` file before changing code.
- Preserve seeded failures unless the human explicitly changes the showcase
  scope.
- Do not stage, commit, update baselines, change dependencies, or edit CI
  workflows without human approval.
- Treat auth, authorization, JWT behavior, PII paths, deployment config, and
  generated baselines as guarded areas. Check `agents/guardrails.json`.
- Add or update focused tests for behavior changes and run mechanical
  verification before handoff.
- Nested `AGENTS.md` files closer to edited files take precedence over this
  router.

## Routing

- Project intent: `agents/project.md`
- Workflows: `agents/workflows.md`
- Coding standards: `agents/coding-standards.md`
- Architecture: `agents/context/architecture.md`
- Domain model: `agents/context/domain-model.md`
- API contracts: `agents/context/api-contracts.md`
- Data schemas: `agents/context/data-schemas.md`
- Data sensitivity: `agents/context/data-sensitivity.md`
- Reusable role prompts: `agents/prompts/`
- Repo-local Codex skills: `skills/`
- Human docs, ADRs, and runbooks: `docs/`

## Layout Notes

- API production code lives under `apps/api/src/`.
- Web production code lives under `apps/web/src/`.
- Tests live under `tests/`, `features/`, and domain performance suites.
- AI/ML triage code lives under `ai/`.
- Generated outputs belong in ignored folders such as `artifacts/`, `results/`,
  `test-results/`, and `playwright-report/`.
