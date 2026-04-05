# Work Item: Aggregate min/max hardening

## Status
- State: TODO
- Priority: HIGH
- Branch: `issue-26-aggregate-min-max-hardening`
- Issue: https://github.com/Frank-Yong/MDXTab/issues/26

## Description
Harden aggregate `min()` and `max()` evaluation for large tables by avoiding spread-based implementations and validating behavior with stress-style regression tests.

## Background

### Problem summary
- Spread-based aggregate implementations (`Math.min(...nums)` and `Math.max(...nums)`) are fragile for large input sizes.
- Large row counts can trigger argument explosion and runtime instability.

### Desired behavior
- Aggregate evaluation remains stable as row counts grow.
- `min()` and `max()` use iterative scans instead of spreading arrays into function arguments.
- Regression coverage protects against reintroducing spread-based behavior.

### Key files
- `packages/core/src/document.ts` - aggregate runtime behavior
- `packages/core/src/__tests__/document.spec.ts` - document-level aggregate coverage
- `packages/cli/src/__tests__/cli.spec.ts` - CLI-level regression coverage (if needed)
- `dev/docs/v1-priority-order.md` - v1 release order tracking

## Tasks

### 1. Verify implementation path
- [x] Confirm `min()` and `max()` use iterative logic in aggregate evaluation.
- [x] Confirm no spread-based aggregate fallback remains in runtime paths.

Verification notes:
- `packages/core/src/document.ts` uses iterative scans for `min` and `max` in `computeAggregateValues`.
- Runtime aggregate paths (`computeAggregate` and `computeGroupedAggregate`) route through `computeAggregateValues` with no spread-based fallback.

### 2. Add stress-style coverage
- [x] Add a regression test with a large numeric table that evaluates `min()` and `max()`.
- [x] Ensure the test verifies both correctness and stable execution.

Coverage notes:
- Added a core integration regression test in `packages/core/src/__tests__/document.spec.ts` that compiles a 20,000-row table and validates aggregate `min(value)` and `max(value)` results.
- The test executes through the normal compile path to confirm stable runtime behavior under larger row counts.

### 3. Validate and document
- [ ] Run core tests (and CLI tests if touched).
- [ ] Update issue/work-item status notes after validation.

## Acceptance criteria
- [ ] Aggregate `min()` and `max()` do not rely on spread over full arrays.
- [ ] Large-table regression test passes reliably.
- [ ] Test suite passes with no regressions in aggregate behavior.
