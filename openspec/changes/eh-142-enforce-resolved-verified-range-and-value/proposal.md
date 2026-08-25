## Why

Health Profile currently distinguishes a resolved reviewed binding from score-ready evidence, but it does not enforce verification, numeric value, and document-native reference-range gates at the same admission boundary. A pending or otherwise non-scoreable result can therefore reach assessment projection without a stable, user-safe explanation of why it is not used.

## What Changes

- Add one fail-closed assessment-input eligibility predicate in the **health-profile** domain for laboratory observations.
- Require an active resolved reviewed Registry 2.0 definition, a reviewed compatible assessment binding, a verified normalization revision, a finite numeric value, and a usable document-native reference range before an observation can affect Health Profile readiness, confidence, highlights, state scores, or holistic assessment input.
- Exclude partial, ambiguous, unmapped, provisional, unapproved, unverified, qualitative, non-finite, and range-ineligible observations with stable reason codes.
- Expose the exact assessment exclusion reasons to the Biomarkers UI and render them as assessment-specific guidance that preserves the validity of the source laboratory result.
- Add focused regression coverage, an EH-142 manual QA checklist, and a safe migration that requeues existing laboratory profiles so persisted assessments are recalculated under the stricter policy. No Registry definition, binding, score-group, or scoring-formula change is included.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `incomplete-laboratory-outcomes`: strengthen the Health Profile assessment-admission requirement and its stable consumer exclusion reasons.

## Impact

- **Domain:** `health-profile`, with the existing `incomplete-laboratory-outcomes` capability as the specification owner.
- **Code:** `src/lib/health-profile-input.ts`, the shared laboratory outcome/binding projections, Health Profile snapshot reads, `GET /api/biomarkers`, and Biomarkers status presentation.
- **Tests:** focused TypeScript regression runner and disposable-database migration contract; the migration requeues existing assessments without rewriting their immutable history.
- **Dependencies:** EH-121 supplies append-only active-revision history. EH-141 continues to own clinical approval of score-required groups; this change only enforces the already-reviewed binding and group policy at the input boundary.
