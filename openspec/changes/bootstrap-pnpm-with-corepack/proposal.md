## Why

The repository pins pnpm but does not bootstrap it for a fresh development environment. A missing global pnpm therefore blocks verification before the project can explain the supported recovery path.

## What Changes

- Enable Corepack during package lifecycle setup and CI initialization before pnpm commands run.
- Document the exact Corepack activation and package-manager fallback commands in an operations guide.
- Add a verification command that checks the declared package-manager version and Corepack-mediated pnpm availability.

## Capabilities

### New Capabilities
- `package-manager-bootstrap`: Repeatable package-manager activation for local contributors and CI.

### Modified Capabilities
- None.

## Impact

- Root package lifecycle scripts, CI workflow, operations documentation, and a small verification script.
- No application runtime, database, or clinical behavior changes.