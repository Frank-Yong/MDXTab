# Changelog

All notable changes to MDXTab will be documented in this file.

## Unreleased
- Add `hours()` helper and `time` column type for time math.
- Support grouped aggregates with `sum/avg/min/max/count ... by <column>`.
- Add examples and docs for time entries and grouped aggregates.

## 2026-02-14 - 0.1.0 internal beta
- Core: parsing, evaluation, aggregates, and diagnostics with ranges.
- CLI: validate/render plus JSON diagnostics output.
- VS Code: preview, diagnostics, symbols, hovers, completions, and definitions.
- Tests: expanded coverage for diagnostics, ranges, and error cases.

## 2026-02-10 - Phase 0 complete
- Locked v1 semantics across the formal, technical, and development specs (numeric/null rules, rounding algorithm, identifier and reserved word constraints, interpolation escape/AST handling, header trimming for column names).
- Clarified diagnostics fields (code/message/severity) and aggregate argument/context error codes.
- Documented header trimming vs data cell preservation and aggregate argument restrictions to avoid parsing drift.
- Merged Phase 0 spec work (PR #1) into main; Phase 1 can begin.
