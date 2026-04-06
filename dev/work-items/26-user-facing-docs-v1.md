# Work Item: User-facing docs for v1.0

## Status
- State: TODO
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
- [ ] Add quick-start guide with minimal end-to-end example.
- [ ] Add format overview (frontmatter, tables, computed, aggregates, summary/report tables as applicable).
- [ ] Add CLI usage page with validate/render examples.
- [ ] Add VS Code extension usage page with preview/diagnostics commands and settings highlights.

### 3. Reliability and support docs
- [ ] Add common errors/troubleshooting page with actionable fixes.
- [ ] Cross-link README and docs pages for discovery.
- [ ] Verify all command names/settings/error codes referenced are current.
- [x] Compact root `README.md` so user-facing entry points are obvious.
- [x] Archive older internal development docs using git move history.

### 4. Validation and completion
- [ ] Validate doc links and examples for consistency.
- [ ] Update this work item with completion notes.

## Acceptance criteria
- [ ] Public docs include quick start, format overview, CLI usage, VS Code usage, and troubleshooting.
- [ ] Content is concise, task-oriented, and accurate to shipped behavior.
- [ ] Users can complete a first run without reading internal specs.
