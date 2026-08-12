# Tasks

## 1. Audit event schema

- [x] 1.1 Add `supabase/migrations/051_eh121_observation_change_history.sql`
      creating the `observation_change_event_kind` enum
      (`observation_accepted`, `mapping_corrected`, `correction_reverted`,
      `verification_changed`, `extraction_superseded`, `reprocess_applied`) and
      the `observation_change_event_origin` enum (`capture`, `backfill`).
- [x] 1.2 Create `public.observation_change_events` with subject columns
      (`profile_id`, `document_id`, `observation_id`, `extracted_biomarker_id`),
      source columns (`source_revision_id`, `source_prior_revision_id`,
      `source_extracted_biomarker_id`, `source_reprocess_row_id`),
      `event_kind`, `origin`, `occurred_at`, `created_at`, and the actor,
      version, and diff columns named in the design.
- [x] 1.3 Add the redaction CHECK constraints: 64-hex regex on
      `prior_input_evidence_hash` and `next_input_evidence_hash`, enum-domain
      checks on both resolver-result and both verification-status columns, and
      an actor-shape check binding `actor_type = 'system'` to a null `actor_id`.
- [x] 1.4 Add the partial unique indexes that make capture idempotent — one per
      `source_revision_id`, one per `source_extracted_biomarker_id` for
      `extraction_superseded`, one per `source_reprocess_row_id` — plus the read
      indexes on `(document_id, occurred_at desc)`,
      `(observation_id, occurred_at desc)` and
      `(extracted_biomarker_id, occurred_at desc)`.
- [x] 1.5 Enable RLS, add the `service_all_observation_change_events` policy,
      `revoke all from public, anon, authenticated`, and grant only
      `select, insert` to `service_role`.
- [x] 1.6 Add `eh121_reject_observation_change_event_mutation()` and the
      `before update or delete` trigger raising
      `observation_change_events_append_only`, allowing only the cascade path.

## 2. Capture triggers

- [x] 2.1 Add `eh121_capture_revision_change()` firing
      `after insert or update on public.observation_normalization_revisions`,
      acting only when the row is active, resolving the predecessor from
      `supersedes_revision_id`, classifying the event kind by the design's
      precedence, and inserting with `on conflict do nothing`.
- [x] 2.2 Resolve the actor inside the trigger as
      `coalesce(verification_actor_id, created_by, promoted_by)` with
      `actor_type` from `verification_actor_type`, defaulting to `system` when
      no profile is attributable.
- [x] 2.3 Add `eh121_capture_extraction_supersession()` firing
      `after update of is_current on public.document_extracted_biomarkers` when
      `is_current` flips true to false, recording the observation bound to that
      extracted row when one exists.
- [x] 2.4 Add `eh121_capture_reprocess_apply()` firing
      `after update on public.registry_reprocess_batch_rows` when `apply_state`
      becomes `applied`, copying the batch row's prior and next columns.
- [x] 2.5 Backfill in the same migration from all three sources, stamping
      `origin = 'backfill'` and the source row's own timestamp as `occurred_at`.
- [x] 2.6 End the migration with `notify pgrst, 'reload schema'`.

## 3. Read model and endpoint

- [x] 3.1 Add `src/lib/documents/observation-change-history.ts` with the
      `ObservationChangeEventRow`, `ObservationChangeFieldDiff`, and
      `ObservationChangeEntry` types and the pure projection
      `buildObservationChangeEntry` / `buildObservationChangeEntries`,
      producing a headline, the changed-axis diff list, an actor label, a
      reason, and version metadata.
- [x] 3.2 Reuse the EH-117 `VERIFICATION_LABELS` copy and the resolver-outcome
      vocabulary so history labels and review chips agree.
- [x] 3.3 Add `src/lib/documents/observation-change-events.ts` reading the
      ledger through `createAdminClient()` with the document, observation,
      extracted-row and limit filters, ordered `occurred_at desc, created_at desc`.
- [x] 3.4 Add `src/app/api/documents/[id]/observation-history/route.ts`
      following the house shape: `getSessionProfileId()` → 401,
      `assertDocumentOwner()` → 404, validated `limit` (default 200, maximum
      500) → 400, `noStoreJson({ entries })` on success.

## 4. Compact review UI

- [x] 4.1 Add
      `src/components/documents/review/observation-change-history-panel.tsx`
      rendering a collapsed `<details>` with the entry count, one compact line
      per entry (kind badge, headline, from → to, actor, relative time, reason),
      and an explicit empty state.
- [x] 4.2 Add the `history?: ReactNode` slot to `ObservationReviewRow` and
      render it after `technicalDetails`.
- [x] 4.3 Fetch the document's history in `DocumentViewer`, index it by
      observation id and extracted-biomarker id, and pass the panel on both the
      `extracted-review` and the `observations-fallback` branch.
- [x] 4.4 Refresh the history after a correction, an undo, and a confirmation so
      the panel reflects the change the reviewer just made.

## 5. Verification

- [x] 5.1 Add `scripts/verify-eh121-observation-change-history.ts` covering the
      event-kind precedence, the complete-diff rule, actor labelling, version
      metadata, redaction of raw text, the empty state, and ordering; register
      it as `test:eh121`.
- [x] 5.2 Extend the same script with source-seam assertions that the migration
      grants no `update`/`delete`, defines the append-only trigger, and that the
      ledger DDL contains no raw-text column name.
- [x] 5.3 Add `supabase/tests/eh121_observation_change_history.sql` (pgTAP)
      asserting the privilege matrix, append-only rejection on update and
      delete, one event per revision under replay, capture of each event kind,
      the hash CHECK, and cascade on document delete; register it as
      `test:eh121-db`.
- [x] 5.4 Run `pnpm typecheck`, `pnpm test:eh121`, and `pnpm test:eh121-db`,
      and record the result. There is no `lint` script in this repository, and
      `pnpm build` fails on a pre-existing `@radix-ui/react-visually-hidden`
      resolution gap unrelated to this change (logged as a papercut).

## 6. QA and Delivery Evidence

- [x] 6.1 Create `QA/eh-121/checklist.md` from `QA/_templates/roadmap-checklist.md`
      with tester-facing preconditions, safe synthetic test data, numbered
      actions, and observable expected results.
- [x] 6.2 Put append-only, redaction, backfill, cascade, and privilege
      assertions under the developer-evidence section, not as UI checks, and do
      not mark unexecuted manual checks as passed.
- [x] 6.3 Run `openspec validate eh-121-add-observation-change-history --strict`
      and record the outcome.
- [x] 6.4 Update GitHub issue #21 and the roadmap status last, after the
      checklist and the verification record exist. Issue checklist ticked,
      delivery evidence posted, project status moved to **In progress**. The
      issue stays open: the work is on a feature branch and the manual
      interface checks have not been executed.
