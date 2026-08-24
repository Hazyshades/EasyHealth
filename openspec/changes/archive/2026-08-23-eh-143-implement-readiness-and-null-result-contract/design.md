## Context

The Health Profile projection already derives required groups from reviewed Registry 2.0 assessment bindings and calculates a numeric score only after the evaluator says a named system is scoreable. Its response nevertheless carries two overlapping failure projections (`missing_groups` and `present_without_reference`) rather than one stable reason contract. `buildHealthProfile` also evaluates the same groups twice, and `computeSystemStateScore` contains dead soft-fallback code after its strict return. Separately, `GET /api/health-profile` returns the latest persisted payload even while a recalculation job is queued or processing, so an obsolete numeric assessment can appear current.

EH-141 owns the clinical-policy approval and group rationale; EH-142 owns admission of verified, resolved, reviewed, numeric laboratory observations. EH-143 consumes those boundaries. It must not create a biological recency rule or widen the observation-admission policy.

## Goals / Non-Goals

**Goals:**
- Make one readiness evaluator the authority for nullable named-system scores.
- Emit deterministic, machine-readable `missing`, `invalid`, and `outdated` reasons.
- Preserve Registry-derived alternatives and block context-only inputs from satisfying required groups.
- Prevent stale persisted scores from appearing as current while recalculation is unfinished.
- Give first-party presentation enough information to describe unavailable versus updating assessments accurately.

**Non-Goals:**
- Change EH-141 required groups, Registry membership, assessment bindings, clinical rationale, or score contribution weights.
- Change EH-142 verification, resolution, source-lifecycle, numeric-value, or document-reference admission rules.
- Treat a laboratory observation as medically outdated based on an arbitrary age threshold.
- Add a database migration, backfill, external service, diagnosis, or treatment recommendation.

## Decisions

### 1. Make readiness reasons the canonical unavailable-score contract

`SystemScoreReadiness` will expose an ordered `reasons` collection. Each unsatisfied required group produces exactly one entry:

```ts
type ScoreReadinessReason = {
  code: "missing" | "invalid" | "outdated";
  required_group: string[] | null;
  present_keys: string[];
};
```

- `missing`: none of the group alternatives appears in the admitted system markers.
- `invalid`: one or more alternatives appears, but none is usable for a score (finite numeric value, `core` role, matching reviewed specimen, and at least one document-native reference bound).
- `outdated`: a persisted assessment is superseded by a non-succeeded recalculation job. It has no group because it describes snapshot freshness rather than laboratory evidence.

`ScoreReadinessGroup.status` becomes `satisfied`, `missing`, or `invalid`. The legacy `missing_groups` and `present_without_reference` response fields are removed; all first-party callers derive their display from `reasons`. This is a clean response-contract cutover rather than two potentially divergent views of the same state.

Alternative considered: retain the old aggregate arrays and append free-form labels. Rejected because clients would have three competing readiness sources and could silently lose an `invalid` or `outdated` distinction.

### 2. Reuse the evaluated result when calculating a score

The evaluator remains responsible for deciding scoreability from `getRegistryV2ScoreReadinessGroups`. `buildHealthProfile` evaluates each system once, includes that result in `SystemInsight`, and passes it into score calculation. A score is calculated only when the supplied evaluation is scoreable; contribution groups continue to choose at most one usable marker by deterministic runtime order. The unreachable soft-score fallback is deleted.

Alternative considered: calculate from all core markers after each group check. Rejected because it would duplicate the selection and readiness work and could reintroduce a partial average through a future fallback.

### 3. Treat queued recalculation as an outdated snapshot, not current evidence

When a persisted health-profile version exists and its recalculation job is not `succeeded`, the API applies a pure response transformation before serialization:

- set every named system `state_score` and `overall_state_score` to `null`;
- add one `outdated` readiness reason to each named system without removing its evidence-level reasons or factual markers;
- set `assessment_freshness` to `outdated`.

A snapshot with no job or a succeeded job has `assessment_freshness: current`. The existing response `assessment.status` remains the operational job state. The scoreable-system count remains evidence metadata from the last calculated snapshot; the UI must not describe it as a current numeric assessment while freshness is outdated.

Alternative considered: synchronously rebuild a snapshot on every queued request. Rejected because the queued worker is the established authoritative recalculation path and request-time reconstruction can race the worker while turning a read endpoint into an expensive recomputation path.

### 4. Render reason codes rather than infer incomplete state

The drawer derives needed alternatives and unusable observed alternatives from readiness reasons. The overall card receives `assessment_freshness` and uses an updating explanation when scores were suppressed for `outdated`, instead of calling the state insufficient data. This preserves factual marker visibility and avoids presenting an old value as current.

## Risks / Trade-offs

- **A queued or failed worker temporarily hides a previously valid score.** This is intentional: an unavailable current assessment is safer than a stale current-state claim. The API exposes the job status and `outdated` code so clients can retry or poll.
- **Existing external consumers of the old readiness arrays will need migration.** This repository's first-party consumers are migrated in the same change; the response-shape change is documented in the delta spec.
- **`invalid` remains a technical usability classification, not a statement that the source laboratory result is invalid.** UI copy must retain that distinction.
- **EH-141 and EH-142 remain release dependencies.** This change enforces their existing runtime contracts but cannot establish their clinical sign-off or observation-admission guarantees itself.
