## Why

A thermo-nuclear maintainability review of PR #172 (EH-142) found that laboratory exclusion gates are evaluated twice through two parallel reason taxonomies, and that the Health Profile input path re-projects the Registry binding and re-asks gates the outcome projection has already answered. Behavior is correct, but the structure preserves incidental complexity and creates drift risk between the two projection call sites.

## What Changes

- Make `AssessmentExclusionReason` the single source for the shared identity gates (`no_active_revision`, `incomplete_resolution`, `candidate_only_identity`); derive the consumer exclusions from the assessment eligibility result and delete the duplicated `baseExclusion` gate chain.
- Carry the reviewed-compatible `assessmentInputKey` on `LaboratoryOutcomeSummary` so `projectHealthProfileLaboratoryInput` stops calling `projectActiveRegistryV2LaboratoryBinding` a second time and drops its redundant definition/value re-checks.
- Type the eligibility predicate's `valueKind` input with the canonical `ValueKind` union instead of a bare `string`.
- Stop passing observation value/range inputs that the predicate provably cannot read on the preview and no-revision branches.
- No API payload, exclusion code, label, admission decision, or database change. This is a behavior-preserving consolidation of the projection layer.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `incomplete-laboratory-outcomes`: pin the payload invariant that shared identity gates report one and the same exclusion reason across consumer surfaces, and that an eligible laboratory outcome exposes its `assessmentInputKey`.
