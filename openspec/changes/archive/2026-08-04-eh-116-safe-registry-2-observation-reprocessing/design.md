## Context

The atomic normalization writer
`write_observation_normalization_revision_v2` (migration 033, wrapped by
migration 039 for EH-115 trace validation) already provides the only
supported path for creating an observation normalization revision. It
enforces same-source lineage under `MATCH FULL`, expected-active CAS
via `promote_observation_normalization_revision_v2`, writer-request-hash
idempotency, and EH-115 decision-trace persistence. EH-104 Phase B
(migration 034) makes revisions append-only and revokes direct deletes.

The runtime `MEASUREMENT_CATALOG_MANIFEST_RELEASE`
(`src/lib/biomarkers/measurement-registry-release.ts`) exposes the
current catalog manifest version and digest, resolver version,
normalization version, and compatibility policy version. Every
resolution the writer persists already carries those identifiers on the
row it creates.

The user-facing single-document reprocess
(`POST /api/documents/[id]/reprocess`) enqueues a full pipeline job for
one document and is owned by the extraction worker path. It is not an
operator batch surface and does not compute or persist a diff.

EH-116 needs an operator-triggered, service-role batch surface that
computes a deterministic diff against the currently active revision for
every selected row, stores it as an append-only audit record, and — on
a separate apply step — writes only the reviewed rows through the
existing writer while a digest-drift guard aborts the apply if the
runtime catalog manifest has changed between dry-run and apply.

## Goals / Non-Goals

**Goals**

- One CLI trigger, one service, one audit trail. The CLI writes only to
  `registry_reprocess_batches`, `registry_reprocess_batch_rows`, and —
  via the existing writer — `observation_normalization_revisions`.
- Deterministic per-row diff: identical extracted evidence, identical
  active revision, identical catalog manifest release ⇒ identical
  batch-row payload and identical `input_evidence_hash`, so a re-run
  is a no-op.
- Digest-bound apply: the catalog manifest digest recorded at dry-run
  is validated by the database RPC at apply. Any drift aborts before
  any write.
- Manual-decision protection is on by default: any active revision with
  `verification_status ∈ {user_verified, manually_corrected}` is
  skipped and marked `skipped_manual_decision` in the row payload.
  Override requires `--include-manual-decisions --reason "<text>"`; the
  reason is persisted; the writer still goes through the correction
  path (`writeKind: correction`, `mappingClassification: review_required`),
  never a silent auto-promote.
- Append-only candidate revisions: a `registry_reprocess_batch_rows`
  row is immutable once written. Apply materializes it into a real
  `observation_normalization_revisions` row without mutating the batch
  row (only its outcome fields are updated exactly once).
- Idempotent apply: re-running `--apply` with the same batch ID is a
  no-op once the batch is `applied` or `aborted`.
- No trend or assessment invalidation logic beyond what EH-112 already
  gives us. Health Profile, Biomarkers API, and trends read from the
  active revision projection; when the writer activates a new revision,
  they see it on the next read.

**Non-Goals**

- No HTTP admin endpoint. Any future `/api/admin/…` surface is a
  follow-up change gated on a real admin authentication role.
- No second writer family. Apply goes through
  `writeExtractedBiomarkerNormalization` exactly as user acceptance
  does. Instrumental observations are excluded — they use the EH-105
  materialization RPC and are out of EH-116 scope.
- No in-database catalog release registry, no in-prod preview of an
  undeployed catalog, no historical trace backfill.
- No changes to the EH-115 trace payload, EH-104 Phase B guards,
  EH-106 atomic writer, resolver output, or four-outcome semantics.
- No cross-batch merging or partial-apply retry. A batch either fully
  applies (row by row through the writer, each transactional) or is
  aborted; a partial failure leaves already-written rows in place and
  the batch state records `applied_with_errors`.

## Decisions

### 1. Deployed-release semantics for “chosen Registry 2.0 release”

