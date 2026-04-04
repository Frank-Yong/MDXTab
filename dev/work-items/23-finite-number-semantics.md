# Work Item: Finite-number semantics

## Status
- State: TODO
- Priority: HIGH
- Branch: `issue-25-finite-number-semantics`
- Issue: https://github.com/Frank-Yong/MDXTab/issues/25

## Description
Enforce the v1 number rules so arithmetic evaluation never produces `NaN` or
`Infinity`, and numeric behavior matches the documented finite-number semantics
before the 1.0 release.

## Background

### Spec requirement
- `specs/formal-format-spec.md` requires numbers to use IEEE-754 representation,
  while all evaluation results must remain finite.
- Operations that would produce `NaN` or `Infinity` must fail.
- Division by zero is already defined as an error.

### Current implementation gap
- The evaluator already rejects divide-by-zero.
- The evaluator already validates finite inputs for `round(x, n)`.
- Arithmetic operators do not yet have a central finite-result check after
  `+`, `-`, `*`, or `/` evaluation.
- That leaves a spec conformance gap for overflow or other non-finite numeric
  outcomes.

### Key files
- `packages/core/src/evaluator.ts` — arithmetic behavior and numeric helpers
- `packages/core/src/document.ts` — contextual diagnostic wrapping through
  validation/compile surfaces
- `packages/core/src/__tests__/evaluator.spec.ts` — arithmetic behavior tests
- `packages/core/src/__tests__/document.spec.ts` — document-level diagnostics
- `specs/formal-format-spec.md` — source of truth for number semantics
- `specs/development-spec.md` — cross-runtime compliance notes

## Tasks

### 1. Core finite-number enforcement
- [ ] Add a shared helper that rejects non-finite numeric results.
- [ ] Apply the helper to arithmetic results for `+`, `-`, `*`, and `/`.
- [ ] Preserve existing null propagation semantics.
- [ ] Preserve the existing divide-by-zero error behavior.

### 2. Diagnostics
- [ ] Return a structured numeric error instead of leaking raw JavaScript
  `Infinity` or `NaN` behavior.
- [ ] Ensure failures surface through normal validation and compile diagnostics
  with table and column or aggregate context.

### 3. Tests
- [ ] Add evaluator tests for overflow or other non-finite arithmetic results.
- [ ] Add regression coverage for any affected round-path behavior.
- [ ] Add document-level tests proving non-finite arithmetic fails through the
  normal diagnostic surface.
- [ ] Run the core and CLI test suites successfully.

### 4. Documentation
- [ ] Confirm the implementation matches the v1 number rules in the formal spec.
- [ ] Update any user-facing docs if new error wording or examples need to be
  clarified.

## Acceptance criteria
- [ ] Arithmetic evaluation never returns `NaN` or `Infinity`.
- [ ] Operations that would produce non-finite numbers fail deterministically.
- [ ] Division by zero continues to fail explicitly.
- [ ] Failures are reported through normal validation and compile diagnostics.
- [ ] Regression tests cover the finite-number paths.