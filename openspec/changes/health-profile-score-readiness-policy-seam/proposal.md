> **Status:** This change records the score/readiness policy extraction and its compatibility contract explicitly. The implementation exists in the working tree; this OpenSpec is being added now so the delivered branch has a complete, reviewable specification rather than relying on the unrelated EH-143 drawer change.

# Proposal: health-profile-score-readiness-policy-seam

Domain: **health-profile**

## Why

Health Profile admission, observation preparation, score/readiness evaluation, profile assembly, and presentation had accumulated in one implementation seam. That made it difficult to prove that Registry 2.0 identity selection, freshness, readiness, score contribution, confidence, provenance, and aggregate thresholds had one owner. It also encouraged lifecycle job state to be treated as if it were observation freshness.

The architecture needs one explicit score/readiness policy module while preserving the existing public profile contract and every established scoring/readiness boundary.

## What Changes

- Add `src/lib/health-profile-score-policy.ts` as the single owner of score/readiness policy.
- Define an internal `AssessmentCandidate` contract for admitted, normalized facts before identity selection.
- Move latest-by-identity selection, factual freshness classification, required-group readiness, score contribution, confidence, provenance, score exclusions, and overall aggregation behind `evaluateHealthProfileScorePolicy`.
- Pass explicit `asOf`, `evaluatedAt`, freshness-policy, and read-only Registry 2.0 context into the policy.
- Keep `buildHealthProfile` as the external assembly seam: it prepares admitted candidates, invokes the policy, merges upstream admission exclusions, and attaches presentation-only source/highlight data.
- Add the neutral `getMarkerStatus` classifier used by policy, admission exclusions, reported rows, and knowledge-base verification.
- Keep EH-146 queued/processing lifecycle state separate from factual freshness; a completed score remains visible during recalculation.
- Preserve the external `HealthProfileResult` and `SystemInsight` shapes, legacy persisted payload acceptance, score formulas, thresholds, exclusion ordering, and tie behavior.

## Non-Goals

- No database migration, RPC, persistence schema, or public API shape change.
- No change to resolver, Registry admission, document loading, or reported-row visibility policy.
- No change to scoring semantics, freshness boundaries, required groups, contribution groups, or clinical interpretation.
- No presentation labels or UI lifecycle copy inside the score/readiness policy.
- No new tie-breaker when all existing tie fields are identical; input-order behavior remains explicit and tested.

## Capabilities

### New Capabilities

- `health-profile-score-readiness-policy`: an explicit internal policy contract for candidate reduction and score/readiness evaluation.

### Modified Capabilities

- `health-profile`: profile assembly delegates score/readiness decisions to the policy while retaining the existing external result shape.
- `health-profile-score-readiness`: factual observation freshness and assessment lifecycle are independent axes, with canonical provenance and exclusions preserved.

No breaking changes are intended for API consumers or persisted Health Profile payloads.
