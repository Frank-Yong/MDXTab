# Work Item: VS Code extension smoke tests

## Status
- State: TODO
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
- [ ] Choose and wire a minimal extension test harness suitable for smoke tests.
- [ ] Ensure tests can run headlessly in CI.

### 2. Smoke coverage
- [ ] Add an activation smoke test.
- [ ] Add diagnostics smoke coverage for a markdown document path.
- [ ] Add preview rendering path smoke coverage.
- [ ] Add at least one command-path smoke check (`mdxtab.renderPreview` or `mdxtab.validateDocument`).

### 3. CI and documentation
- [ ] Hook extension smoke tests into package/workspace scripts.
- [ ] Run impacted test suites and verify pass.
- [ ] Update work-item notes with final validation details.

## Acceptance criteria
- [ ] Extension smoke tests run automatically.
- [ ] Activation, diagnostics, preview, and one command path are covered.
- [ ] Failures in these paths are caught by automated tests before release.
