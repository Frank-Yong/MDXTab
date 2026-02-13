# Work Item: Expression lexer and parser

## Status
- State: DONE

## Description
Build the Pratt parser for the v1 grammar and produce an expression tree.

## Sub-items
- Tokenize literals, identifiers, operators, parentheses, and function calls.
- Parse according to the v1 precedence rules (logical, comparison, sum, term, factor).
- Support references (`row.col`, `table[key].col`) and functions with args.
- Enforce identifier charset: ASCII `[A-Za-z_][A-Za-z0-9_]*`; reserved words cannot be identifiers.
- Only allow comparison operators `==`, `!=`, `<`, `<=`, `>`, `>=`; no chained comparisons beyond binary.
- Tokenize interpolation braces as errors (only handled in Markdown phase), and reject stray `{{`/`}}` in expressions.
- Add parser tests for happy paths and syntax errors.
