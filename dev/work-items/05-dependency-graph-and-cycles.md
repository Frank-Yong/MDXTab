# Work Item: Dependency graph and cycle detection

## Description
Figure out a safe order to compute computed columns and aggregates; fail on loops.

## Sub-items
- Build a graph from references in computed columns and aggregates.
- Detect cycles and emit clear errors.
- Produce a stable evaluation order for row formulas and aggregates.
- Tests: simple chains, branching, and cycle detection cases.
