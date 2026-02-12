# Changelog

All notable changes to MDXTab will be documented in this file.

## 2026-02-10 - Phase 0 complete
- Locked v1 semantics across the formal, technical, and development specs (numeric/null rules, rounding algorithm, identifier and reserved word constraints, interpolation escape/AST handling, header trimming for column names).
- Clarified diagnostics fields (code/message/severity) and aggregate argument/context error codes.
- Documented header trimming vs data cell preservation and aggregate argument restrictions to avoid parsing drift.
- Merged Phase 0 spec work (PR #1) into main; Phase 1 can begin.

## Unreleased
- Phase 1: core engine implementation planned on branch phase-1-core-engine per the development plan.
