## 1. Health Profile provenance contract

- [x] 1.1 Add the EH-145 score algorithm version, source-range fields, contributor fields, exclusion reason codes, and profile/system provenance types without changing existing score/readiness field semantics.
- [x] 1.2 Refactor contribution-group selection into a shared deterministic helper used by both `computeSystemStateScore` and provenance generation.
- [x] 1.3 Generate per-system readiness, contributor, and marker-level exclusion evidence from the exact markers used by the score calculation, including null-score and non-scoreable-system explanations.
- [x] 1.4 Expose profile-level excluded observations and the algorithm version in `HealthProfileResult` while preserving legacy score, confidence, marker, source, and assessment fields.

## 2. Snapshot and API integration

- [x] 2.1 Extend Health Profile laboratory projection inputs with observation identity and validated source page, snippet, and page-coherent source-region metadata.
- [x] 2.2 Extend the snapshot observation read with the provenance and normalization fields needed to preserve pre-projection assessment exclusions and map them to stable reason codes.
- [x] 2.3 Ensure request-time and queued assessment snapshots produce the same provenance payload and that the existing immutable assessment-version RPC persists it without a migration.
- [x] 2.4 Keep `GET /api/health-profile` backward-compatible for legacy cached payloads while returning the new provenance fields for newly generated assessments.

## 3. Explainability interface

- [x] 3.1 Build a reusable accessible expandable score-provenance component for algorithm version, readiness groups, contributors, source ranges/links, and exclusions.
- [x] 3.2 Embed the explanation component in the body-system drawer without removing factual marker details, existing readiness guidance, or source navigation.
- [x] 3.3 Add a profile-level expandable excluded-observation section for unassigned and non-rendered-system exclusions, with safe page-only source links.
- [x] 3.4 Ensure fuzzy, ambiguous, unresolved, cross-page, and invalid regions are labeled page-only and never presented as exact visual evidence.

## 4. Regression and delivery evidence

- [x] 4.1 Add `scripts/verify-eh145-score-provenance.ts` and the `pnpm test:eh145` script covering deterministic contributors, duplicate-group exclusions, readiness, source propagation, and pre-projection reason codes.
- [x] 4.2 Create `QA/eh-145/checklist.md` with synthetic-data manual checks, developer-only evidence requirements, unavailable-interface limitations, and deferred scope.
- [x] 4.3 Review and regenerate the canonical biomarker documentation, render/export the Wiki mirror, and update the single EH-145 tracking issue with verification and publication status.
- [x] 4.4 Run focused Health Profile, source-region, typecheck, OpenSpec, and required Registry documentation checks; record blockers rather than claiming unavailable evidence.
