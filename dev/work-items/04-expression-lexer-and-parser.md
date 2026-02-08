# Work Item: Expression lexer and parser

## Description
Build the Pratt parser for the v1 grammar and produce an expression tree.

## Sub-items
- Tokenize literals, identifiers, operators, parentheses, and function calls.
- Parse according to the v1 precedence rules (logical, comparison, sum, term, factor).
- Support references (`row.col`, `table[key].col`) and functions with args.
- Add parser tests for happy paths and syntax errors.
