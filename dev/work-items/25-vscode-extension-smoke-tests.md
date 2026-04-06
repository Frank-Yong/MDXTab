# Work Item: VS Code extension smoke tests

## Status
- State: DONE
- Priority: HIGH
- Branch: `issue-27-vscode-extension-smoke-tests`
- Issue: https://github.com/Frank-Yong/MDXTab/issues/27

## Description
Add a focused automated smoke test layer for the VS Code extension before v1.0 so critical extension behavior is validated in CI instead of relying on manual checks.

## Background

### Problem summary
- The extension currently has meaningful functionality, but the extension package test script reports no tests.
- This leaves activation, diagnostics, preview behavior, and command paths exposed to regressions.

### Desired behavior
- A small, maintainable smoke suite covers the extension's most important runtime paths.
- The suite runs in automation and fails clearly when core extension behavior regresses.

### Key files (expected)
- `packages/vscode/package.json` - test scripts and tooling setup
- `packages/vscode/src/extension.ts` - activation and command registration
- `packages/vscode/src/**` - extension runtime services used by tests
- `packages/vscode/src/__tests__/**` or `packages/vscode/test/**` - smoke test definitions
- `.github/workflows/**` - CI wiring updates if needed

## Tasks

### 1. Test harness setup
- [x] Choose and wire a minimal extension test harness suitable for smoke tests.
- [x] Ensure tests can run headlessly in CI.

### 2. Smoke coverage
- [x] Add an activation smoke test.
- [x] Add diagnostics smoke coverage for a markdown document path.
- [x] Add preview rendering path smoke coverage.
- [x] Add at least one command-path smoke check (`mdxtab.renderPreview` or `mdxtab.validateDocument`).

### 3. CI and documentation
- [x] Hook extension smoke tests into package/workspace scripts.
- [x] Run impacted test suites and verify pass.
- [x] Update work-item notes with final validation details.

Validation notes:
- Added `packages/vscode/vitest.config.ts` for a minimal node-based smoke harness.
- Added `packages/vscode/src/__tests__/extension.smoke.spec.ts` with smoke coverage for activation, diagnostics, preview rendering, and render-preview command execution.
- Updated `packages/vscode/package.json` test script to run Vitest smoke tests.
- `npm run -w mdxtab test` passed (4 tests).

## Acceptance criteria
- [x] Extension smoke tests run automatically.
- [x] Activation, diagnostics, preview, and one command path are covered.
- [x] Failures in these paths are caught by automated tests before release.
