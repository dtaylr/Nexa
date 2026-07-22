# Quality Gate Failure

Use this when a release gate, Playwright run, or generated quality report fails.

## Triage

1. Confirm the runtime is Node 20.
2. Re-run the narrowest failing command.
3. Check `results/playwright/`, `test-results/`, and `artifacts/` locally.
4. Separate known seeded failures from unexpected failures.
5. If `artifacts/healing-events.json` exists, inspect healed selectors and
   decide whether test selectors need maintenance.

## Common Commands

```bash
npm run typecheck
npm run lint
npm run repo:structure
npm run pw -- --tag @smoke --project chromium
npm run pw -- --tag @self-healing --project chromium
```

## Escalation

Ask for human signoff before changing auth/security behavior, CI workflows,
dependencies, generated baselines, deployment config, or guarded paths listed in
`agents/guardrails.json`.
