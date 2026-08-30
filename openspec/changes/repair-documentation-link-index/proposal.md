## Why

The documentation index mixes current operations/data pages with references to absent product, requirement, and architecture files. Broken quick links make the repository documentation misleading.

## What Changes

- Prune links whose targets are absent from the tracked repository.
- Retain and organize links to current tracked operations and data documentation.
- Add an automated link-target verifier for the index.

## Capabilities

### New Capabilities
- `documentation-link-integrity`: Repository documentation index links resolve to tracked targets.

### Modified Capabilities
- None.

## Impact

- `docs/README.md` and a documentation verifier; no runtime behavior change.