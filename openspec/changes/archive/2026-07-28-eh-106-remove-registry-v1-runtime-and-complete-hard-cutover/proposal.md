## Why

EH-105 establishes Registry 2.0 identity and source lineage, but the remaining
runtime consumers and acceptance/correction writers can still reach Registry v1
semantics. Before launch, that split can produce divergent mappings, incorrectly
verify incomplete observations, and make a feature flag capable of restoring an
unsupported legacy path.

EH-106 completes the pre-launch hard cutover and adds an auditable, non-mutating
release gate for Registry 2.0 so that a candidate can be approved without
changing patient observations or assessment state.

## What Changes

- **BREAKING** Make Registry 2.0 the only runtime source of laboratory semantic
  identity; remove Registry v1 adapters, compatibility-only behavior, fallback
  paths, feature flags, and dual-read telemetry. Retain the frozen v1 snapshot
  only for migration and audit tooling.
- Move extraction, acceptance, and correction writers—including existing
  `ids[]` paths—to EH-104's per-row atomic v2 promotion primitive. Map a
  reviewed, resolved, user-accepted result to `user_verified`; preserve raw
  acceptance of `partial`, `ambiguous`, or `unmapped` as `pending`.
- Migrate trends, reports, structured context, biomarker APIs/UI, unit
  conversion, and health assessment to reviewed Registry 2.0 bindings and
  preserve EH-104 ownership, lock ordering, ownership checks, CAS, and
  projection synchronization in every writer.
- Add a non-mutating candidate-release corpus runner, complete launch fixtures,
  reproducible segmented reporting, numerical thresholds, named approvals, and
  CI gates for manifest, coverage, false-resolution, and score-affecting
  binding review.
- Add static and regression verification that prevents runtime imports of the
  frozen Registry v1 fixture and proves Registry 2.0 cutover behavior.

## Capabilities

### New Capabilities

- `registry-v2-runtime-cutover`: Registry 2.0-only runtime resolution and
  consumer behavior across extraction, APIs, UI, trends, reports, conversion,
  and assessment.
- `registry-v2-acceptance-correction`: Atomic Registry 2.0 acceptance and
  correction semantics built on the EH-104 v2 promotion primitive.
- `registry-release-corpus-governance`: Non-mutating launch-corpus execution,
  reporting, approvals, manifest evidence, and CI release gates.

### Modified Capabilities

- None. This repository has no primary `openspec/specs/` capability baseline;
  EH-106 records its required contracts as new change-local specifications.

## Impact

- Affected domains: documents and health-profile, with reporting consumers.
- Affected code: Registry/biomarker libraries, document worker and acceptance
  routes, observation read boundaries, Health Profile and biomarker UI/API,
  assessment and unit conversion logic.
- Affected data and operations: EH-104 promotion RPC integration, Registry v1
  fixture/tooling boundaries, launch fixtures, verification scripts, CI, and
  QA evidence.
