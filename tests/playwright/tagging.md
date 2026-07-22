# Playwright Tagging

Tags live in `test.describe` or test titles so the installed Playwright version
can filter them with `--grep`.

## Required Tags

| Tag | Use |
| --- | --- |
| `@smoke` | Fast release gate or deployment sanity check |
| `@regression` | Broader user journey or known-risk coverage |
| `@mobile` | Mobile or tablet viewport/device behavior |
| `@a11y` | Accessibility assertions |
| `@visual` | Screenshot regression |
| `@finance` | BrightBank domain |
| `@health` | HealthyU domain |
| `@commerce` | BuyItAll domain |
| `@api` | Playwright APIRequestContext checks |
| `@self-healing` | Locator healing evidence, warning-oriented |

## Runner Examples

```bash
npm run pw -- --tag @smoke --project chromium
npm run pw -- --tag @regression --domain finance --browser firefox
npm run pw -- --tag @mobile --device mobile-safari
npm run pw -- --tag @a11y --browser chromium
npm run pw -- --tag @self-healing --project chromium
```

Use multiple `--tag` values when a test must match all of them.
