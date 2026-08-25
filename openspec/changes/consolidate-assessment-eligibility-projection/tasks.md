## 1. Consolidate exclusion taxonomy

- [x] 1.1 Derive trend/report/structured-context exclusions in `buildEligibility` from the computed `AssessmentEligibility` reason for the shared identity gates and delete the `baseExclusion` duplicate gate chain.
- [x] 1.2 Narrow the consumer exclusion types so only `conversion_unavailable` stays consumer-local, and fix any compile-time fallout in consumers of `LaboratoryConsumerEligibility`.

## 2. Single-projection Health Profile input

- [x] 2.1 Store the reviewed-compatible binding's `assessmentInputKey` on `LaboratoryOutcomeSummary` where `hasReviewedAssessmentBinding` is already computed.
- [x] 2.2 Rewrite `projectHealthProfileLaboratoryInput` to consume one projection: guard `assessmentEligible && assessmentInputKey`, then `presentObservation`; delete the second `projectActiveRegistryV2LaboratoryBinding` call and the redundant definition/finite-value re-checks.

## 3. Predicate boundary cleanup

- [x] 3.1 Type the predicate's `valueKind` input with the canonical `ValueKind` union and parse the raw column once in the projection layer.
- [x] 3.2 Add the ineligible factory for the preview and no-revision branches so dead observation inputs stop being threaded into `evaluateAssessmentEligibility`.

## 4. Regression evidence

- [x] 4.1 Extend `scripts/verify-eh142-assessment-eligibility.ts` with shared-gate consistency assertions (`exclusions.trend` equals `exclusions.assessment` for identity gates) and `assessmentInputKey` presence on eligible outcomes.
- [x] 4.2 Run `pnpm typecheck`, `pnpm test:eh142`, `pnpm test:eh112`, `pnpm test:eh123`, `pnpm test:health-profile-lab-input`, `pnpm test:biomarkers`, and `openspec validate consolidate-assessment-eligibility-projection --strict`; record results.
