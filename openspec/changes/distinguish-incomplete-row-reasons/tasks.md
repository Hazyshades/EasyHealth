# Tasks: attributable incompleteness (#114, closes #63)

## 1. Prerequisite: settle the spec baseline

- [x] 1.1 Archive the merged EH-117 change
      (`openspec/changes/eh-117-build-split-view-launch-observation-review-workspace`,
      27/27, merged in #112) so `openspec/specs/observation-review-workspace/` exists and
      its MODIFIED deltas on `incomplete-laboratory-outcomes` and
      `document-extraction-review` land in the baseline.
- [x] 1.2 Archive the merged EH-118 change
      (`openspec/changes/eh-118-link-observations-to-source-page-and-region`, 32/32, merged
      in #113).
- [x] 1.3 Re-read the three requirements this change modifies that EH-117 also touched, and
      confirm the deltas here still match the archived text word for word. If EH-117's
      wording changed them, rebase these deltas rather than overwrite. Re-run
      `openspec validate distinguish-incomplete-row-reasons --strict`.

## 2. Failing evidence first

- [x] 2.1 Add `scripts/verify-incomplete-reason-class.ts` and wire `test:reason-class`.
      Assert, before any implementation, that a single-candidate provisional row is
      distinguishable from an axis-blocked row. It MUST fail on current `main`.
- [x] 2.2 In that harness, build the two fixtures from the real shapes: one provisional-only
      row (single candidate, zero conflicts, zero missing axes) and one reviewed row missing
      only `specimen`. Assert both currently produce identical evidence — this is the
      regression being fixed, and the assertion documents it.
- [x] 2.3 Add a fixture for a row that is both provisional and missing an axis, asserting the
      precedence rule from `incomplete-outcome-reason-class`.
- [x] 2.4 Add a fixture for a retired definition, asserting it yields `no_candidate` and
      never `definition_not_reviewed`. Design flags this as unverified; if it fails, the
      taxonomy needs a fourth member and the spec must change before the code does.

## 3. Attribute admissibility in the resolver

- [x] 3.1 Add an admissibility-rejection reason to the resolver's evidence vocabulary in
      `src/lib/biomarkers/types.ts`, covering the six conjuncts at
      `measurement-resolution.ts:860-870`: maturity, source provenance, alias match
      authority, alias approval state, missing axis, score floor.
- [x] 3.2 Replace the boolean `admissible` filter with one that evaluates the same
      conditions and records which failed, per candidate. Selection, ranking, confidence and
      outcome MUST be unchanged.
- [x] 3.3 Add the new codes to the `TRACE_REASON_CODES` allowlist
      (`measurement-resolution.ts:932-970`); an unlisted code is silently dropped from the
      trace.
      NOT NEEDED as written. The codes became their own union
      `AdmissibilityRejectionCode` rather than members of `ResolutionReasonCode`,
      so `TRACE_REASON_CODES` is untouched. Reusing the evidence union would have
      pushed maturity into `rejected`, and therefore into `conflicts` and the
      metric, breaking the invariant that a conflict means the document and the
      definition disagree. A provisional definition is not a conflict.
- [x] 3.4 Keep `CandidateEvidence.eligible` as-is for existing consumers, but stop treating
      it as the only exclusion record.
- [x] 3.5 Prove selection is untouched: `MEASUREMENT_RESOLVER_VERSION` unchanged, and
      `pnpm check:registry-v2-candidate-corpus` still reports `launchable: true` with
      candidate input hash `f00c0e6f4b0c…`. If the hash moves, stop — the change has altered
      behaviour it promised not to, and `registry-v2.0.0-candidate.2` would be invalidated.

## 4. Derive and project the reason class

- [x] 4.1 Add the reason-class type and a pure derivation function from recorded evidence,
      implementing the precedence order `unit_or_value_conflict` → `axis_not_stated` →
      `definition_not_reviewed` → `no_candidate`. No catalog reads in the derivation.
- [x] 4.2 Export it through `src/lib/biomarkers/index.ts`; the documents layer cannot see
      resolver types that are not re-exported there.
- [x] 4.3 Add the class to `LaboratoryResolutionDetails` and populate it in
      `projectLaboratoryOutcome` for all three exits — active revision, preview, and none.
      The preview exit is the one issue #114 is actually about.
- [x] 4.4 Widen `DecisionTraceLike` in `incomplete-laboratory-outcomes.ts` only as far as the
      derivation needs. It must not become a second copy of the trace type.
- [x] 4.5 Surface the class on `NormalizationReview` so a row without an active revision
      carries it.
- [x] 4.6 Resolve the dead `"unreviewed_definition"` member of
      `LaboratoryConsumerExclusionReason`: either produce it now that the signal exists, or
      delete it. Do not leave it declared and unreachable.
      DELETED. The reason class now carries that specificity; producing it here
      as well would create a second taxonomy on the eligibility axis that drifts
      from the first. `incomplete_resolution` stays accurate for eligibility.

## 5. Copy

- [x] 5.1 Widen `measurementMappingGuidance` to take the reason class and the missing axes.
      The arity change breaks four call sites at compile time; that is intended and is the
      only CI-visible signal, since none of the three suites asserting this copy run in CI.
- [x] 5.2 Write guidance per class. `definition_not_reviewed` states that the measurement is
      recognized and awaiting catalog review, confirms the raw result is preserved, and asks
      for nothing.
- [x] 5.3 Write `axis_not_stated` guidance that names each missing axis in clinical English
      — "The specimen is not stated in this report" — at row level. This is issue #63's
      remaining criterion.
- [x] 5.4 Extend `REASON_LABELS`: add the six clinical axis names and the
      `modifier_*`/`timing_*`/`method_*` codes, and delete the dead `unit_conflict` key,
      which is not a member of `ResolutionReasonCode`. No reviewer should see
      `value_kind` as a bare token.
- [x] 5.5 Render the row-level guidance in `observation-review-row.tsx` without requiring
      technical details to be expanded, keeping the existing raw-acceptance affordance.
- [x] 5.6 Show the reason class in `review-technical-details.tsx` alongside the existing
      reason lines.

## 6. Counters

- [x] 6.1 Split `summarizeReviewRows` into awaiting-document, awaiting-catalog and
      conflicted, keeping `total` and `resolved` unchanged and their sum equal to the former
      `incomplete`.
- [x] 6.2 Render the split in the workspace header.
- [x] 6.3 Decide `hasIncompleteOutcomes` for catalog-blocked rows and implement the decision.
      Design leaves this open deliberately: excluding them is more honest because
      reprocessing against the same release cannot help, but it removes an affordance. Record
      the reason for the choice in `design.md`.

## 7. Metric

- [x] 7.1 Add the reason class to `ResolutionOutcomeMetric`.
- [x] 7.2 Update the exact key-set assertion at `verify-eh112-incomplete-outcomes.ts:213-227`
      in the same commit; it fails the moment the field is added.
- [x] 7.3 Confirm the class carries no candidate key and no free text, keeping the guards at
      `verify-eh112:138` and `verify-eh117:237-247` green.

## 8. Update the suites that pin the old copy

- [x] 8.1 `verify-eh112-incomplete-outcomes.ts` L249-251.
- [x] 8.2 `verify-document-review-runner.ts` L11-12.
- [x] 8.3 `verify-eh117-review-workspace.ts` L176, L230 (guidance arity), L440
      (`summary.incomplete`), L450 (`hasIncompleteOutcomes`).
- [x] 8.4 Add an assertion that no guidance string for any class contains the phrase
      "required context is missing" unless the class is `axis_not_stated`. This is the
      regression guard for #114 itself.

## 9. Close the CI gap this change depends on

- [x] 9.1 Wire `test:eh112`, `test:document-review`, `test:eh117` and the new
      `test:reason-class` into `.github/workflows/measurement-registry.yml`. All three
      existing suites are local-only today, which is why the defect shipped; issue #110
      tracks the general case, but this change MUST NOT rely on suites nobody runs.

## 10. Verification

- [x] 10.1 `pnpm typecheck`, `pnpm test:reason-class`, `pnpm test:eh112`,
      `pnpm test:document-review`, `pnpm test:eh117`, `pnpm test:eh106`,
      `pnpm test:stated-axis`, `pnpm test:cbc-regression`, `pnpm verify:registry`,
      `pnpm build`.
- [x] 10.2 Database suites unchanged and green.
- [x] 10.3 Re-run the real document `298232ee-8b7e-43cf-9b5d-0922d9825e41` and record the
      reason-class distribution. Expect 26 `axis_not_stated`, 12 `definition_not_reviewed`,
      5 `axis_not_stated` (method), 1 `axis_not_stated`. Any other split means the derivation
      is wrong.
      RESULT: 32 axis_not_stated + 12 definition_not_reviewed = 44, matching the
      prediction. Getting there caught a real defect: `conflicts` unions every
      candidate, so numeric Glucose borrowed a `value_kind_conflict` from the
      urine-dipstick definition it was never going to be. A conflict now only
      outranks a missing axis when it leaves nothing selectable. Regression added.
- [x] 10.4 Confirm the candidate input hash is unchanged from task 3.5.

## 11. Delivery

- [x] 11.1 Create `QA/issue-114/checklist.md` per the `roadmap-qa-checklists` skill: manual
      section executable by a non-developer, developer evidence separate. State explicitly
      that the header count changing from one figure to a split is the intended result, so a
      tester does not file it as a regression.
- [ ] 11.2 Update issue #114 with the evidence, and close #63 through this change, noting
      which of its six criteria each artifact satisfies.
- [ ] 11.3 Open the pull request. Note that reviewing the eight provisional definitions is
      deliberately out of scope and remains the cheapest way to resolve those twelve rows.
