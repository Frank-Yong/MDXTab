# Changelog

All notable changes to MDXTab will be documented in this file.

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
