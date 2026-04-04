# Work Item: Finite-number semantics

## Status
- State: DONE
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

### Implementation summary
- The evaluator rejects divide-by-zero explicitly.
- The evaluator validates finite inputs for `round(x, n)`.
- Arithmetic operators now reject non-finite results after `+`, `-`, `*`, and
  `/` evaluation.
- Document and CLI diagnostics now surface these failures as `E_NUMBER`.

### Key files
- `packages/core/src/evaluator.ts` — arithmetic behavior and numeric helpers
- `packages/core/src/document.ts` — contextual diagnostic wrapping through
  validation/compile surfaces
- `packages/cli/src/__tests__/cli.spec.ts` — CLI diagnostic coverage
- `packages/core/src/__tests__/evaluator.spec.ts` — arithmetic behavior tests
- `packages/core/src/__tests__/document.spec.ts` — document-level diagnostics
- `specs/formal-format-spec.md` — source of truth for number semantics
- `specs/development-spec.md` — cross-runtime compliance notes
- `dev/examples/errors/non-finite-number.md` — minimal repro for `E_NUMBER`

## Tasks

### 1. Core finite-number enforcement
- [x] Add a shared helper that rejects non-finite numeric results.
- [x] Apply the helper to arithmetic results for `+`, `-`, `*`, and `/`.
- [x] Preserve existing null propagation semantics.
- [x] Preserve the existing divide-by-zero error behavior.

### 2. Diagnostics
- [x] Return a structured numeric error instead of leaking raw JavaScript
  `Infinity` or `NaN` behavior.
- [x] Ensure failures surface through normal validation and compile diagnostics
  with table and column or aggregate context.

### 3. Tests
- [x] Add evaluator tests for overflow or other non-finite arithmetic results.
- [x] Add regression coverage for any affected round-path behavior.
- [x] Add document-level tests proving non-finite arithmetic fails through the
  normal diagnostic surface.
- [x] Run the core and CLI test suites successfully.

### 4. Documentation
- [x] Confirm the implementation matches the v1 number rules in the formal spec.
- [x] Update any user-facing docs if new error wording or examples need to be
  clarified.

## Acceptance criteria
- [x] Arithmetic evaluation never returns `NaN` or `Infinity`.
- [x] Operations that would produce non-finite numbers fail deterministically.
- [x] Division by zero continues to fail explicitly.
- [x] Failures are reported through normal validation and compile diagnostics.
- [x] Regression tests cover the finite-number paths.