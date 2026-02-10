# Work Item: Dependency graph and cycle detection

## Description
Figure out a safe order to compute computed columns and aggregates; fail on loops.

## Sub-items
- Build a graph from references in computed columns and aggregates.
- Detect cycles and emit clear errors (aggregate context vs row context).
- Produce a stable evaluation order for row formulas and aggregates.
- Enforce aggregate-arg restriction: only column identifiers allowed in aggregates.
- Tests: simple chains, branching, cycle detection, and aggregate-arg violations.
