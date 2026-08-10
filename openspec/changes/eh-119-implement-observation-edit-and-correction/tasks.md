# Tasks

## 1. Database contract

- [x] 1.1 Create `supabase/migrations/047_eh119_observation_measurement_correction.sql` and add `observation_normalization_revisions.measurement_override jsonb` with a column comment naming it the EH-119 user restatement of the reported measurement.
- [x] 1.2 Add `public.eh119_is_measurement_override(jsonb) returns boolean immutable`: object, at least one key, keys drawn only from `value`, `value_text`, `value_kind`, `ordinal`, `unit`, `ref_low`, `ref_high`, `observed_at`; `value_kind` in the four stored kinds; numeric kind carries `value`, non-numeric carries non-blank `value_text`; `ref_low <= ref_high` when both present; `unit` non-blank when present; `observed_at` a valid date.
- [x] 1.3 Add `constraint observation_normalization_revisions_measurement_override_valid check (measurement_override is null or eh119_is_measurement_override(measurement_override))`.
- [x] 1.4 Recreate `write_observation_normalization_revision_v2_legacy` from the `046` body with a `p_measurement_override jsonb default null` parameter, `value_correction` added to the `p_write_kind` allowlist, and the override persisted on the inserted revision. Leave `correction_requires_reviewed_concrete_definition` scoped to `p_write_kind = 'correction'` and leave `incomplete_normalization_cannot_have_concrete_identity` and `resolved_normalization_requires_concrete_identity` unchanged.
- [x] 1.5 Extend the verification-status derivation so `value_correction` yields `manually_corrected` when the resolution is `resolved` with a reviewed definition and `pending` otherwise, and confirm the result satisfies `eh104_validate_normalization_revision_verification` unchanged.
- [x] 1.6 Add `invalid_measurement_override` and `measurement_correction_requires_reason` to the writer's validation ladder, raised with the existing `raise exception using message = '<snake_case_code>'` convention.
- [x] 1.7 Recreate `promote_observation_normalization_revision_v2` so it projects `value`, `value_text`, `value_kind`, `ordinal`, `unit`, `ref_low`, `ref_high` and `observed_at` from the writer's observation payload alongside the four identity columns, in the same transaction and under the same locks.
- [x] 1.8 Widen the promotion short-circuit at `033:108-116` to compare the projected measurement columns as well as the identity columns, so a measurement-only correction is not skipped as an idempotent no-op.
- [x] 1.9 Confirm the migration does not replace the EH-115 wrapper `write_observation_normalization_revision_v2`, does not alter `enforce_observation_provenance_write_once`, and re-applies the `039` grant matrix only if it recreates a granted object. End the file with `notify pgrst, 'reload schema'`.
- [ ] 1.10 Verify the whole chain applies cleanly with `supabase db reset` and that `047` is re-runnable in line with the `#119` idempotency convention. `supabase migration up --local` is clean and direct SQL evidence passed; the destructive full reset remains unrun in this Windows workspace.

## 2. Correction domain module

- [x] 2.1 Add `src/lib/documents/observation-measurement-correction.ts` exporting `MeasurementOverride`, `parseMeasurementOverride`, `isMeasurementOverride` and `applyMeasurementOverride`, mirroring `eh119_is_measurement_override` exactly and following the shape of `src/lib/documents/source-region.ts`.
- [x] 2.2 Implement `applyMeasurementOverride(row, override)` returning the effective measurement used for both the resolver input and the observation payload, applying only present keys and leaving every raw field untouched.
- [x] 2.3 Implement censored-value handling: a restated value carrying a comparator is preserved as `value_kind: "text"` with the string verbatim and never routed through `parseLabNumber`; the override contract has no specimen, modifier, timing or method key.
- [x] 2.4 Add `validateMeasurementCorrection` returning a discriminated result carrying a stable code per failure: `override_empty`, `override_unknown_field`, `value_kind_requires_value`, `value_kind_requires_text`, `reference_range_inverted`, `observed_at_in_future`, `unit_blank`, `unit_unsupported`, `unit_dimension_conflict`, `correction_reason_required`.
- [x] 2.5 Wire the unit check to `normalizeMeasurementUnit` plus `evaluateUnitCompatibility` against the definition currently bound to the row, and return `unit_dimension_conflict` with the observed unit and expected dimension unless the request acknowledges losing the binding.
- [x] 2.6 Add `codeFor` mapping from writer and RPC codes to HTTP status, replacing the hand-written 409 message allowlist in the biomarkers route.

## 3. Writer seam