Q1.A. The chosen release is the deployed runtime release captured from
`MEASUREMENT_CATALOG_MANIFEST_RELEASE` at dry-run:
`catalogManifestVersion`, `manifestDigest`, `resolverVersion`,
`normalizationVersion`, `compatibilityPolicyVersion`. Those five
identifiers are persisted on the batch row.

On apply, the SQL RPC reads the digest passed by the CLI (which is the
value captured at dry-run and stored on the batch), and compares it to
the digest supplied by the same call again — but the CLI takes the
digest from the currently running process, i.e. the deployed release
after any redeploy between the two commands. If the two disagree, the
RPC returns `catalog_manifest_drift` and no writer call happens.

**Alternative rejected.** Storing an approved-catalogs registry in the
database (Q1.B) makes “chosen release” a first-class governance
concept, but is at least a whole change on its own and out of the 5-SP
scope. Staging-only rollout (Q1.C) is an operational practice we still
recommend (see Migration Plan below), but it does not embed the choice
in the audit trail.

### 2. Two-table append-only audit

- `registry_reprocess_batches` holds one row per batch:
  identifier, primary scope (`document|profile|global`), scope value,
  requested `resolver_result` filter, manual-decision override flags,
  actor, requested_at, dry_run_at, applied_at, aborted_at, state,
  counters, deployed release identifiers, and CLI reason.
- `registry_reprocess_batch_rows` holds one row per extracted-row
  candidate: batch reference, extracted-row identifier, prior active
  revision snapshot (id, resolver_result, measurement_definition_key,
  verification_status, mapping_confidence_band, input_evidence_hash),
  next resolution snapshot (result, definition, evidence hash, mapping
  classification), diff classification (`unchanged`,
  `improved_resolution`, `regressed_resolution`, `identity_changed`,
  `manual_selection_lost`, `skipped_manual_decision`,
  `skipped_manual_correction`, `needs_review`, `writer_error`), the
  full persisted `resolver_decision_trace` computed at dry-run,
  materialized revision id (nullable, populated on apply), and error
  code (nullable, populated on apply error).

Both tables have RLS enabled, `service_role`-only policies, and RPC
functions with `security definer`, `search_path = public`, and
explicit `revoke … from public, anon, authenticated`. No client-facing
role can read or write either table.

Batch rows are strictly append-only for the batch service: an
`UPDATE` is allowed by the SQL apply RPC only to record the writer
outcome (materialized revision id, apply state, error) and only for
rows whose apply state is `pending`. A trigger enforces this: any
other `UPDATE` or any `DELETE` raises.

**Alternative rejected.** Storing candidate revisions as
`is_active = false` rows inside
`observation_normalization_revisions` would leak reprocessing state
into the writer table and force a new state axis on `is_active`.
Keeping the audit in its own two tables preserves the single writer
authority and the append-only invariant EH-104 Phase B set.

### 3. Deterministic per-row diff

The diff service reads:

- the extracted row (`document_extracted_biomarkers`),
- the current active revision through `getActiveNormalizationRevision`,
- and computes the next `MeasurementResolution` by calling
  `resolveMeasurementDefinition` on the same `MeasurementResolutionInput`
  the writer would build, using the currently deployed runtime
  release.

It emits a `PersistedResolverDecisionTrace` through the same
`buildPersistedResolverDecisionTrace` builder that the writer uses, so
the trace is byte-for-byte identical to what a live acceptance would
persist. It classifies the diff into one of eight explicit values and
records:

- prior active snapshot,
- next resolution + trace,
- `input_evidence_hash` (prior vs next; equal by construction unless
  extraction changed underneath, which is a `writer_error` at apply
  time),
- diff classification and reason code.

Rows classified `unchanged`, `skipped_manual_decision`, or
`skipped_manual_correction` are never applied.

### 4. Manual-decision protection and override

