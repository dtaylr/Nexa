---
name: secret-commit-safety
description: Use before editing, adding, committing, or pushing environment files, GitHub Actions workflows, deployment config, analytics/pixel config, API integrations, tokens, keys, IDs, credentials, webhook secrets, or any file that might expose sensitive values. Requires stopping to flag risk before any secret/env value is committed.
---

# Secret Commit Safety

This repo treats API keys, tokens, credentials, webhook secrets, analytics IDs, pixel IDs, project IDs, dataset IDs, and real environment values as sensitive. Do not commit them.

## Mandatory Stop Conditions

Stop and warn the user before proceeding if a change would add any of these to tracked files:

- A real-looking env value, even for a browser-exposed variable.
- A pixel, analytics, dataset, project, client, webhook, API, OAuth, cloud, database, email, or deployment ID/key/token.
- A new env variable line in `.env.example`, `.env.*.example`, docs, or workflows unless the user explicitly approves documenting the variable name.
- A GitHub Actions `env:` value that is not a secret reference or harmless static app setting.
- A source-code fallback/default containing a real external service value.

When this happens, say plainly: "This looks like a sensitive value or env exposure. I should not commit it." Then remove it or ask how the user wants it configured.

## Allowed Patterns

- Runtime reads such as `process.env.SOME_KEY`.
- GitHub secret references such as `${{ secrets.SOME_KEY }}` only when the variable name is already part of the repo contract or the user explicitly asks for it.
- Empty placeholders only when the user explicitly wants an example file entry.
- Documentation that says to configure a value in the deployment platform without naming or showing the real value.

## Pre-Commit Checklist

Before any commit or push involving env, workflow, deployment, analytics, or integration files:

1. Run a tracked-file search for suspicious literals:
   `git grep -n -E "(sk_live_|sk_test_|pk_live_|whsec_|AIza|ya29\\.|xox[baprs]-|gh[pousr]_|pat_|eyJ|[0-9]{12,})" -- .`
2. Run targeted searches for touched integrations, for example `JWT`, `DB_PATH`,
   `ANALYTICS`, `API_KEY`, `TOKEN`, and `SECRET`.
3. Inspect `git diff --cached` if committing, otherwise `git diff`.
4. If any new value appears, stop and remove it before commit.

## History Cleanup

If a value was already pushed:

- Remove it from the current tree immediately.
- Tell the user that a normal follow-up commit does not remove it from Git history.
- Recommend rotation/replacement of the exposed value when possible.
- Use history rewrite only with explicit approval because it requires force-pushing and can disrupt collaborators.
