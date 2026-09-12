> **Status:** The implementation is present in the working tree and is now being placed under its own OpenSpec for review and branch isolation. This document is the authoritative architecture record for the score/readiness seam.

# Design: health-profile-score-readiness-policy-seam

## Context

The Health Profile projection has three distinct boundaries:

1. upstream admission decides whether a persisted laboratory observation is eligible to enter Health Profile input;
2. score/readiness policy decides which admitted facts are current, ready, score-contributing, and explainable;
3. profile assembly and UI decide how the result is serialized and presented.

The previous implementation mixed the second boundary with assembly and left the ownership of identity reduction, freshness, and aggregates implicit.

## Goals

- Make score/readiness ownership explicit in one internal module.
- Preserve exact observable behavior, including Registry group membership, alternatives, freshness boundaries, score formulas, nullability, confidence, provenance, exclusions, and overall threshold.
- Keep admission, observation loading, profile assembly, lifecycle state, and presentation outside the policy.
- Make `asOf` the only freshness reference date and keep `evaluatedAt` informational.
- Retain all accepted candidate facts until policy-owned identity selection; preserve the existing equal-tie input-order behavior.
- Keep existing consumers and persisted payloads compatible.

## Non-Goals

- No schema, migration, RPC, writer, or persistence change.
- No new scoring or clinical rule.
- No replacement of the existing Registry admission projector.
- No reinterpretation of upstream admission exclusions by the policy.
- No lifecycle job-state calculation inside the policy.

## Decisions

### D1 — Explicit policy boundary

`evaluateHealthProfileScorePolicy(candidates, context)` is the only entry point for score/readiness evaluation. Its input is a list of admitted `AssessmentCandidate` values. Its output contains per-system results and all profile-level aggregates required by the existing builder.

`buildHealthProfile` remains the public assembly function. It filters non-laboratory/unresolved direct inputs at the admission boundary, resolves the reviewed Registry binding and source, creates candidates, invokes the policy, merges upstream exclusions, and adds primary-source/highlight presentation data.

### D2 — Assessment candidate contract

An Assessment candidate contains the normalized observation, Registry system, assessment-input identity, measurement-definition identity, score role, expected specimen, and optional source. It is valid after upstream admission and before latest-by-identity selection. The policy selects the latest candidate for each `(assessment_input_key, specimen, modifier)` identity.

Recency remains exact: complete calendar dates outrank incomplete dates; complete dates compare lexically; then `observation_id:document_id` is compared lexically. If all comparison fields are identical, the first input remains selected. No additional tie-breaker is introduced.

### D3 — Explicit immutable evaluation context

The policy context contains:

- `asOf`: the date used for every freshness decision;
- `evaluatedAt`: computation/provenance timestamp only;
- `freshnessPolicy`: the versioned policy object;
- `registry`: a read-only Registry 2.0 snapshot containing named systems, non-scoreable systems, readiness groups, contribution groups, and coverage keys.

Changing `evaluatedAt` while keeping all facts, `asOf`, freshness policy, and Registry snapshot constant cannot change readiness or score output.

### D4 — Policy-owned decision sequence

For each selected candidate, the policy computes the neutral factual marker status and freshness status. It then evaluates required groups using the existing precedence: `missing`, `unknown_date`, `outdated`, `invalid`. A system is scoreable only when every required group is satisfied. Score contribution uses only current numeric core markers with usable document references and compatible reviewed specimens. Confidence, contributors, exclusions, provenance, and the overall threshold are computed from the same selected marker set.

The overall score is available only when at least three named systems are scoreable. General/supporting data and explicitly non-scoreable systems remain represented according to the existing projection behavior.

### D5 — Neutral marker classifier

`getMarkerStatus(value, refLow, refHigh, valueKind)` is factual and presentation-neutral. Numeric values outside a printed bound are `out_of_range`; numeric values within a usable bound are `in_range`; text, qualitative, null, or range-less values are `unknown`. EH-164 text markers retain `value: null` and cannot contribute a numeric score.

### D6 — Lifecycle is a separate axis

Queued or processing recalculation state is supplied by the EH-146 lifecycle path and is not inferred from score-readiness reasons. When a completed version exists, its scores and provenance remain visible while the lifecycle display state reports the update. Observation-level `outdated` and `unknown_date` still make the affected readiness evaluation unavailable.

### D7 — Compatibility and versioning

The public `HealthProfileResult` and `SystemInsight` structures remain unchanged. Legacy persisted payloads remain accepted. Newly computed results carry the existing score algorithm and freshness metadata; unknown historical payloads are not relabeled with the current algorithm version merely because they are read.

## Migration Map

| Responsibility | Canonical owner | Consumers / evidence |
| --- | --- | --- |
| Laboratory admission | `projectHealthProfileLaboratoryAdmission` and existing outcome eligibility | `src/lib/health-profile-snapshot.ts`, reported-result projection |
| Candidate preparation / assembly | `buildHealthProfile` in `src/lib/health-systems.ts` | Health Profile snapshot and direct verification fixtures |
| Marker status | `src/lib/health-profile-marker-status.ts` | score policy, admission exclusions, EH-140, reported rows |
| Identity reduction and freshness | `evaluateHealthProfileScorePolicy` | EH-144 freshness verifier, Health Profile builder |
| Readiness, score, confidence, provenance, exclusions, aggregate | `src/lib/health-profile-score-policy.ts` | EH-141, EH-143, EH-145, EH-147 and public builder output |
| Lifecycle / presentation | `health-profile-assessment-state.ts` and drawer consumers | EH-146 and `HealthProfileDrawer` |

## Data Flow

```text
persisted observation + effective Registry revision
                    |
                    v
        admission / snapshot orchestration
                    |
                    v
         admitted Assessment candidates
                    |
                    v
 evaluateHealthProfileScorePolicy(candidates, context)
   - latest identity selection
   - factual freshness from asOf
   - required-group readiness
   - contribution score and confidence
   - provenance, exclusions, and aggregates
                    |
                    v
       buildHealthProfile assembles public result
          + upstream exclusions
          + source/highlight presentation data
                    |
                    v
       API / Health Profile UI / lifecycle adapters
```

## Verification Evidence

- `pnpm test:eh141`, `pnpm test:eh143`, `pnpm test:eh144`, `pnpm test:eh145`, `pnpm test:eh146`, `pnpm test:eh147`, `pnpm test:eh164`, and `pnpm test:eh165` pass.
- `pnpm test:eh106-consumer` passes with the repository's CI placeholder environment, proving unadmitted, provisional, instrumental, and reviewed Registry inputs remain distinguished.
- `pnpm test:health-profile-lab-input`, `pnpm test:health-profile-reported-results`, `pnpm test:biomarkers`, and `pnpm test:health-profile-drawer-status` pass.
- `pnpm check:ci-suite-coverage` reports 103 covered suites and no orphaned suites; the admission baseline verifier is reachable from the Measurement Registry workflow.
- Canonical biomarker documentation generation, drift check, contract test, Wiki render/export, and remote Wiki publication are recorded in existing Registry tracking issue #247.
- `pnpm typecheck` remains blocked by pre-existing `DocumentType` union errors outside this change; no score-policy diagnostics remain.
