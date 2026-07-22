---
name: security-audit
description: Pre-release security checklist for Nexa / 1Platform. Run after auth, authorization, PII, config, dependency, workflow, API, or deployment changes.
disable-model-invocation: true
argument-hint: "[focus-area]"
---

# Security Audit

$ARGUMENTS

## Checklist

### 1. Secrets And Config
- [ ] No real secrets are committed.
- [ ] `.env.example` documents variable names only.
- [ ] `JWT_SECRET`, DB paths, and service URLs are local or secret-managed.
- [ ] Generated reports, traces, screenshots, and local DBs stay ignored.

### 2. Auth And Authorization
- [ ] Missing and invalid tokens are rejected.
- [ ] Expired tokens are rejected without grace-period bypass.
- [ ] Domain routes enforce ownership and role expectations.
- [ ] Password hashes and JWTs are never returned.

### 3. PII And Financial Data
- [ ] Patient identifiers are not echoed in error bodies.
- [ ] Account identifiers are not leaked in 404 or validation errors.
- [ ] Payment, checkout, and order flows avoid sensitive-data logging.
- [ ] Test evidence uses synthetic data only.

### 4. Input Validation
- [ ] Finance transfer payloads validate account, amount, and reference data.
- [ ] Health appointment and patient payloads validate ownership and shape.
- [ ] Commerce checkout, cart, promo, and order payloads reject malformed data.
- [ ] Malformed payloads return safe 4xx responses.

### 5. HTTP Hardening
- [ ] Security headers are enabled.
- [ ] JSON body size is limited.
- [ ] CORS is scoped to expected local/dev origins.
- [ ] Production errors do not expose stack traces.

### 6. Dependency Audit
- [ ] High/critical dependency findings are reviewed.
- [ ] Dependency upgrades are covered by tests before merge.

### 7. Quality Gate
- [ ] Security tests pass or seeded failures are explicitly documented.
- [ ] Targeted API/browser tests pass.
- [ ] Any guarded path change references a plan or human signoff.
