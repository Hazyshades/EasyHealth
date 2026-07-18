## Why

Circle, Arc, x402, Gateway, and hackathon material remains in repository-local skills, lock metadata, and active documentation after the product direction changed. It misrepresents the maintained product and exposes stale operational material; the cleanup must preserve application code, dependency declarations, environment files, and archived OpenSpec history.

## What Changes

- Remove repository-installed Circle payment, wallet, bridge, and USDC agent skills.
- Remove their entries from `skills-lock.json`.
- Remove active Circle, Arc, x402, Gateway, and hackathon documentation and legacy scratch material.
- Keep all `openspec/changes/archive/**` content unchanged.
- Keep `src/**`, package manifests and lockfiles, migrations, and `.env*` files unchanged.

## Capabilities

### New Capabilities

- `repository-metadata-cleanup`: Removal policy for obsolete repository-local skills, lock metadata, documentation, and planning artifacts without changing runtime behavior.

### Modified Capabilities

- None.

## Impact

- Affected non-runtime paths: `.agents/skills/`, `skills-lock.json`, `docs/`, and active OpenSpec metadata.
- Preserved runtime paths: `src/`, package manifests and lockfiles, migrations, and `.env*` files.
- Archived OpenSpec artifacts are explicitly out of scope.