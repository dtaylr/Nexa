# Contributing

Keep changes small, tested, and aligned with the quality-showcase intent.

## Local Setup

```bash
npm install
npm run seed
npm run dev
```

## Before Handoff

- Run `npm run typecheck` and `npm run lint` for TypeScript changes.
- Run the narrowest relevant test command for behavior changes.
- Run `npm run repo:structure` after changing docs, agent files, or repo layout.
- Do not commit generated reports, local DBs, screenshots, traces, coverage, or
  secrets.
- Do not stage or commit unless the human explicitly approves it.
