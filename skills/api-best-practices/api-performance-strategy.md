# API Performance Strategy

Measure server latency and end-to-end response time separately. Optimize the slowest percentile, not the average.

## Latency Targets

| Endpoint type | Good | Needs attention | Unacceptable |
| --- | ---: | ---: | ---: |
| Health | < 50ms | > 100ms | > 250ms |
| Simple CRUD | < 100ms | > 200ms | > 500ms |
| Auth | < 200ms | > 500ms | > 1s |
| Search/filter | < 300ms | > 700ms | > 1.5s |

## Required Metrics

- Method, route, status, and response time.
- P50, P95, and P99 by endpoint.
- Error rate alongside latency.
- Database connection and query failures.

## Endpoint Classification

- `health`: service readiness.
- `auth`: registration, login, and token-guarded identity.
- `finance`: accounts, transfers, statements, cards, beneficiaries, fraud.
- `health`: patients, appointments, medications, lab results, prescriptions,
  messages, insurance, billing, symptom triage.
- `commerce`: products, cart, checkout, orders, returns, wishlist, loyalty.
- `reports`: triage, matrix, stakeholder, Lighthouse, mutation, and load output.

## Remediation Order

1. Missing indexes.
2. N+1 request patterns from the client.
3. Repeated database connection setup.
4. Oversized response payloads.
5. Missing pagination for future large contact lists.

## Agent Policy

- Classify the endpoint before judging latency.
- Inspect P95/P99 before averages.
- Treat ownership, PII, payment, and auth failures as correctness issues before
  performance issues.
- Prefer indexes, pagination, field selection, and request consolidation before caching.
