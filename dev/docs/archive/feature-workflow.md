# Feature workflow

This doc explains how to propose and implement features in MDXTab. Bug reports and fixes should be tracked in GitHub Issues.

## Overview
1) Create or find a feature issue (use GitHub Issues).
2) Write a short proposal using the template.
3) Get agreement on scope and acceptance criteria.
4) Implement, test, and document.
5) Open a PR and link the issue/proposal.

## Proposal guidelines
- Keep scope small and incremental.
- Document behavior changes and diagnostics.
- Include examples and expected outputs.
- Note any compatibility or migration concerns.

## Implementation checklist
- Update core schema/evaluator as needed.
- Add or update tests for the new behavior.
- Update docs and examples.
- Validate CLI and VS Code extension behavior.
- Ensure diagnostics are clear and actionable.

## PR expectations
- Link the issue and proposal.
- Include tests or explain why they are not needed.
- Update docs and changelog entries when user-facing behavior changes.
