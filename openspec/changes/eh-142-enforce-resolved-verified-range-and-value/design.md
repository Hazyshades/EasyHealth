## Context

`projectLaboratoryOutcome` currently establishes that a laboratory row has an active resolved reviewed Registry 2.0 binding and a reviewed compatible assessment binding. `projectHealthProfileLaboratoryInput` then admits that row to Health Profile even when its active revision is pending, its value is qualitative or non-finite, or its persisted range is absent. `buildHealthProfile` prevents some of those rows from producing a score later, but it cannot preserve one stable, assessment-specific explanation across the Health Profile snapshot and Biomarkers UI.

Health Profile assessments are immutable persisted versions. `GET /api/health-profile` reads the latest version when one exists, so policy tightening must also enqueue existing laboratory profiles for recalculation instead of relying only on future observation changes.

## Goals / Non-Goals

**Goals:**

- Evaluate every Health Profile assessment-input gate in one pure, fail-closed predicate.
- Require a current resolved reviewed definition, reviewed compatible assessment binding, `auto_verified`, `user_verified`, or `manually_corrected` active revision, finite numeric value, and usable document-native reference range.
- Preserve a stable machine reason and safe display label for every exclusion without calling the source laboratory result invalid.
- Use the predicate in outcome serialization, Health Profile input projection, Biomarkers API serialization, and Biomarkers table presentation.
- Requeue existing laboratory profiles and invalidate synthesis state without mutating historical assessment versions.

**Non-Goals:**

- Change Registry definitions, aliases, approved assessment bindings, EH-141 score-required groups, score formulas, reference-range parsing, or the verification workflow.
- Infer a generic, population, or Registry reference range when the source document did not provide a usable one.
- Hide excluded source results from the Biomarkers list or treat them as clinically invalid.
- Rewrite immutable assessment history or run database tests against a shared environment.

## Decisions

### 1. Centralize assessment-input eligibility and reason precedence

Create a pure assessment-eligibility module shared by the outcome projector and presentation layers. It returns `{ eligible, exclusionReason }`, where `exclusionReason` is `null` only for a row allowed to affect Health Profile assessment.

The predicate evaluates one deterministic first failure in this order:

1. missing active revision, non-`resolved` outcome, or a binding that is not concrete/reviewed;
2. no reviewed compatible assessment binding;
3. pending or unknown verification status;
4. non-numeric, absent, or non-finite value;
5. missing or unusable document-native reference range.

Existing safe mapping reasons (`no_active_revision`, `incomplete_resolution`, `candidate_only_identity`, and `assessment_binding_ineligible`) remain the output for the corresponding first group. New stable reasons distinguish `verification_required`, `non_numeric_value`, `numeric_value_missing`, `numeric_value_invalid`, `missing_document_reference_range`, and `invalid_document_reference_range`.

A list of parallel failures was rejected: a first-failure contract is deterministic, easy to test, and avoids surfacing downstream claims about an unapproved measurement identity. The raw result and its separate resolver/verification status remain available to explain the next actionable step.

### 2. Treat only source-backed finite ranges as usable

A range is eligible only when `raw_reference_text` is non-blank, at least one persisted reference boundary is finite, and two supplied boundaries are not inverted. A one-sided source range remains usable; a blank source reference, unparseable boundaries, or an inverted range does not.

Checking only `ref_low`/`ref_high` was rejected because those parsed fields alone do not prove that the range was reported by the source laboratory. Substituting Registry or population ranges is rejected because it would change the meaning of the patient document and violate the issue's document-native constraint.

### 3. Make Health Profile admission and API serialization use the same result

`projectLaboratoryOutcome` will publish the strict predicate result through `resolutionDetails.eligibility.assessmentEligible` and `exclusions.assessment`. `projectHealthProfileLaboratoryInput` will emit no input unless that result is eligible, so excluded rows cannot reach readiness, confidence, highlights, state scores, or synthesis input.

The Health Profile snapshot query must select `raw_reference_text`; the Biomarkers API already reads it and will expose `assessment_eligible` plus `assessment_exclusion_reason` from the same projection. This replaces duplicated endpoint-specific checks.

### 4. Keep the source result visible with assessment-specific UI copy

The Biomarkers table will render the stable exclusion reason using a shared safe label below its existing result status. The copy says why the result is not used in the assessment—for example, verification is still needed or the source document has no usable reference range—and never claims that the laboratory result itself is invalid.

Returning only `false` was rejected because it leaves the UI unable to distinguish a pending verification from an unapproved binding or missing source range. Showing raw internal decision evidence was rejected because candidate identity and trace internals are not safe active identity for incomplete outcomes.

### 5. Requeue durable assessments through a migration

Migration `074_eh142_requeue_assessment_eligibility.sql` will upsert a queued `health_profile` recalculation job for each profile with laboratory observations and mark its synthesis state stale. It will preserve an in-flight `processing` job, matching the existing EH-123 enqueue semantics, and it will not update or delete `health_profile_assessment_versions`.

A migration is required because persisted assessment payloads otherwise remain visible until an unrelated observation event causes recalculation. Recomputing synchronously in `GET /api/health-profile` was rejected because it violates the existing read-only snapshot/worker contract.

### 6. Cover the policy at its natural layers

A focused TypeScript runner will assert every exclusion reason, exact predicate/API projection, Health Profile input omission, verified-pass behavior, and user-safe label mapping. A disposable pgTAP test will assert that the migration requeues the affected profile, marks synthesis stale, leaves immutable versions untouched, and does not overwrite an in-flight job.

## Risks / Trade-offs

- **Legacy observations lack `raw_reference_text`** → they are excluded rather than scored. This is intentional fail-closed behavior; the migration makes the change visible promptly, and the Biomarkers UI explains it.
- **One row fails several gates** → only the highest-priority safe reason is exposed. The priority prevents an untrusted identity from producing detailed score guidance; resolver and verification UI retain the underlying state.
- **Migration runs while a worker is processing** → the migration preserves `processing`, so deployment ordering must ensure workers run the new predicate before completion. The migration does not mutate historical output.
- **No shared database testing** → the database check is limited to a disposable local Supabase stack; the QA checklist will record it as blocked rather than passed if that stack is unavailable.
