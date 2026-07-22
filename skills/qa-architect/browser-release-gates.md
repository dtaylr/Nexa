# Browser Release Gate Checklist

## Playwright Selection

- Use title tags and projects through `npm run pw -- ...`.
- Verify browser/device filters select the intended test set.
- Keep `@smoke`, `@regression`, `@mobile`, `@a11y`, `@visual`, and domain tags
  current.

## Required Assertions

- Critical routes load without console errors.
- Authenticated domain landing pages render expected business content.
- Mobile checks assert no horizontal overflow and usable touch targets.
- Accessibility checks assert serious/critical violations, not just scan
  completion.
- Self-healing locator checks write warning evidence and still assert real UI
  behavior.

## Evidence

- Release gate evidence is project-specific.
- Healing events are written to `artifacts/healing-events.json`.
- Screenshots, videos, traces, reports, and local DBs remain ignored.
