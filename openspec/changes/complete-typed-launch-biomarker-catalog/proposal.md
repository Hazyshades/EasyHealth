## Why

The launch corpus recognises every required sample row, but twelve real non-glucose rows still resolve only through display-only sample-fixture placeholders with no typed unit policy. The candidate-release gate correctly rejects that catalog because it cannot prove the observed units are compatible. EasyHealth is pre-launch, so the catalog can be completed cleanly now without preserving legacy runtime behavior.

## What Changes

- Replace generic `sample_*` display-only definitions for the required launch-corpus rows with typed Registry 2.0 definitions carrying explicit analyte, measurement identity axes, aliases, value kind, accepted units, and source provenance.
- Reuse compatible existing reviewed definitions for total bilirubin, ALT, AST, and CRP; remove shadow sample-fixture candidates that currently introduce unit conflicts.
- Add typed provisional definitions for total protein, direct bilirubin, ASO, ESR, Giardia antibodies, Ascaris/Toxocara/Opisthorchis/Echinococcus/Trichinella IgG tests, total IgE, and eosinophilic cationic protein.
- Preserve safe non-concrete behavior: missing specimen, method, or other required evidence remains `partial` or `ambiguous`; no new definition gains assessment or score eligibility without a reviewed binding.
- Extend candidate-corpus and registry regressions to prove all launch rows have accepted or intentionally unitless evidence, expected classifications, zero false concrete resolutions, and no processing errors.
- Regenerate candidate-release evidence after catalog changes. Existing hash-bound approvals remain invalid until the responsible reviewers approve the resulting candidate input.

## Capabilities

### New Capabilities
- `typed-launch-biomarker-catalog`: Typed, provenance-backed Registry 2.0 definitions for every required launch-corpus biomarker, including safe provisional display/review definitions.

### Modified Capabilities
- `biomarker-catalog`: Replace generic sample-fixture unit handling with typed launch-catalog definitions and explicit unit compatibility.
- `registry-release-corpus-governance`: Require the candidate corpus to validate unit evidence without allowing display-only sample placeholders to create false release failures.

## Impact

- **Target domains:** `documents` and `health-profile`.
- **Registry and resolver:** `src/lib/biomarkers/measurement-resolution.ts`, `src/lib/biomarkers/types.ts`, release-manifest helpers, and registry regression runners.
- **Release evidence:** `registry/candidate-release/v1/corpus.json`, policy, approvals, report assertions, and deterministic candidate-corpus tooling.
- **Consumer safety:** no new assessment bindings, scoring inputs, legacy fallback, or automatic concrete resolution from incomplete source context.
- **Governance:** the new catalog manifest changes the candidate input hash, requiring a new Registry Safety review, any required Assessment Owner reviews, and Release Manager approval before the release gate is launchable.