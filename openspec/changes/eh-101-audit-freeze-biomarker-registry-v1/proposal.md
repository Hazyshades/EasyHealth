# [EH-101] Audit and freeze the current biomarker registry v1

## Why

EasyHealth is introducing Registry 2.0 while the legacy biomarker catalog remains the compatibility source for 113 canonical biomarker definitions and their current alias-resolution behavior. EH-101 creates a reproducible Registry v1 baseline so later measurement-definition, alias, unit, specimen, and resolver changes can be compared against documented behavior instead of an implicit point in Git history.

## What Changes

- Generate a deterministic, machine-readable `v1.0.0` snapshot of all legacy biomarker definitions, including canonical keys, aliases, systems, score roles, coverage flags, specimen rules, tags, conversions, equivalence groups, and derived flags.
- Freeze effective legacy resolver behavior separately from source definitions, including the resolved alias map and regression cases for blocked/missing tokens, short chemistry aliases, canonical-key precedence, normalized collisions, and unknown-token fallback.
- Produce an audit report that inventories every canonical key and classifies duplicate or ambiguous aliases, specimen gaps, conversion gaps and explicit no-conversion policies, equivalence groups, and Registry 2.0 breaking-change risks.
- Produce a deterministic manifest and SHA-256 content digest with counts by body system and audit summary counts.
- Add repeatable generation and verification tooling so CI detects snapshot drift when the v1 catalog or resolver behavior changes without an intentional baseline release.
- Preserve all runtime catalog, resolver, storage, score, and health-profile behavior; findings are documented for later roadmap changes rather than corrected in EH-101.
- Prepare an annotated `registry-v1.0.0` Git tag after the baseline artifacts are committed; tag creation is an explicit release step and is not performed against an uncommitted worktree.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `biomarker-catalog`: Require a deterministic Registry v1 baseline, behavioral resolver fixtures, audit report, drift verification, and traceable release tag without changing runtime catalog behavior.

## Impact

- Target domain: `health-profile`, with documentation and verification coverage for `documents` write/read compatibility consumers.
- Affected source inputs: `src/lib/biomarkers/catalog/definitions.ts`, `src/lib/biomarkers/normalize.ts`, and their exported effective catalog/alias behavior.
- Expected artifacts: versioned JSON manifests and audit documentation under a dedicated registry-baseline directory, plus generation/verification scripts and CI integration.
- No database migration, API change, observation reprocessing, score change, Registry 2.0 definition expansion, Panel Registry, LOINC mapping, Knowledge Base content, or medical reference-range policy change.
- The baseline is retrospective: Registry 2.0 already exists in parallel, but the current Registry 2.0 implementation did not alter the legacy v1 definitions or resolver files being frozen.