- [x] 3.1 Extend `ObservationNormalizationWriteKind` in `src/lib/documents/observation-normalization-writer.ts` with `"value_correction"` and add `code` to `ObservationNormalizationWriterError`.
- [x] 3.2 Change `measurementInputFromWriterRow` to take an optional effective override so the resolver input is built from raw evidence plus the restatement, keeping `statedAxisValue` filtering intact for every axis.
- [x] 3.3 Change `buildObservationPayload` to emit the effective measurement while continuing to emit raw provenance unchanged, and keep the EH-118 null-`source_page` rejection.
- [x] 3.4 Make `writeExtractedBiomarkerNormalization` load the active revision's override when the caller supplies none, so acceptance, confirmation and reprocessing writes re-emit the corrected measurement rather than the extracted one.
- [x] 3.5 Add the override and the correction reason to `buildNormalizationWriterRequestHash` so two different corrections cannot share an idempotency key and an identical replay still reuses one revision.
- [x] 3.6 Pass `p_measurement_override` through the RPC call and surface the new RPC codes as `ObservationNormalizationWriterError` with their codes.
- [x] 3.7 Add `measurement_override` to the revision select list in `src/lib/documents/normalization-revisions.ts` and expose it on `NormalizationRevision`.

## 4. Read paths

- [x] 4.1 Expose the active override and a derived `userCorrected` flag from `buildNormalizationReview` in `src/lib/documents/normalization-review.ts`, and compute `manualOptions` from the corrected input rather than the extracted row.
- [x] 4.2 Return the effective measurement, the raw printed evidence and the `userCorrected` flag from `GET /api/documents/[id]`, `GET /api/documents/[id]/biomarkers` and `GET /api/documents/[id]/observations`, leaving uncorrected payloads byte-identical to today.
- [x] 4.3 Add the discrete correctable fields and `userCorrected` to `ReviewRowRawEvidence`/`ReviewRow` in `src/lib/documents/observation-review-workspace.ts` without introducing any candidate measurement or analyte key into the row projection.
- [x] 4.4 Keep `serializeLaboratoryOutcome` and the EH-118 region gating unchanged, and confirm `projectLaboratoryOutcome` consumer eligibility is untouched by a correction.

## 5. API

- [x] 5.1 Add the `edit-value` action to `PATCH /api/documents/[id]/biomarkers`: `{ extractedBiomarkerId, action: "edit-value", override, correctionReason, expectedActiveRevisionId, acknowledgeDefinitionLoss? }`, with the actor taken from `getSessionProfileId()` and never from the body.
- [x] 5.2 Require a non-blank `correctionReason` for both `correct` and `edit-value`, and return `400` with `correction_reason_required` when it is missing.
- [x] 5.3 Remove the `undo` rejection for a target revision without a `measurement_definition_key` and implement undo as a forward `value_correction` restoring the target revision's override and identity with `reversal_of_revision_id` set.
- [x] 5.4 Replace the 409 message allowlist with code-driven status mapping so a validation failure is `400`, a stale or projection conflict is `409`, a writer-contract rejection is `422`, and no correction rejection can surface as `500`.
- [x] 5.5 Return `{ revision, compatibleDefinitionKeys, userCorrected }` where `compatibleDefinitionKeys` is computed from the corrected input.
- [x] 5.6 Migrate `POST /api/documents/[id]/biomarkers/confirm-observations` to the changed writer signature without changing its behaviour or its write kind.

## 6. Reprocessing protection

- [x] 6.1 Treat an active revision carrying a `measurement_override` as a protected manual decision in `src/lib/registry-reprocessing/selection.ts`, on the same terms as `user_verified` and `manually_corrected`.
- [x] 6.2 Add the corresponding skip reason and counter in `src/lib/registry-reprocessing/diff.ts` and `service.ts` so a protected corrected row is reported in the batch summary.
- [x] 6.3 Confirm that an explicitly included corrected row still carries its override forward through `materializeRow`, so overriding the protection re-resolves identity without discarding the restated measurement.

## 7. Review UI

- [x] 7.1 Add `src/components/documents/review/observation-correction-form.tsx` using the existing `Input`/`Button` primitives and controlled `useState`, prefilled from the row's correctable fields and the active override, with a required reason field. Introduce no new form or toast dependency.
- [x] 7.2 Add a `correction?: ReactNode` prop to `ObservationReviewRow` rendered in the row body, outside `ReviewTechnicalDetails`, and offer it only for reviewable rows.
- [x] 7.3 Add a per-row error and busy slot so a failed correction renders on its own row, preserves the entered values, and disables only that row's controls.
- [x] 7.4 Add `correctionDrafts`, `correctingRowId` and `handleCorrectMeasurement` to `document-viewer.tsx` mirroring the existing `manualSelections`/`normalizingId`/`handleManualCorrection` pattern, refreshing through `loadBootstrap(currentPage, { soft: true })`.
- [x] 7.5 Render the restated-by-a-person marker from `userCorrected` rather than from verification status, and keep the printed evidence visible beside the corrected measurement.
- [x] 7.6 Give the `unit_dimension_conflict` case copy that names the unit and the expected dimension and asks the reviewer to confirm losing the mapping, and give `stale_revision_conflict` copy that asks for a reload.
- [ ] 7.7 Confirm opening the form does not change the selected row, the current page or the source highlight. The review route could not be rendered locally; this remains a CI/deployed UI check.

