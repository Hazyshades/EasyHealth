# refactor-eh141-mcv-binding

## Why

The EH-141 thermo-nuclear quality review found that the MCV Blood binding was added as a conditional spread (`...(key === "mcv" ? { binding: ... } : {})`) inside the shared CBC tuple-mapping loop in `src/lib/biomarkers/measurement-resolution.ts`, lengthening an already 1393-character line with a third special case. The loop exists to share the binding-less shape of provisional CBC indices; MCV now has a binding and no longer belongs in it. The same review found the EH-141 contract runner never pins the strongest form of the issue #41 acceptance criterion: a context-only marker must not be able to replace a missing required group while the other groups are present.

## What Changes

- Extract `mcv_whole_blood` out of the CBC tuple loop into a standalone `reviewed(...)` definition with an explicit `binding: assessment(...)`, matching the sibling pattern used by `wbc_whole_blood`, `platelets_whole_blood`, and `rdw_cv`. The generated definition is byte-identical; no runtime behavior changes.
- Remove the `key === "mcv"` conditional spread from the tuple loop so it again contains only binding-less provisional indices.
- Extend `scripts/verify-eh141-score-required-groups.ts` with a composition regression: a complete set with one required group's marker replaced by a context-only input must remain `incomplete` and unscored for every named system that declares context-only inputs.
- Replace the inline MCH unit-policy object and its `as MeasurementUnitPolicy` cast with a named `MCH_POLICY` constant, matching the named-policy convention (`VOLUME_POLICY`, `CELL_POLICY`, `PROTEIN_POLICY`, `PERCENT_POLICY`).
- No manifest version bump, no catalog output change, no API or database change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None — this is a behavior-preserving structural refactor plus a contract-test strengthening. The `score-required-groups` capability requirements from `eh-141-finalize-score-required-groups` are unchanged; the delta below records the enforcement requirement for the context-only composition case under the existing `context-aware-measurement-resolution` domain rules.

### Affected specs

- `openspec/specs/context-aware-measurement-resolution/spec.md` (domain: measurement resolution) — no requirement text changes; the delta spec documents the new contract coverage only if the schema requires one. Reference domain: `health-profile` (Health Profile score readiness) and `context-aware-measurement-resolution` (Registry binding structure).
