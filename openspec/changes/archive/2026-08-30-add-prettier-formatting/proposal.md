## Why

Formatting currently depends on downloading an ad-hoc tool, making focused changes non-reproducible. The repository needs a pinned formatter and explicit write/check commands.

## What Changes

- Pin Prettier as a root development dependency.
- Add `format` and non-mutating `format:check` commands.
- Ignore generated output, dependencies, and committed generated registry documentation.

## Capabilities

### New Capabilities
- `repository-formatting`: Deterministic repository formatting commands.

### Modified Capabilities
- None.

## Impact

- Tooling configuration only; no runtime behavior changes.