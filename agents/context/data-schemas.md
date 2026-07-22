# Data Schemas

SQLite schema creation and seed data live in:

- `apps/api/src/db.ts`
- `db/seed.ts`
- `apps/api/src/admin/reset.ts`

## Schema Areas

- Users and auth records
- Finance accounts, transactions, transfers, cards, beneficiaries, statements,
  and fraud events
- Health patients, appointments, medications, lab results, prescriptions,
  messages, insurance, and billing
- Commerce products, carts, orders, promotions, returns, wishlist, and loyalty

Schema-changing work should update seed data, builders, API tests, contracts,
and any affected browser workflows together.
