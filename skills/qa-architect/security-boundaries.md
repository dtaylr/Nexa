# Security Boundary Checklist

## Auth

- Missing token rejects protected finance, health, and commerce routes.
- Invalid token rejects protected routes with safe error payloads.
- Expired token is rejected without grace-period bypass.
- Password hashes and JWTs are never returned.

## Ownership

- Finance account, transfer, card, beneficiary, and statement access is scoped
  to the authenticated user.
- Health patient, appointment, medication, lab result, billing, insurance, and
  message access is scoped to the patient owner.
- Commerce wishlist, order, return, loyalty, and checkout flows enforce shopper
  boundaries where auth is required.

## Sensitive Data

- Error responses do not echo patient IDs, account IDs, tokens, payment details,
  stack traces, or internal file paths.
- Generated reports use synthetic data and opaque identifiers only.
