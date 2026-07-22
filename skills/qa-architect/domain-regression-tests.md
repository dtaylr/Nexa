# Domain Regression Checklist

## Finance

- Transfer creation validates source, destination, amount, reference, and auth.
- Balance checks are atomic under concurrent requests.
- Monthly summary avoids float drift.
- Audit references are written and surfaced.

## Health

- Appointment booking rejects double-booking and invalid patient access.
- Medication dosage values remain numeric where expected.
- Patient records reject IDOR access.
- Cancel appointment dialog remains keyboard accessible.

## Commerce

- Promo codes cannot be stacked unexpectedly.
- Inventory decrement is atomic under concurrent checkout.
- Payment and fraud side effects occur in the correct order.
- Product prices render with two-decimal precision.
- Checkout remains usable on mobile without horizontal overflow.
