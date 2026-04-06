# Work Item: User-facing docs for v1.0

## Status
- State: DONE
- Priority: HIGH
- Branch: `issue-28-user-facing-docs`
- Issue: https://github.com/Frank-Yong/MDXTab/issues/28

## Description
Publish an initial set of concise, task-oriented user-facing documentation in `docs/` for v1.0 covering installation, usage, examples, and troubleshooting.

## Background

### Problem summary
- Internal specs/docs are mature, but public `docs/` content is currently minimal for external users.
- v1.0 readiness requires user-oriented guidance, not only design/spec documents.

### Desired outcome
- A clear docs landing structure in `docs/`.
- Practical guidance for first-time users of core, CLI, and VS Code extension flows.
- Error/troubleshooting guidance that maps to user-observable behavior.

### Scope areas (from issue)
- quick start
- MDXTab format overview
- core concepts and examples
- CLI usage
- VS Code extension usage
- common errors and troubleshooting

## Tasks

### 1. Structure and navigation
- [x] Define docs index/landing page and top-level navigation.
- [x] Align page names and links with current repo capabilities.

Task 1 notes:
- Added a GitHub Pages-ready docs landing page at `docs/index.md` with direct links and reading order.
- Added focused top-level pages for quick start, format overview, CLI usage, VS Code usage, and troubleshooting.

### 2. Core user docs
- [x] Add quick-start guide with minimal end-to-end example.
- [x] Add format overview (frontmatter, tables, computed, aggregates, summary/report tables as applicable).
- [x] Add CLI usage page with validate/render examples.
- [x] Add VS Code extension usage page with preview/diagnostics commands and settings highlights.

Task 2 notes:
- Expanded `docs/quick-start.md` with prerequisites, build step, minimal sample document, and end-to-end validate/render/preview flow.
- Expanded `docs/format-overview.md` with a practical mental model, key concepts, and example links.
- Expanded `docs/cli-usage.md` with command shape, JSON diagnostics usage, guardrail flag overrides, and CI usage.
- Expanded `docs/vscode-extension.md` with install paths, command workflow, settings guidance, and diagnostics behavior.

### 3. Reliability and support docs
- [x] Add common errors/troubleshooting page with actionable fixes.
- [x] Cross-link README and docs pages for discovery.
- [x] Verify all command names/settings/error codes referenced are current.
- [x] Compact root `README.md` so user-facing entry points are obvious.
- [x] Archive older internal development docs using git move history.

Task 3 notes (partial):
- Expanded `docs/troubleshooting.md` into symptom-first guidance with actionable fixes by diagnostic code (`E_LIMIT`, `E_NUMBER`, `E_REF`, `E_LOOKUP`, `E_TYPE`, `E_AGG_ARGUMENT`, `E_AGG_REF`, `E_CYCLE`, table/key structural codes).

Task 3 notes (complete):
- Verified root README links to user docs and docs pages cross-link through `index.md`, `Next`, and `Related` sections.
- Verified command IDs and settings names against `packages/vscode/package.json` (`mdxtab.renderPreview`, `mdxtab.validateDocument`, `mdxtab.preview.*`, `mdxtab.limits.*`).
- Verified troubleshooting error-code references against current core diagnostics (`E_LIMIT`, `E_NUMBER`, `E_REF`, `E_LOOKUP`, `E_TYPE`, `E_AGG_ARGUMENT`, `E_AGG_REF`, `E_CYCLE`, `E_TABLE_TAB`, `E_TABLE_COLUMN_COUNT`, `E_KEY`, `E_KEY_DUP`).

### 4. Validation and completion
- [x] Validate doc links and examples for consistency.
- [x] Update this work item with completion notes.

Task 4 notes:
- Ran a local markdown link integrity sweep across `docs/**/*.md` and `README.md`; no broken local links found.
- Verified referenced example files exist: `dev/examples/expenses.md`, `dev/examples/time-entries.md`, `dev/examples/grouped-aggregates.md`, `dev/examples/transactions.md`.
- Confirmed issue scope now includes concise user docs plus reduced-root-noise structure (compact README and archived internal planning docs via git move).

## Acceptance criteria
- [x] Public docs include quick start, format overview, CLI usage, VS Code usage, and troubleshooting.
- [x] Content is concise, task-oriented, and accurate to shipped behavior.
- [x] Users can complete a first run without reading internal specs.
