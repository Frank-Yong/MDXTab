# Work Item: Resolve missing VS Code schema command

## Status
- State: DONE
- Priority: HIGH
- Branch: issue-29-vscode-schema-command
- Issue: https://github.com/Frank-Yong/MDXTab/issues/29

## Description
Resolve the missing VS Code schema command so shipped extension behavior matches documented/spec expectations before v1.0.

## Background

### Problem summary
- A VS Code schema-related command is expected in product/spec context but is currently missing in the extension command surface.
- This creates a product/spec mismatch and potential user confusion near v1.0.

### Desired outcome
- Confirm intended command behavior and user flow.
- Either implement the command end-to-end or explicitly descope and align all docs/spec references.
- Keep extension command surface and docs internally consistent.

## Tasks

### 1. Discovery and decision
- [x] Locate all references to the missing schema command in specs, docs, and extension manifest/code.
- [x] Confirm intended behavior and scope for v1.0.
- [x] Choose one path: implement now, or descope with explicit documentation/spec updates.

Task 1 notes:
- References found in `specs/development-spec.md` and `specs/technical-design.md` explicitly include a command to show the current file schema.
- `packages/vscode/package.json` currently contributes only `mdxtab.renderPreview` and `mdxtab.validateDocument`.
- `packages/vscode/src/extension.ts` currently registers only render-preview and validate-document commands; no schema command registration exists.
- Issue #29 confirms acceptance can be either implement or explicit descope. For v1.0, decision is to implement the schema command to preserve product/spec alignment.

### 2. Implementation or descope execution
- [x] If implementing: add command contribution, handler, and user-visible behavior.
- [ ] If descoping: remove/adjust references in specs/docs to reflect actual v1.0 surface.
- [x] Ensure command IDs/messages are consistent across manifest and code.

Task 2 notes:
- Added command contribution in `packages/vscode/package.json`:
	- `mdxtab.showTableSchema` / `MDXTab: Show Table Schema`
- Registered `mdxtab.showTableSchema` in `packages/vscode/src/extension.ts` with user-visible behavior:
	- reads active MDXTab frontmatter schema
	- opens a preview markdown document containing JSON schema for `tables`
	- shows clear messages for missing active editor, non-MDXTab files, empty schema, and parse failures
- Kept descope path unchecked because implementation path is selected for v1.0.

### 3. Tests and docs alignment
- [x] Add or update tests covering chosen path.
- [x] Update user docs where command availability/usage is described.
- [x] Confirm no stale references remain.

Task 3 notes:
- Extended `packages/vscode/src/__tests__/extension.smoke.spec.ts` with schema-command behavior checks:
	- opens a schema document for a valid MDXTab file
	- warns for non-MDXTab files
- Updated user docs command surface in `docs/vscode-extension.md` to include `MDXTab: Show Table Schema` and usage in the typical flow.
- Updated `packages/vscode/README.md` command list to include validate + schema commands so extension docs stay aligned.
- Verified active docs/spec references now align with the implemented command set (`renderPreview`, `validateDocument`, `showTableSchema`).

### 4. Validation and completion
- [x] Run build/test validation for affected packages.
- [x] Verify extension command surface matches docs/spec outcomes.
- [x] Update this work item with completion notes.

Task 4 notes:
- Ran final validation in the VS Code workspace:
	- `npm run -w mdxtab test` passed (`6/6` tests).
	- `npm run -w mdxtab build` passed.
- Verified command surface alignment across implementation and docs/spec:
	- `packages/vscode/package.json` contributes `mdxtab.renderPreview`, `mdxtab.validateDocument`, and `mdxtab.showTableSchema`.
	- `docs/vscode-extension.md` documents all three core commands.
	- `specs/technical-design.md` command list includes `MDXTab: Show Table Schema`.
- Work item closed as DONE for issue #29 implementation path.

## Acceptance criteria
- [x] No unresolved mismatch remains between intended v1.0 VS Code command surface and docs/spec references.
- [x] Chosen path (implement or descope) is fully reflected in code, docs, and tests.
- [x] Validation commands pass for impacted areas.
