> **Status: historical foundation — do not implement as a separate change.**
>
> This proposal established the original Registry 2.0 direction. Its implementation and hardening are continued by
> [`strict-system-score-readiness-2`](../strict-system-score-readiness-2/proposal.md), which reconciles this work,
> reuses its registry/revision design, and is the active source of truth for remaining implementation and rollout
> verification. Keep this proposal for design history and traceability; do not execute its remaining tasks as an
> independent workstream.

## Why

EasyHealth already has a code-based canonical biomarker catalog and stores useful extraction provenance, but its write paths resolve a biomarker mainly from a raw alias before considering unit, specimen, modifier, or document context. This can misclassify distinct laboratory measurements and makes a future resolver correction difficult to audit without silently changing a user's observation history or assessment inputs.

## What Changes

- Add a versioned, code-based `MeasurementDefinition` registry for concrete laboratory measurements while retaining existing canonical `biomarker_key` values for current clients, trends, and the assessment engine.
- Replace alias-only canonicalization on extraction and acceptance paths with deterministic context-aware resolution using label, unit, specimen, modifier, document section context when available, and constrained neighbor evidence.
- Return explicit resolver outcomes (`resolved`, `ambiguous`, `unmapped`) and keep verification decisions (`pending`, `user_verified`, `manually_corrected`) separate from resolver output.
- Preserve immutable raw extraction evidence and add append-only normalization revisions that record registry/resolver versions, mapping confidence, output measurement definition, and promotion state.
- Run the new resolver in feature-flagged shadow mode before any compatibility-preserving auto-promotion; ambiguous, unmapped, and inactive candidate results must not reach assessment aggregation.
- Add review/API metadata so a user can confirm a resolved mapping or manually correct a mapping without overwriting prior normalization history.
- Keep current score-required groups, document-native reference logic, and canonical catalog storage compatibility intact.

## Capabilities

### New Capabilities

- `measurement-resolution`: Versioned measurement definitions, context-aware resolution, normalization revisions, reprocessing policy, and shadow rollout.

### Modified Capabilities

- `biomarker-catalog`: Extend the static canonical catalog with measurement-definition compatibility metadata and context constraints.
- `document-processing`: Preserve resolver-ready extraction context and invoke context-aware resolution without treating an LLM-proposed key as authoritative.
- `document-extraction-review`: Expose resolution and verification state, support confirmation/manual correction, and promote accepted normalization revisions safely.
- `biomarkers-overview`: Keep incompatible or unresolved measurements out of mixed trend series while retaining factual display and provenance.
- `health-profile`: Exclude ambiguous, unmapped, and inactive candidate normalizations from system assessment inputs.
- `health-profile-api`: Return only active, assessment-compatible measurement observations in deterministic system aggregation.

## Impact

- Target domain: `documents`, with compatibility effects in `health-profile`.
- Affected code: biomarker catalog/normalization/units, document extraction and acceptance, observation write/read paths, biomarker overview, health-profile aggregation and API.
- Affected data: additive metadata on extraction and observation records plus an append-only normalization-revision audit store; the canonical registry remains code-based and is not moved into SQL.
- No new external reference ranges, diagnoses, medical recommendations, Panel Registry, LOINC adapter, or Knowledge Base work.
