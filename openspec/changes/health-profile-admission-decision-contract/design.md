## Context

`projectLaboratoryOutcome` already computes Registry binding state, resolver outcome, verification state, consumer eligibility, assessment eligibility, and `assessmentInputKey`. The old Health Profile input helper returned only an input or `null`, while the snapshot then called the outcome projection again to classify excluded observations and hash reported-row evidence.

That nullable seam was insufficient for the confirmed model:

- admission means eligible for Health Profile input, not numeric score contribution;
- reported-result visibility and buckets are independent from admission;
- censored values are valid text evidence but never numeric score contributors;
- candidate evidence and versions must survive the transfer to consumers;
- the snapshot must evaluate one persisted observation once.

## Goals

- Make admission a named, typed decision boundary.
- Keep `evaluateAssessmentEligibility` as the only owner of first-failure predicate order.
- Preserve the complete outcome/evidence needed by score exclusions, reported rows, and canonical hashing.
- Reuse one decision for every snapshot consumer of a persisted observation.
- Preserve all externally observable behavior and the fixed baseline hash.

## Non-Goals

- Do not move resolver or eligibility rules into the snapshot.
- Do not make `accepted` mean score-contributing.
- Do not use admission to hide reported rows or alter report buckets.
- Do not add candidate evidence to the canonical snapshot hash.
- Do not change persistence, API payloads, migrations, or RPCs.

## Decisions

### D1 — Outcome projection remains the rule owner

`projectLaboratoryOutcome` calls `evaluateAssessmentEligibility` once and publishes the canonical assessment exclusion. `projectHealthProfileLaboratoryAdmission` consumes that summary and performs only presentation projection: censored-marker preservation, numeric conversion, and construction of the accepted input.

The admission decision uses the outcome exclusion as its `excluded.reason`. If presentation cannot produce an input after a successful identity/binding projection, it fails closed with the corresponding numeric or binding exclusion rather than re-running the predicate.

### D2 — Admission is a discriminated decision with evidence

The public result is:

- `accepted`: `{ kind, input, evidence }`
- `excluded`: `{ kind, reason, evidence }`

Evidence retains the full `LaboratoryOutcomeSummary`, canonical outcome/incomplete reason, binding identity, verification state, resolution versions, and persisted resolver evidence including candidate evidence. The evidence is available to callers but is not added to the snapshot hash.

### D3 — Snapshot owns orchestration, not policy

`buildHealthProfileSnapshot` builds an observation-id map of admission decisions after loading effective active revisions. Linked extracted rows reuse the cached decision. Direct score input and score-exclusion adapters also reuse it. Unlinked extracted rows remain preview/report-only and do not become assessment inputs.

The existing `reportedRows` projection continues to pass every extracted row into `projectHealthProfileReportedResults`. Admission only supplies the existing `assessment_input` value for linked rows; it does not gate reported visibility or bucket selection.

### D4 — EH-164 precedence is explicit

A comparator/detection-limit marker is preserved when the outcome's assessment exclusion is `non_numeric_value` and the reviewed binding can supply an assessment key. The marker carries finite reference endpoints when present, null endpoints when absent, and inverted endpoints as printed evidence. It always carries `value: null` and `value_kind: "text"`; numeric scoring and trend projection remain unavailable.

### D5 — Hash and score-exclusion compatibility are invariants

The snapshot hash continues to receive the same fields and values. Score exclusions continue to map the four existing admission reasons directly and all other assessment exclusions to `assessment_binding_ineligible`, preserving the existing consumer contract. A fixed baseline fixture captures the pre-change projection and is never regenerated after the implementation.

### D6 — Reported readiness ambiguity remains separate

The current `ready_for_scoring_count` behavior is intentionally preserved, including its treatment of accepted text markers. Changing that policy requires a separate design and acceptance surface.

## Data Flow

```text
persisted observation + effective revision
             |
             v
 projectLaboratoryOutcome
   - resolver/binding projection
   - evaluateAssessmentEligibility (once)
   - outcome + resolution/evidence
             |
             v
 projectHealthProfileLaboratoryAdmission
   - accepted input OR excluded reason
   - evidence transfer
             |
             +--> Health Profile inputs / ScoreExclusion adapter
             +--> linked reported-result row assessment_input
             +--> canonical snapshot row evidence/hash

unlinked extracted row --> preview outcome --> reported-result projection only
```

## Verification Evidence

- Fixed baseline: `scripts/verify-health-profile-admission-baseline.ts`.
- EH-142 verifies exclusion precedence and evidence transfer.
- EH-164 verifies accepted censored markers with valid, missing, and inverted ranges.
- EH-147 verifies golden admission/profile output.
- Registry documentation generation, drift checks, Wiki render/staging, and tracking issue #247 cover documentation synchronization.
