# Work Item: Expression Guardrails

## Status
- State: DONE
- Priority: HIGH
- Branch: `issue-24-expression-guardrails`
- Issue: https://github.com/Frank-Yong/MDXTab/issues/24

## Description
Add explicit parser, evaluator, and dependency-graph guardrails for
pathological expressions so MDXTab rejects oversized or over-deep input with
structured diagnostics instead of runtime failures or unbounded work.

## Background

### Problem
The expression pipeline currently accepts arbitrarily large expressions and deep
dependency chains. That leaves several failure modes under crafted input:
- stack overflow in recursive parse/evaluate paths
- excessive work during tokenization or dependency traversal
- generic runtime failures instead of structured MDXTab diagnostics

### Scope
Issue #24 covers guardrails for:
- expression length
- token count
- AST depth
- dependency traversal depth

### Key files
- `packages/core/src/tokens.ts` — tokenization and input-size limits
- `packages/core/src/parser.ts` — AST construction and parse-depth limits
- `packages/core/src/evaluator.ts` — evaluation-depth limits
- `packages/core/src/dependency-graph.ts` — dependency traversal limits
- `packages/core/src/document.ts` — contextual diagnostic wrapping
- `packages/core/src/__tests__/lexer-parser.spec.ts`
- `packages/core/src/__tests__/dependency-graph.spec.ts`
- `packages/core/src/__tests__/evaluator.spec.ts`
- `packages/core/src/__tests__/document.spec.ts`

## Current implementation
- Added central guardrail constants and helpers in
  `packages/core/src/expression-limits.ts`.
- Added lexer checks for maximum expression length and token count.
- Added parser and evaluator checks for AST/evaluation depth.
- Added dependency traversal depth checks in the dependency graph builder.
- Added contextual `E_LIMIT` diagnostics for computed columns, aggregates, and
  dependency failures.
- Added regression tests covering lexer, parser, evaluator, dependency graph,
  and end-to-end document validation.

## Tasks

### 1. Core guardrails
- [x] Add shared guardrail constants and helper functions.
- [x] Enforce maximum expression length.
- [x] Enforce maximum token count.
- [x] Enforce maximum AST depth during parse/evaluate.
- [x] Enforce maximum dependency traversal depth.

### 2. Diagnostics
- [x] Return structured `E_LIMIT` diagnostics instead of generic runtime
  failures.
- [x] Preserve table and column or aggregate context for computed and aggregate
  expressions.
- [x] Surface dependency-depth failures through normal validation results.

### 3. Tests
- [x] Add lexer tests for token-count limits.
- [x] Add parser tests for deep nesting.
- [x] Add evaluator tests for depth-limit failures.
- [x] Add dependency-graph tests for deep chains.
- [x] Add document-level tests for contextual diagnostics.
- [x] Run the core test suite successfully.

### 4. Remaining work
- [x] Document the new limits and expected diagnostics in user-facing docs.
- [x] Decide whether the limits should remain hard-coded or become configurable.
- [x] Add smoke coverage where useful in CLI and extension-facing flows.

### 5. CLI note
- [x] Document CLI flags for overriding expression limits.

### 6. VS Code settings
- [x] Add VS Code settings for overriding expression limits.
- [x] Use the configured limits for preview rendering and validation.

## Acceptance criteria
- [x] Pathological expressions are rejected with `E_LIMIT` diagnostics.
- [x] Failures are reported through normal validation/compile surfaces.
- [x] Parser, evaluator, and dependency graph are all covered by limit checks.
- [x] Regression tests cover each guarded path.
- [x] Limits are documented for contributors and users.
- [x] Guardrail limits can be overridden through core compile options and CLI flags.
- [x] Guardrail limits can be overridden through VS Code settings.
