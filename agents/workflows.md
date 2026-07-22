# Workflows

## Before Editing

- Inspect local state with `git status --porcelain`.
- Read `README.md`, this agent router, and relevant source/test files.
- Check `agents/guardrails.json` before touching sensitive paths.
- Preserve user changes already present in the worktree.

## During Implementation

- Keep diffs small and reviewable.
- Update tests when behavior changes.
- Update docs when commands, architecture, workflow, or operational behavior
  changes.
- Use `agents/plans/` for multi-step work, guarded areas, or changes that need
  explicit human signoff.
- Keep generated reports, screenshots, traces, local DBs, and assistant state
  out of Git.

## Verification

- Docs/process only: `git diff --check` plus targeted text or structure checks.
- TypeScript changes: `npm run typecheck` and `npm run lint`.
- API behavior: run the narrowest matching `npm run test:*` command.
- Browser behavior: use `npm run pw -- ...` or the narrowest Playwright command.
- Broad handoff: run the relevant matrix documented in `README.md`.

Do not stage or commit without explicit human approval.
