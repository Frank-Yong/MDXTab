# Work Item: Diagnostics surface

## Description
Produce clear, structured errors and warnings that can be shared by CLI and VS Code.

## Sub-items
- Standard fields: code, message, severity, file, table, column/aggregate, text range.
- Map parser/validator/evaluator errors into this shape.
- Tests: snapshots of diagnostics for common failures (missing column, bad type, cycle, bad lookup).
