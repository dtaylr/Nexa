# Domain Model

## BrightBank

Users own financial accounts. Transfers must preserve balances, produce audit
evidence, avoid race conditions, and avoid leaking account identifiers in error
responses.

## HealthyU

Patients own medical records. Appointments, medications, lab results,
prescriptions, insurance, billing, and messages must enforce patient ownership
and avoid exposing PII in logs, errors, reports, or fixtures.

## BuyItAll

Shoppers browse products, manage carts and wishlists, apply promotions, place
orders, request returns, and redeem loyalty benefits. Checkout and inventory
flows must be resilient to race conditions, price precision issues, and mobile
layout regressions.

## Seeded Failure Contract

Known failures are part of the showcase. Tests should document them with stable
bug IDs and expected correct behavior. Do not remove or soften those tests just
to make a gate green.
