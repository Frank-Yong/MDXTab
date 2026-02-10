# Work Item: CLI v1

## Description
Ship a minimal CLI for validate/render with CI-friendly output.

## Sub-items
- Commands: `mdxtab validate <file>` and `mdxtab render <file>`.
- Exit codes: 0 on success, non-zero on errors; print JSON diagnostics on request.
- Wire to core library; add basic help text.
- Tests: CLI fixtures for success and failure cases.
