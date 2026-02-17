# Versioning policy

## Goal
Keep all packages in this repo on the same version so releases are predictable.

## What to update for a release
1) Version number in:
   - package.json (repo root)
   - packages/core/package.json
   - packages/cli/package.json
   - packages/vscode/package.json
2) Internal dependencies to match the same version:
   - @mdxtab/core in packages/cli and packages/vscode

## When to bump
- Patch (0.1.x -> 0.1.y): bug fixes only.
- Minor (0.x -> 0.y): new features or behavior changes.
- Major (1.0 -> 2.0): breaking changes.

## Tag and release
After versions are updated and merged to main:
1) Create a Git tag like v0.1.1.
2) Create a GitHub Release with the same tag.
3) The Marketplace publish workflow runs on that release.
