# MDXTab v1.0 Priority Order

Date: 2026-03-28

This file is the short operational list for v1.0 readiness work.

Use `dev/docs/backlog.md` for broader feature backlog items and proposals.

## Priority Order

1. **#24 - Add parser/evaluator input guardrails for pathological expressions** (COMPLETE)
   - Link: https://github.com/Frank-Yong/MDXTab/issues/24
   - Why first: This is the main hardening issue. It reduces denial-of-service style failures from deep or oversized expressions and protects the core engine, CLI, and VS Code extension at once.

2. **#25 - Enforce finite-number semantics in arithmetic evaluation** (COMPLETE)
   - Link: https://github.com/Frank-Yong/MDXTab/issues/25
   - Why second: This closes a spec conformance gap in core numeric behavior. It should land before 1.0 so the implementation matches the documented number rules.

3. **#26 - Harden aggregate min/max implementation for large tables** (COMPLETE)
   - Link: https://github.com/Frank-Yong/MDXTab/issues/26
   - Why third: This is another core stability fix, but it is narrower than #24 and #25. It should be completed in the same hardening pass before the release candidate is finalized.

4. **#27 - Add automated smoke tests for the VS Code extension** (COMPLETE)
   - Link: https://github.com/Frank-Yong/MDXTab/issues/27
   - Why fourth: Once the core hardening work is in place, add a lightweight test net around the extension so the release surface is protected from regressions.

5. **#28 - Publish user-facing docs for the v1.0 release**
   - Link: https://github.com/Frank-Yong/MDXTab/issues/28
   - Why fifth: This is required for a credible 1.0 release, but it should follow the core behavior fixes so the docs describe the stabilized implementation.

6. **#29 - Resolve the missing VS Code schema command**
   - Link: https://github.com/Frank-Yong/MDXTab/issues/29
   - Why sixth: This is important for product/spec alignment, but it is the least urgent of the current release tasks. It can be handled last, either by implementing the command or explicitly descoping it in the spec.

## Suggested Release Gate

Issue #24 is complete.

Issue #25 is complete.

Issue #26 is complete.

Do not cut `1.0.0` until #27 and #28 are complete.

#29 should be resolved before 1.0 if the command is still considered part of the intended VS Code surface. If the command is no longer planned, update the development spec before release.

## Suggested Work Phases

### Phase 1: Core hardening
- #26

Completed in this phase:
- #24
- #25
- #26

### Phase 2: Release confidence
- #27

### Phase 3: Release completeness
- #28
- #29