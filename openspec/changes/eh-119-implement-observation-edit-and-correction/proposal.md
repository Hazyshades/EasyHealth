# Implement observation edit and correction flow

## Why

A reviewer can accept what the extractor read and can re-point a row at a
reviewed measurement definition, but cannot change a single printed number. If
the model read `1.23` as `123`, transposed a unit, or attached the wrong
reference range, the only remedies are reprocessing the whole document — which
re-runs the same model on the same page — or leaving a wrong value in the
record. `PATCH /api/documents/[id]/biomarkers` accepts only
`measurementDefinitionKey`; `correctionReason` is already in the request type
and the UI has never sent it.

The gap is not an oversight in the UI. There is no write path at all. The
writer's observation insert is
`on conflict (source_extracted_biomarker_id) ... do nothing`
(`046_incomplete_analyte_identity_gate.sql`), and
`promote_observation_normalization_revision_v2` projects exactly four columns
onto `observations` — `analyte_key`, `measurement_definition_key`,
`normalization_revision_id`, `resolution_status`. Every value, unit, reference
bound and date in `p_observation` is discarded on the second and every later
write for a row. A correction that changed only the value would return success
and change nothing.

The second half of the gap is semantic. `p_write_kind = 'correction'` raises
`correction_requires_reviewed_concrete_definition` unless the outcome is
`resolved`, and `buildManualCorrectionResolution` hard-sets `result: "resolved"`
and refuses any candidate carrying a missing axis. Correction is therefore
defined as *selecting a concrete definition*, which is the one thing a reviewer
must never be pushed into when the document does not state a specimen. #106
removed the invented specimens and #111 has not yet recovered them, so the
reference document is 44 partial rows and 0 resolved: the manual picker is
correctly empty for essentially the whole live population, and the only
correction a reviewer can make today is the one that does not apply.

Both halves have to close together, or "correct the value and keep the result
partial" — the case this change exists for — stays impossible.

## What Changes

- Model a user correction as an edit to the resolver **input**, not to the
  stored result. A `measurement_override` records only what the reviewer
  restated; the effective measurement, the resolver outcome, the decision trace
  and the identity tier are all re-derived from raw evidence plus that override.
  No user action selects an outcome directly.
- Add `observation_normalization_revisions.measurement_override jsonb`, a
  database-side shape contract for it, and the matching TypeScript contract.
  The override is absolute against raw extraction, never cumulative, so undo is
  a copy rather than a replay.
- Add write kind `value_correction` to
  `write_observation_normalization_revision_v2_legacy`. It carries the override,
  may terminate in any resolver outcome, and derives verification status by the
  existing rules — `manually_corrected` only when the re-resolution is
  `resolved` with a reviewed definition, `pending` otherwise. Neither
  `correction_requires_reviewed_concrete_definition` nor the EH-104 verification
  guard is relaxed.
- **BREAKING** Teach `promote_observation_normalization_revision_v2` to project
  the corrected measurement columns (`value`, `value_text`, `value_kind`,
  `ordinal`, `unit`, `ref_low`, `ref_high`, `observed_at`) onto `observations`
  alongside the four identity columns, and extend its idempotent short-circuit
  to compare them. Raw, source and version columns stay outside the projection
  and outside the override contract, so `observation_provenance_write_once`
  keeps proving that corrections never overwrite raw fields.
- Add `PATCH /api/documents/[id]/biomarkers` action `edit-value`, carrying the
  restated fields plus a required reason, and validate it before it reaches the
  database: a unit that no definition accepts, a reference range whose low
  exceeds its high, a future date and a value that contradicts its value kind
  are refused with a code naming the offending field.
- Re-derive the reviewed-definition picker from the **corrected** input rather
  than the extracted row, so a restated unit can legitimately unblock a
  definition and a restated unit that conflicts with the active binding is
  surfaced as a degrade rather than applied silently.
- Preserve a censored result as printed. `< 0.20` restated by a reviewer stays
  `value_kind = 'text'` with the text verbatim; the flow never synthesises a
  bare number from a comparator and never writes a comparator into the
  `modifier` clinical axis. No specimen, modifier or method editing affordance
  is introduced.
