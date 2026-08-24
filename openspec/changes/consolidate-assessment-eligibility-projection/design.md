## Context

PR #172 (EH-142) introduced `evaluateAssessmentEligibility` as the single admission predicate for Health Profile assessment inputs, but kept the pre-existing consumer exclusion chain (`baseExclusion` in `src/lib/documents/incomplete-laboratory-outcomes.ts`) alongside it. Today one row's outcome is produced by evaluating the same three identity gates twice — once for `AssessmentExclusionReason` and once for `LaboratoryConsumerExclusionReason` — and `projectHealthProfileLaboratoryInput` (`src/lib/health-profile-input.ts`) re-projects the Registry binding a second time and re-checks gates the outcome summary already answered. The review also flagged a loose `valueKind: string` predicate input and dead observation inputs on the preview/no-revision branches.

## Goals / Non-Goals

**Goals:**

- One evaluation of the shared identity gates per row, one exclusion-reason taxonomy as its source.
- `projectHealthProfileLaboratoryInput` consumes exactly one projection and no longer re-derives binding data.
- Predicate boundary typed with the canonical `ValueKind` union.
- Identical public payload, exclusion codes, labels, admission decisions, and database state.

**Non-Goals:**

- No changes to exclusion codes, user-facing labels, API response shapes, or admission semantics.
- No edits to shipped migrations (migration `074` stays as merged; its duplicated CTE is accepted).
- No Biomarkers table refactor beyond what consolidation requires.

## Decisions

- **D1 — Derive consumer exclusions from the assessment eligibility result.** `buildEligibility` takes the computed `AssessmentEligibility` and derives `trend`/`report`/`structuredContext` exclusions from its `exclusionReason` while the reason is one of the three shared identity codes; only `conversion_unavailable` remains a consumer-local reason. `baseExclusion` and its duplicate gate chain are deleted. Alternative considered: merging both unions into one type — rejected, because `conversion_unavailable` is genuinely consumer-specific and merging would widen the assessment taxonomy.

- **D2 — Expose an admission-gated `assessmentInputKey` plus `resolvedMeasurementBinding` on `LaboratoryOutcomeSummary`.** The projection already locates the reviewed compatible binding to compute `hasReviewedAssessmentBinding`; it stores that binding's `assessmentInputKey` on the summary, nulled unless the row passes every assessment gate — key presence alone encodes the whole admission decision — plus the already-computed `resolvedMeasurementBinding` (the unit-conversion display binding). `projectHealthProfileLaboratoryInput` becomes: project once → guard `assessmentInputKey` → narrow the DB value to a finite `number` → `presentObservation`. The second `projectActiveRegistryV2LaboratoryBinding` call and the redundant `measurementDefinitionKey`/`definition` re-derivation are deleted; the finite-value guard stays because `presentObservation` takes a bare `number` — it is runtime-redundant after the gate but type-required at the DB boundary, and it keeps the path fail-closed. Alternative considered: exporting the full Registry binding projection from the summary — rejected; only the two fields the display and admission guard need cross the boundary.

- **D3 — Type the predicate's `valueKind` with `ValueKind`.** The predicate input becomes `valueKind: ValueKind | null | undefined` using the canonical union from `@/lib/biomarkers`; the projection layer parses the raw `string | null` column once (unknown values map to `null`, which the predicate already treats as non-numeric). Semantics are unchanged: only `"numeric"` passes.

- **D4 — Dedicated ineligible factory for preview/no-revision branches.** A small `ineligibleAssessmentEligibility()` helper returns `{ eligible: false, exclusionReason: "no_active_revision" }` so the preview and no-revision branches stop threading observation value/range fields the predicate cannot read after its first gate fails.

## Risks / Trade-offs

- D1 changes the declared type of `exclusions.trend`/`report`/`structuredContext` from `LaboratoryConsumerExclusionReason | null` to the narrowed shared subset; downstream consumers that switch on `conversion_unavailable` for those surfaces would break at compile time — none exist today (trend/report/structured never carry `conversion_unavailable`), and `tsc --noEmit` proves it.
- D2 moves one field onto a summary type consumed by API, snapshot, and Health Profile paths; the payload gains no new field (the key is consumed internally), so no cache or client contract changes.
- Regression safety net: `test:eh142` (gate-by-gate reasons), `test:eh112` (four-outcome corpus), `test:eh123`, `test:health-profile-lab-input`, `test:biomarkers`, plus new consistency assertions added to `verify-eh142-assessment-eligibility.ts`.