The selection query excludes revisions whose `verification_status` is
`user_verified` or `manually_corrected` when the override flag is off.
When the override is on, those revisions are included in dry-run and
each such row records `skipped_manual_correction` unless the operator
also explicitly opts in with `--include-manual-decisions`.

On apply of an overridden row, the writer is invoked with:

- `writeKind: "correction"`,
- `mappingClassification: "review_required"`,
- `correctionReason: batch.reason ?? "eh116-manual-decision-override"`.

That path takes the reviewed correction branch of
`writeExtractedBiomarkerNormalization` and never triggers automatic
promotion via `decideAutomaticPromotion` (`manual_decision_protected`
is the current gate; we do not remove or bypass it — we choose the
correction path explicitly).

### 5. Digest-bound apply RPC

`registry_reprocess_apply_batch(p_batch_id uuid,
p_current_catalog_manifest_digest text, p_actor_id uuid)` is called
once per apply and returns `jsonb` of the shape
`{ "status": ..., "rows": [...] }`. It:

1. locks the batch row `for update`;
2. checks state is `dry_run` (or `apply_in_progress` for retry);
3. compares `p_current_catalog_manifest_digest` to the digest recorded
   on the batch;
4. on mismatch: sets `state = aborted`, `abort_reason =
   catalog_manifest_drift`, and **returns** `status =
   catalog_manifest_drift`;
5. on match: sets `state = apply_in_progress` and returns
   `status = ok` plus the `registry_reprocess_batch_rows` that need
   materialization, with their diff classification.

**Drift is returned, never raised.** The first implementation raised
`catalog_manifest_drift` after writing the abort. `RAISE` aborts the
surrounding (sub)transaction, so it rolled back the very `UPDATE` that
recorded the abort: the batch stayed in `dry_run` with a null
`abort_reason` and no audit trace of the refused apply. pgTAP caught
this. Reporting drift as data keeps the abort durable; the batch
service converts `status = catalog_manifest_drift` into a
`RegistryReprocessError` for the CLI, so the operator-visible behavior
is unchanged. A terminal batch (`applied`, `applied_with_errors`,
`aborted`) likewise returns its recorded state with an empty row list,
which is what makes re-apply an idempotent no-op.

The batch service then iterates that list and invokes
`writeExtractedBiomarkerNormalization` per row. After each writer call,
`registry_reprocess_finish_row(p_row_id, p_revision_id, p_error_code)`
records the outcome atomically on the batch row (its own transaction).
When the row list is empty, the service calls
`registry_reprocess_finish_batch(p_batch_id)` which transitions the
state to `applied` or `applied_with_errors`.

**Alternative rejected.** Doing all writer calls inside a single SQL
transaction would nest the atomic writer (which already opens its own
transaction) and complicate error isolation. Keeping each row apply
transactional at the writer level is the same guarantee EH-106 already
provides for a single acceptance.

### 6. Idempotency and re-apply

Because every writer call carries a deterministic
`writer_request_hash` derived from the persisted decision trace and
the actor, re-running `--apply` on a batch that is already `applied`
is a database-level no-op through the existing
`observation_normalization_revisions.writer_request_hash` unique
index. The batch service short-circuits: if state is `applied`,
`applied_with_errors`, or `aborted`, the CLI reports the recorded
summary and exits non-error.

A second `--dry-run` for the same scope is allowed but produces a
new batch id: dry-run is stateless with respect to prior batches.

### 7. Scope selectors

Exactly one primary selector is required:

- `--document <uuid>` — one document, all its extracted rows
  (`observation_kind = 'lab'` only).
- `--profile <uuid>` — one profile, all its lab extracted rows within
  the batch limit.
- `--global` — every profile’s lab extracted rows, capped by
  `--batch-limit` and `--max-documents`, and requires an interactive
  confirmation token (`EH116_CONFIRM_GLOBAL=yes` env or an interactive
  `y` if a TTY is present).