## 8. Automated coverage

- [x] 8.1 Add `supabase/tests/eh119_observation_measurement_correction.sql`: override shape acceptance and rejection, `value_correction` on a partial row commits `pending` with no definition key, `value_correction` reaching a reviewed definition commits `manually_corrected`, `correction` still rejects a non-resolved outcome, the write-once trigger still rejects a raw-column update, a measurement-only correction updates the observation, and an identical replay reuses one revision.
- [x] 8.2 Extend `supabase/tests/writer_rpc_seam.sql` with a real `p_measurement_override` payload produced by the application writer, and assert the corrected observation projection through the real RPC rather than a hand-built fixture.
- [x] 8.3 Extend `supabase/tests/eh106_atomic_observation_normalization_writer.sql` to prove the widened projection did not break the existing acceptance paths: an acceptance replay is still an idempotent no-op, and the CAS and lineage failures are unchanged.
- [x] 8.4 Mutation-check every new SQL assertion against the pre-`047` functions and record which pre-fix behaviour each one fails on.
- [x] 8.5 Add `scripts/verify-eh119-measurement-override.ts` covering the override contract, `applyMeasurementOverride`, censored-value preservation, and the validation code table.
- [x] 8.6 Add `scripts/verify-eh119-correction-flow.ts` covering the corrected-input picker recomputation, the request-hash change, the reprocessing protection predicate, and static wiring guards that the correction form is rendered outside technical details and that no specimen, modifier, timing or method control exists in it.
- [x] 8.7 Register `"test:eh119": "tsx scripts/verify-eh119-measurement-override.ts && tsx scripts/verify-eh119-correction-flow.ts"` and `"test:eh119-db": "supabase test db --local supabase/tests/eh119_observation_measurement_correction.sql"` in `package.json`. The aggregate `test:eh119` also runs the observation-correction contract verifier.
- [x] 8.8 Wire `pnpm test:eh119` into the `verify` job and `pnpm test:eh119-db` into the `database` job of `.github/workflows/measurement-registry.yml`, with the four `ci-placeholder` env vars, before the Supabase stop step.
- [x] 8.9 Run `pnpm typecheck`, `pnpm test:eh117`, `pnpm test:eh118`, `pnpm test:eh116`, `pnpm test:writer-seam` and `pnpm verify:registry` and confirm no regression; record the state of the pre-existing `pnpm test:eh111` failure rather than masking it. The writer seam's equivalent direct Postgres run passed; the CLI wrapper is documented as a Windows mount limitation.

## 9. QA, verification, and handoff

- [x] 9.1 Create `QA/eh-119/checklist.md` from `QA/_templates/roadmap-checklist.md` with `EH119-UI-01…` interface checks covering value, unit, reference range and date correction, required reason, keeping a row partial, undo, an invalid unit, an inverted range, a future date, a censored value, and a concurrent-edit conflict.
- [x] 9.2 Record in the checklist's out-of-scope section that a corrected `partial` row is still excluded from trends, reports, context, conversion and assessment by `baseExclusion`, so a tester does not report it as a defect.
- [ ] 9.3 Record the developer-evidence section: `pnpm test:eh119`, `pnpm test:eh119-db`, migration `047` applying cleanly on a full `supabase db reset`, and the write-once trigger proof. The migration-up and direct Postgres evidence are recorded; full reset and CLI SQL wrappers remain unavailable.
- [x] 9.4 Add the `Automated regression coverage` and `Local verification record` sections in the EH-117/EH-118 format.
- [x] 9.5 Run `openspec validate eh-119-implement-observation-edit-and-correction --strict` and resolve every finding.
- [x] 9.6 Confirm `MEASUREMENT_RESOLVER_VERSION`, `MEASUREMENT_CATALOG_MANIFEST_VERSION` and the candidate-release approvals are unchanged by this change, and state that in the proposal's impact section if the implementation forces a bump.
- [x] 9.7 Reconcile the `registry-v2-acceptance-correction` delta with `fix-analyte-key-identity-gate`: the identity-gate change is archived at `openspec/changes/archive/2026-08-09-fix-analyte-key-identity-gate/`, and EH-119 extends its requirement without an unarchived delta conflict.
- [x] 9.8 Commit with `git add -f openspec/changes/eh-119-implement-observation-edit-and-correction`, a `feat(eh-119):` subject, and `Closes #19` in the PR body. The implementation and OpenSpec artifacts are committed; the PR still needs `Closes #19` in its body.
