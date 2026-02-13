# Phase 2: VS Code Extension

## Goal
Ship a usable MDXTab authoring experience in VS Code with diagnostics, preview, and editor features.

## Current status
- Diagnostics loop: DONE (core diagnostics + VS Code integration)
- Preview: DONE (render command + refresh gating + inline errors)
- CLI JSON diagnostics: DONE

## Remaining work
1) Document symbols / outline
- Tables, columns, computed columns, aggregates
- Surface in Outline view

2) Hovers
- Column type and definition
- Computed/aggregate expression snippets

3) Completions + navigation
- Suggest tables, columns, aggregates, functions
- Go-to / Peek for column references and lookups

4) Incremental parsing + performance
- Cache parse results per document
- Recompute only changed tables on save

5) Diagnostics UX polish
- Prioritize multiple diagnostics
- Improve range targeting for expression-level errors

## Notes
- Keep the extension thin and rely on core for validation and evaluation.
- Prefer deterministic diagnostics for reliable editor behavior.