Secondary filter `--resolver-result <list>` defaults to
`resolved,partial,ambiguous,unmapped` (all four; the goal issue
explicitly includes `resolved`). A `--batch-limit <N>` is required
and applied as a hard `LIMIT`. `--max-documents <N>` is optional and
supplements `--global`.

Instrumental observations are excluded **structurally**, not by a
column filter. `document_extracted_biomarkers` is the laboratory
extraction table; instrumental measures live in
`document_extracted_instrumental_measures` (EH-105). The database
constraint `observations_instrumental_lineage_check` (migration 032)
guarantees that an `observation_kind = 'instrumental'` observation has
`source_extracted_biomarker_id IS NULL`, so no instrumental measure can
be reached from the batch's source table. `observation_kind` does not
exist on `document_extracted_biomarkers` at all; the selection service
stamps `'lab'` on each candidate so `computeReprocessBatchDiff` keeps
its defensive guard for hand-built inputs.

### 8. Post-apply invalidation

Health Profile, Biomarkers API, trends, reports, and structured
context all read through the active-revision projection maintained by
`promote_observation_normalization_revision_v2`. When apply activates
a new reviewed revision, the next read sees it. EH-116 does not add
new invalidation code; the reprocess-batch summary records how many
projections were updated so an operator can trigger a targeted
recomputation if they need one (for example, a Reports batch), but
that trigger is out of scope for EH-116 and stays in the roadmap.

## Risks / Trade-offs

- **CLI-only surface.** No web audit view yet. Mitigation: the audit
  tables are queryable through `psql` and structured JSON logs; the
  QA checklist documents the exact query patterns.
- **Global scope is footgun-shaped.** Even with `--batch-limit` and
  `--max-documents`, a large `--global` batch is destructive. Mitigation:
  interactive confirmation via `EH116_CONFIRM_GLOBAL=yes`, mandatory
  `--reason`, and a documented recommendation to run `--dry-run`
  first, review the audit rows in the QA checklist, then apply.
- **Digest binds runtime, not release channel.** A local rebuild that
  regenerates the manifest with the same content will produce the same
  digest, so a digest match is exact-content match. Two independently
  compiled deployments with the same registry are one release. This is
  the intended semantics: content-addressed release identity.
- **Manual-decision override.** Even on the correction path, an
  overridden row supersedes a previously human-verified decision.
  Mitigation: `verification_actor_type` remains `system` on the new
  revision, `mapping_change_classification` is `review_required`, the
  reason is persisted on both the batch and the writer’s request
  hash, and the audit row keeps the prior verified snapshot forever.
- **Instrumental exclusion.** An operator who confuses instrumental
  and laboratory workflows might expect EH-116 to reprocess
  instrumental observations. The CLI rejects any non-lab scope
  explicitly; the QA checklist calls this out.

## Migration Plan

1. Apply migration `041_eh116_registry_reprocess_batches.sql` in a
   disposable environment. Verify the pgTAP fixtures pass.
2. Run the static/integration verifier locally
   (`pnpm test:eh116`) and typecheck.
3. Deploy the migration and the CLI script.
4. Recommended operating pattern:
   - deploy the new catalog to staging,
   - run `pnpm reprocess:batch -- --document <staging-fixture> --dry-run`,
   - review the `registry_reprocess_batch_rows` audit rows against the
     QA checklist,
   - run `--apply` with the same batch id,
   - promote the release to production only after confirming a
     representative staging batch,
   - once in production, repeat dry-run/apply with production data
     scoped tightly (per-document or per-profile) before a global.
5. The `enforce-strict-observation-provenance` change may later
   restrict which writer functions may create revisions. EH-116 uses
   only `writeExtractedBiomarkerNormalization`; any tightening in
   that change automatically covers EH-116.

## Open Questions

None. The three questions previously flagged during exploration are
resolved by the answers embedded in Decisions 1, 5, and 7.
