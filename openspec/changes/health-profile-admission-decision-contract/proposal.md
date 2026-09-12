## Why

Health Profile laboratory admission previously exposed only a nullable projected input. That shape discarded the canonical exclusion decision and forced the snapshot path to recompute outcome data when building score exclusions and reported-result rows. The resulting seam made admission, evidence preservation, and reported visibility easy to conflate.

The confirmed architecture needs one explicit admission decision per persisted laboratory observation, with evidence retained for consumers and a separate reported-result policy.

## What Changes

- Add `projectHealthProfileLaboratoryAdmission`, returning a discriminated `accepted` or `excluded` decision.
- Preserve the single `evaluateAssessmentEligibility` predicate order through `projectLaboratoryOutcome`; the admission projector consumes that result rather than re-running it.
- Carry canonical outcome, incomplete reason, binding identity, verification, resolver evidence, candidate evidence, and resolution versions with every decision.
- Cache one decision per persisted observation in the shared Health Profile snapshot and reuse it for direct inputs, score exclusions, and linked reported-result rows.
- Keep reported visibility, bucket classification, and source counts independent from assessment admission.
- Preserve EH-164 comparator/detection-limit markers as accepted text inputs with `value: null`; they remain non-numeric for scoring and trends.
- Add fixed before/after baseline fixtures proving input, exclusion, reported-result, count, and snapshot-hash parity.
- Synchronize canonical biomarker documentation, the generated Wiki mirror, and the Registry documentation tracking issue.

## Non-Goals

- No database migration, RPC, persistence schema, or public API response change.
- No change to `ready_for_scoring_count`; its current policy remains a separately tracked follow-up.
- No change to resolver predicate ordering, exclusion codes, score-role policy, readiness policy, or numeric scoring semantics.
- No admission gate on reported-result visibility or reported-result bucket classification.

## Capabilities

### New Capabilities

- `health-profile-admission`: explicit admission decision and evidence contract for persisted laboratory observations.

### Modified Capabilities

- `health-profile`: snapshot orchestration reuses cached admission decisions without changing its canonical hash or score-exclusion payload.
- `incomplete-laboratory-outcomes`: outcome evidence is consumed as the canonical admission source.
