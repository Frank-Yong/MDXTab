# Changelog

All notable changes to MDXTab will be documented in this file.

## 2026-04-06 - 0.6.4
- Fix VS Code smoke test import paths to use `.js` extension targets under NodeNext so extension package builds succeed in CI.
- Restore Marketplace publish pipeline by removing `.ts` import suffixes that required unsupported TypeScript compiler settings.

## 2026-04-06 - 0.6.3
- Add automated VS Code extension smoke tests for activation, diagnostics update on open, preview rendering, and render-preview command execution.
- Replace the VS Code package placeholder test script with Vitest smoke-test execution.
- Set and package the Marketplace extension icon from `media/logo.png`.

## 2026-04-06 - 0.6.2
- Complete issue #26 and mark aggregate `min`/`max` large-table hardening done in release tracking docs.
- Strengthen core regression coverage for large-table `min`/`max` with a deterministic guard against spread-based fallback behavior.

## 2026-04-04 - 0.6.1
- Enforce finite-number semantics across parsing, coercion, evaluation, and aggregate paths so non-finite values fail with `E_NUMBER`.
- Harden aggregate `min`/`max` against large row sets by replacing spread-based calls with iterative scans.
- Improve diagnostics and examples for non-finite-number failures, including compact `E_NUMBER` messages and updated error docs.
- Expand regression coverage in core and CLI for non-finite literals, sourced values, arithmetic overflow, and aggregate overflow paths.

## 2026-04-02 - 0.6.0
- Add `report_tables` for synthetic derived markdown tables rendered from source rows plus aggregate/grouped-aggregate results.
- Support grouped-aggregate map access and safer report-table evaluation/markdown replacement behavior.
- Expand docs and examples for synthetic report tables, including migration away from hand-written HTML report sections.
- Harden frontmatter, evaluator, aggregate, and report-table map handling against prototype-key edge cases and improve report-table frontmatter diagnostics metadata.

## 2026-04-01 - 0.5.0
- Add expression guardrails that fail pathological expressions with `E_LIMIT` instead of unbounded parse/evaluate work.
- Add configurable expression limits in the core API for expression length, token count, measured AST depth, parser depth, and dependency traversal depth.
- Add CLI flags for expression guardrail overrides.
- Add VS Code settings for expression guardrail overrides and keep validation paths lightweight while honoring those limits.
- Improve dependency and expression diagnostics so `E_LIMIT` failures carry table/column or aggregate context.

## 2026-03-28 - 0.4.1
- Fix VS Code marketplace releases to include the current preview rendering behavior.
- Ensure extension packaging/publishing rebuilds before shipping via `vscode:prepublish`.
- Restore preview support for `mdxtab.preview.showComputedColumns` and `mdxtab.preview.showSummaryRows` in the shipped extension build.

## 2026-03-28 - 0.4.0
- Add `summary_rows` support for synthetic table rows in preview/output.
- Summary-row cells support left-to-right `self.<column>` references.
- Add VS Code setting `mdxtab.preview.showSummaryRows` (default: on).
- Add expenses matrix example and expanded summary-row test coverage.
- Improve diagnostics attribution for summary-row expression failures.

## 2026-03-27 - 0.3.0
- Show computed columns in the Markdown preview (Issue #12, PR #18).
- New VS Code setting `mdxtab.preview.showComputedColumns` (default: on).
- Computed columns that match an authored header fill in empty cells in-place;
  new computed columns are appended to the right of the table.
- `formatScalar()` escapes pipes and newlines to keep table structure intact.

## 2026-02-17 - 0.2.0
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
