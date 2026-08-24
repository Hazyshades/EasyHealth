## Why

EH-145 closes the explainability gap in the current-state assessment: the Health Profile currently shows a score, readiness gaps, and factual markers, but it does not identify the exact observations selected for the score or explain why other observations were left out. Users therefore cannot trace a score to a source document or distinguish an assessment exclusion from an invalid laboratory result.

The existing immutable Health Profile assessment payload and source-region contract already provide the persistence and document-linking seams. This change adds a deterministic provenance projection and an expandable interface without changing the scoring formula or clinical interpretation policy.

## What Changes

- Add a versioned score-provenance contract to the Health Profile assessment payload.
- Record per-system readiness groups, selected score contributors, contribution-group identity, calculated contribution values, and source document/page/range metadata.
- Record every non-contributing observation with a stable machine exclusion reason, including incomplete resolution, non-numeric values, missing document reference ranges, specimen mismatch, non-core/supporting markers, duplicate contribution groups, unavailable score readiness, and non-scoreable systems.
- Preserve source provenance through Health Profile projection by carrying observation id, source page, source text, and validated exact source-region metadata into score evidence.
- Expand the body-system drawer with an expandable explanation panel showing the algorithm version, all readiness groups, contributors, excluded observations, reference ranges, and links back to the source document at the recorded page.
- Add a profile-level expandable list for excluded observations that are not attached to a currently rendered body-system drawer.
- Add deterministic EH-145 verification coverage for contributor selection, duplicate contribution-group exclusion, readiness evidence, source-range propagation, and machine reason codes.
- Keep score formulas, score-required groups, freshness policy, Registry definitions, aliases, and assessment bindings unchanged; no new endpoint or assessment table is introduced.

## Capabilities

### New Capabilities

- `health-profile-score-provenance`: Deterministic API and UI evidence that explains current-state score inputs, readiness, exclusions, algorithm version, and document source ranges.

### Modified Capabilities

- None. The existing Registry and incomplete-outcome contracts are consumed, not redefined.

## Impact

- **Target domain:** `health-profile`.
- **Primary code:** `src/lib/health-systems.ts`, `src/lib/health-profile-input.ts`, `src/lib/health-profile-snapshot.ts`, `src/app/api/health-profile/route.ts`, `src/app/app/profile/page.tsx`, `src/components/health-profile-drawer.tsx`, and a reusable score-provenance UI component.
- **Persistence:** the existing append-only `health_profile_assessment_versions.payload` stores the additive provenance fields; no migration is required.
- **API:** `GET /api/health-profile` gains additive `score_algorithm_version`, per-system provenance, and profile-level excluded-observation data. Existing score and readiness fields remain unchanged.
- **Verification:** add a focused `pnpm test:eh145` runner, run typecheck and relevant Health Profile/Registry checks, and create/update the required `QA/eh-145/checklist.md`.
- **Documentation gate:** because Health Profile laboratory projection and assessment explainability are affected, review/regenerate the canonical biomarker documentation and record Wiki/tracking-issue publication status per repository policy.
