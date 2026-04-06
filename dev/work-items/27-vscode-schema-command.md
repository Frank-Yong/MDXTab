# Work Item: Resolve missing VS Code schema command

## Status
- State: TODO
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
- [ ] Add or update tests covering chosen path.
- [ ] Update user docs where command availability/usage is described.
- [ ] Confirm no stale references remain.

Task 3 notes:
- Pending.

### 4. Validation and completion
- [ ] Run build/test validation for affected packages.
- [ ] Verify extension command surface matches docs/spec outcomes.
- [ ] Update this work item with completion notes.

Task 4 notes:
- Pending.

## Acceptance criteria
- [ ] No unresolved mismatch remains between intended v1.0 VS Code command surface and docs/spec references.
- [ ] Chosen path (implement or descope) is fully reflected in code, docs, and tests.
- [ ] Validation commands pass for impacted areas.
