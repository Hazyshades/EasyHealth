## Why

The current health profile assigns a numeric state score whenever it can find score drivers, including a soft fallback for supporting or unmapped markers. This can turn a small set of in-range specialty markers into a reassuring score even when the minimum evidence for an organ-system assessment is absent.

The profile needs to distinguish an unavailable assessment from a poor assessment, while still exposing all uploaded marker data and showing users what evidence would unlock a score.

## What Changes

- Replace soft fallback scoring with strict score readiness: a named system receives a numeric score only when every configured `scoreRequiredGroups` group has at least one usable numeric marker with a document lab reference range.
- Add catalog-driven score-contribution groups so correlated or derived core markers do not receive multiple equal-weight votes in a system score.
- Keep inflammation factual and explicitly unscored in MVP; it must not become scoreable through an empty required-group list.
- Keep marker score roles separate from readiness and coverage: only `core` markers drive a score; `extended` and `display` markers remain factual supporting data; coverage flags continue to calculate data confidence.
- Add catalog-driven, per-system `scoreRequiredGroups` so a group can express acceptable alternatives such as `LDL OR non-HDL cholesterol`.
- Return an unscored (`null`) state for a named system that has no usable complete minimum set, rather than returning `0` or a soft fallback score.
- Show all eight named body systems after the first biomarker observation; show `General` only when supporting, specialty, or unmapped markers exist, and never score General.
- Add drawer guidance for no data, incomplete required groups, markers present without a usable reference range, supporting markers already recorded, and an upload CTA.
- Replace an unavailable overall score with an insufficient-data state. It is dismissible only on the Health Profile page; the Dashboard keeps a persistent explanatory card so its grid never contains a blank widget. Restore the numeric overall assessment only when at least three named systems become scoreable, and show the contributing-system denominator alongside it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `health-profile`: Display scored and unscored body-system assessments, strict readiness guidance, S3 body-map coverage, and the dismissible insufficient-data overall state.
- `health-profile-api`: Return catalog-driven score readiness, nullable scores, named-system placeholders, and drawer-ready evidence gap data deterministically.

## Impact

- Affected aggregation and catalog code: `src/lib/health-systems.ts`, `src/lib/biomarkers/types.ts`, and `src/lib/biomarkers/catalog/*`.
- Affected presentation: body map, system drawer, overall assessment card, profile page, and dashboard health-assessment widget.
- Affected verification: health-profile aggregation tests and biomarker verification runner.
- No new external services, payments, or dependencies.