- **BREAKING** Make undo work for a revision with no measurement definition
  key. Undo currently rejects exactly the partial and unmapped revisions this
  change makes correctable. Undo becomes a forward `value_correction` revision
  that restores the target revision's override and carries
  `reversal_of_revision_id`.
- Protect a corrected row from reprocessing. EH-116 selection today defends
  `user_verified` and `manually_corrected` revisions only; a `pending` revision
  carrying an override is a user decision and gains the same default
  protection.
- Render an inline correction form on the review row, outside technical
  details, with a per-row error slot. The workspace has one global error line
  today, above a scrolling list, where a row-level validation failure is
  routinely off-screen.

## Capabilities

### New Capabilities

- `observation-measurement-correction`: the correction contract — what a
  reviewer may restate, how the override is validated and stored, how the
  effective measurement is derived, how a correction is undone, and how a
  corrected row survives reprocessing.

### Modified Capabilities

- `registry-v2-acceptance-correction`: a third user write kind exists; a
  correction may terminate in `partial`, `ambiguous` or `unmapped` without
  fabricating an identity, and its verification status is derived by the
  unchanged rules rather than asserted by the caller.
- `document-extraction-review`: the ordinary review action set includes
  restating a printed value, unit, reference range or date; correction choices
  remain constrained by hard evidence and no correction path offers an unstated
  specimen, modifier or method.
- `documents-api`: the biomarkers PATCH contract gains `edit-value`, a required
  correction reason on every correcting action, and an actionable error code on
  every rejection.
- `observation-review-workspace`: a review row exposes its correctable fields,
  its own error slot, and whether a human has restated it — without reading
  verification status, which EH-120 owns.

## Impact

- Affected domains: `documents` (review workspace, biomarkers API, writer
  seam), `health-profile` (observation reads see corrected values once a row is
  consumer-eligible).
- Affected code: `src/lib/documents/observation-normalization-writer.ts`,
  `src/lib/documents/observation-measurement-correction.ts` (new),
  `src/lib/documents/normalization-review.ts`,
  `src/lib/documents/normalization-revisions.ts`,
  `src/lib/documents/normalization-policy.ts`,
  `src/lib/documents/observation-review-workspace.ts`,
  `src/lib/registry-reprocessing/selection.ts`,
  `src/lib/registry-reprocessing/diff.ts`,
  `src/app/api/documents/[id]/biomarkers/route.ts`,
  `src/app/api/documents/[id]/biomarkers/confirm-observations/route.ts`,
  `src/components/documents/document-viewer.tsx`,
  `src/components/documents/review/observation-review-row.tsx`,
  `src/components/documents/review/observation-correction-form.tsx` (new).
- Affected data and operations: migration
  `047_eh119_observation_measurement_correction.sql` adds
  `observation_normalization_revisions.measurement_override`, the
  `eh119_is_measurement_override` shape function and its CHECK, recreates
  `write_observation_normalization_revision_v2_legacy` with the
  `value_correction` write kind and the override parameter, and recreates
  `promote_observation_normalization_revision_v2` with the corrected-measurement
  projection. The EH-115 trace contract and validation semantics are preserved
  while its wrapper is recreated to pass the explicit override argument. No
  backfill: existing revisions carry a null override and project exactly as
  they do today.
- Not affected: `observation_provenance_write_once` and the raw column set it
  defends, the EH-104 verification guard, the EH-115 trace contract, the EH-118
  source-page and region constraints, and `document_extracted_biomarkers` raw
  columns — none are relaxed, widened or written by this change.

- Release governance: EH-119 does not change `MEASUREMENT_RESOLVER_VERSION`
  (`10`), `MEASUREMENT_CATALOG_MANIFEST_VERSION` (`2026-08-03.0`), the
  catalog manifest digest, or candidate-release approval records. The current
  candidate.3 approval set and hash are inherited unchanged from the completed
  analyte-identity-gate change; no re-signing is required for EH-119.