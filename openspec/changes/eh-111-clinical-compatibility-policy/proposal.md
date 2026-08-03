## Why

EH-109 and EH-110 now provide deterministic candidate evidence and authoritative alias admission, but the resolver still treats missing units and value kinds inconsistently, ignores `allowedSpecimens`, and can expose conversion metadata without consumer-level proof of a concrete reviewed binding. EH-111 is required now to make the documents-domain compatibility boundary clinically safe before incomplete resolver states are consumed by EH-112 and later scenario packs.

## What Changes

- Make unit a first-class compatibility axis: enforce each definition's `missingUnitPolicy`, reject incompatible families and unsupported unit tokens, and preserve missing-unit evidence without guessing.
- Define value-kind compatibility for numeric, qualitative, and ordinal extraction representations, including missing-value-kind behavior and qualitative results that legitimately have no unit.
- Consolidate `specimen` and `allowedSpecimens` into one authoritative specimen policy and emit structured accepted, missing, and hard-conflict evidence.
- Tighten concrete-resolution eligibility so every definition-required compatibility axis must be complete and compatible before a candidate can become active identity.
- Restrict measurement conversion to an active `resolved` normalization revision bound to a reviewed definition; candidate keys in partial or ambiguous decision evidence remain ineligible.
- Add deterministic unit, specimen, value-kind, outcome, read-boundary, and conversion-denial regression coverage for the EH-111 matrix.
- Bump resolver policy/version metadata for newly produced decisions while leaving historical append-only revisions unchanged.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `context-aware-measurement-resolution`: Define clinical unit, value-kind, and specimen compatibility; missing-axis semantics; concrete-resolution eligibility; and conversion gating for resolved reviewed bindings.

## Impact

- **Domain:** documents.
- **Runtime:** Registry 2.0 measurement definitions and validators, extraction-to-resolver inputs, candidate evaluation and decision traces, normalization revision/read boundaries, and conversion consumers.
- **Contracts:** `missingAxes`, per-axis evidence codes, candidate eligibility, incomplete-state serialization, active resolved identity, resolver/catalog version metadata, and conversion lookup behavior.
- **Verification:** pure policy matrices, launch-corpus regression fixtures, persistence/read-boundary checks, and negative conversion tests for partial, ambiguous, provisional, conflicted, and evidence-only candidates.
- **Dependencies:** Builds on the archived EH-109 resolver evidence engine and EH-110 alias authority lifecycle. EH-112 consumes the resulting contract but is not implemented by this change.
