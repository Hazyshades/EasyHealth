## 1. Database foundation

- [x] 1.1 Add migration `041_eh116_registry_reprocess_batches.sql` that
  creates `registry_reprocess_batches` and
  `registry_reprocess_batch_rows` with append-only triggers, RLS,
  service-role-only policies, and revoked grants.
- [x] 1.2 Add the service-only RPCs `registry_reprocess_open_batch`,
  `registry_reprocess_record_row`, `registry_reprocess_apply_batch`,
  `registry_reprocess_finish_row`, and
  `registry_reprocess_finish_batch` with `security definer`,
  `set search_path = public`, and explicit grants only to
  `service_role`.
- [x] 1.3 Add pgTAP fixtures
  `supabase/tests/eh116_registry_reprocess_batches.sql` covering RLS
  denials, append-only rejection of DELETE and non-outcome UPDATE,
  digest-drift abort, idempotent re-apply, manual-decision override
  path, and instrumental exclusion.

## 2. Batch service

- [x] 2.1 Add `src/lib/registry-reprocessing/types.ts` with the
  `ReprocessBatchScope`, `ReprocessBatchFilters`,
  `ReprocessBatchInputs`, `ReprocessBatchRowDiff`,
  `ReprocessDiffClassification`, and `ReprocessBatchSummary` types.
- [x] 2.2 Add `captureDeployedRelease()` in the same module that
  returns catalog manifest version, digest, resolver version,
  normalization version, and compatibility policy version from the
  runtime constants.
- [x] 2.3 Add `selectExtractedRowsForReprocessBatch(scope, filters,
  limit)` that queries `document_extracted_biomarkers` joined with
  `observations` and `observation_normalization_revisions` (active
  only), enforces `observation_kind = 'lab'`, applies the
  resolver-result filter (defaulting to the four outcomes), and skips
  or flags manual-decision revisions.
- [x] 2.4 Add `computeReprocessBatchDiff(row, activeRevision)` that
  resolves the current runtime resolution, builds the persisted
  decision trace with `buildPersistedResolverDecisionTrace`, computes
  the mapping change classification, and produces the deterministic
  diff record.
- [x] 2.5 Add `openReprocessBatch(inputs)` and
  `recordReprocessBatchRow(batchId, diff)` that call the
  service-only RPCs and never write to `observation_normalization_revisions`
  or `observations` directly.
- [x] 2.6 Add `applyReprocessBatch(batchId, actorId)` that calls the
  digest-drift-guarded `registry_reprocess_apply_batch` RPC, iterates
  the returned pending rows, invokes
  `writeExtractedBiomarkerNormalization` per row with the correct
  write kind (correction for manual-decision override, acceptance for
  everything else), and records the outcome through
  `registry_reprocess_finish_row`.
- [x] 2.7 Add `finalizeReprocessBatch(batchId)` that calls
  `registry_reprocess_finish_batch` and returns a
  `ReprocessBatchSummary` with per-classification counters.

## 3. Admin CLI

- [x] 3.1 Add `scripts/reprocess-batch.ts` that parses one of
  `--document|--profile|--global`, requires `--dry-run` or `--apply`,
  reads `--batch-limit`, optional `--max-documents`,
  `--resolver-result`, `--include-manual-decisions --reason`,
  `--actor-id` (default `EH116_ACTOR_ID` env), and prints a stable
  JSON envelope to stdout.
- [x] 3.2 Add global-scope safeguards: refuse `--global` without
  `EH116_CONFIRM_GLOBAL=yes` or an interactive TTY prompt, enforce
  `--batch-limit`, and default `--max-documents` guidance.
- [x] 3.3 Wire the CLI to the batch service so a dry-run opens a
  batch, records rows, and finalizes the dry-run summary; and
  `--apply` reuses an existing batch id via `--batch <uuid>` or
  chains dry-run then apply when `--apply-after-dry-run` is set.
- [x] 3.4 Register `pnpm reprocess:batch` in `package.json` as a
  convenience script that forwards arguments to
  `tsx scripts/reprocess-batch.ts`.

## 4. Static and unit verification

- [x] 4.1 Add `scripts/verify-eh116-reprocess-batch.ts` that:
  fails if any code path outside
  `src/lib/registry-reprocessing/` or
  `openspec/changes/eh-116-*/` imports the batch tables directly,
  fails if any file adds a second observation revision writer or
  bypasses `writeExtractedBiomarkerNormalization`, and asserts the
  CLI’s scope/override guard-rail flow through pure-function tests.
- [x] 4.2 Add deterministic diff computation tests: fixtures for
  `unchanged`, `improved_resolution`, `regressed_resolution`,
  `identity_changed`, `manual_selection_lost`,
  `skipped_manual_decision`, `skipped_manual_correction`, and
  `needs_review`.
- [x] 4.3 Add release-capture tests confirming the batch payload
  matches `MEASUREMENT_CATALOG_MANIFEST_RELEASE` and that a mocked
  digest drift is rejected before any writer call.
- [x] 4.4 Register `test:eh116` in `package.json` as
  `tsx scripts/verify-eh116-reprocess-batch.ts` and, when a local
  Supabase is available, `test:eh116-db` as
  `supabase test db --local supabase/tests/eh116_registry_reprocess_batches.sql`.

## 5. QA checklist and evidence

- [x] 5.1 Create `QA/eh-116/checklist.md` with a manual product
  section (per-document happy-path dry-run/apply, manual-decision
  skip, override with reason, digest-drift rehearsal) and a
  developer-evidence section (audit-table queries, pgTAP output,
  static verifier output, CLI JSON envelope).
- [x] 5.2 Record `openspec validate
  eh-116-safe-registry-2-observation-reprocessing --strict` output in
  the QA checklist under evidence and re-run before archiving.
- [x] 5.3 Note explicit exclusions from EH-116 in the checklist:
  future HTTP admin endpoint, catalog release registry, instrumental
  reprocess, cross-batch merging, and post-apply Reports/trends
  invalidation triggers.

## 6. Validate

- [x] 6.1 Run `openspec validate
  eh-116-safe-registry-2-observation-reprocessing --strict`.
- [x] 6.2 Run `pnpm typecheck`.
- [x] 6.3 Run `pnpm test:eh116` and record the output in the QA
  checklist evidence section.
- [x] 6.4 Confirm that no new HTTP endpoint under `/api/admin/` was
  introduced by this change and that the user-facing
  `/api/documents/[id]/reprocess` endpoint is untouched.
