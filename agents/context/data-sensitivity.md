# Data Sensitivity

## Sensitive Values

- Passwords, JWTs, auth headers, reset tokens, and session-like values
- Patient identifiers, medical records, lab results, prescriptions, insurance,
  billing data, and messages
- Account numbers, balances, card data, fraud events, beneficiaries, and
  transfer references
- Shopper emails, addresses, payment details, order history, and returns data
- Real `.env` values, local DB files, logs, traces, screenshots, and reports

## Rules

- Use synthetic fixture data only.
- Never echo secrets or real PII into docs, plans, prompts, logs, reports, or
  committed fixtures.
- Generated evidence may include opaque IDs, route names, statuses, timestamps,
  project names, and coarse metadata.
- Treat auth, middleware, health patient routes, finance account/transfer
  routes, payment/checkout flows, and deployment config as guarded paths.
