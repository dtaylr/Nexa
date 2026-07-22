# QA Review Output Template

## 1. Change Summary

_What changed and why._

## 2. Risk Assessment

Severity: Low / Medium / High / Critical

_Explain the user, security, and regression risk._

## 3. Test Impact Analysis

- Existing tests expected to pass:
- New tests required:
- Uncovered edge cases:

## 4. Conditional Logic Review

| Condition | Expected behavior | Covered? |
| --- | --- | --- |
| _e.g. missing auth token_ | _private route rejects request_ | _Yes / No / Partial_ |
| _e.g. non-owner patient record access_ | _request returns 401, 403, or safe 404_ | _Yes / No / Partial_ |

## 5. Missing Tests

- _List exact tests, not vague categories._

## 6. Assertion Quality

_Do tests assert outcomes, state, payloads, and security boundaries?_

## 7. Release Blockers

- _Blockers or `None`._
