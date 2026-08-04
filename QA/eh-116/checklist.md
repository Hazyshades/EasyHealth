# EH-116: Safe Registry 2.0 observation reprocessing

**Roadmap status:** In progress
**Build / environment:** Local Supabase and application development environment
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

EH-116 introduces an operator-triggered, service-role CLI for reprocessing extracted laboratory observations against the deployed Registry 2.0 release. Every batch first runs as a `--dry-run` that records a per-row diff into `registry_reprocess_batches` and `registry_reprocess_batch_rows`; a follow-up `--apply` re-checks the catalog manifest digest and materializes only apply-eligible rows through the existing EH-106 atomic writer. There is no HTTP admin surface in v1: the CLI is the only trigger. See `openspec/changes/eh-116-safe-registry-2-observation-reprocessing/`.

## Before you start

- [ ] Use a dedicated staging environment or disposable local Supabase (never production for this checklist).
- [ ] Use only synthetic or de-identified laboratory documents.
- [ ] Confirm at least one document contains extracted laboratory rows with a mix of `resolved`, `partial`, and `unmapped` outcomes.
- [ ] Set `EH116_ACTOR_ID` to a valid service actor uuid, or pass `--actor-id` explicitly.
- [ ] For the global-scope rehearsal only: export `EH116_CONFIRM_GLOBAL=yes` in the test shell.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH116-DOC-01` | Synthetic laboratory document with a reviewed glucose row, a partial row, and an unmapped row | Per-document happy-path dry-run and apply |
| `EH116-DOC-02` | Synthetic laboratory document with one row whose active revision is `user_verified` (accept it from the review UI first) | Manual-decision protection default-skip |
| `EH116-DOC-03` | Synthetic laboratory document reused from `EH116-DOC-02` after user_verified | Manual-decision override rehearsal |
| `EH116-DIGEST-DRIFT-01` | Any batch created before a catalog rebuild that changes `MEASUREMENT_CATALOG_MANIFEST_RELEASE.manifestDigest` | Digest-drift abort rehearsal |

## Interface checks

### EH116-CLI-01: Per-document dry-run happy path

**Precondition:** `EH116-DOC-01` has at least one `partial` or `unmapped` extracted row.

1. From the repository root run:
   ```
   pnpm reprocess:batch -- --document EH116-DOC-01 --batch-limit 100 --dry-run --actor-id <uuid>
   ```
2. Read the JSON envelope on stdout. Record the returned `batchId`, `state`, `release`, and `counters`.
3. Confirm the JSON output contains no raw labels, raw values, raw units, source text, reference ranges, or patient identifiers.

**Expected result:** `state` equals `dry_run`. `counters.total` matches the number of laboratory rows in the document that pass the resolver-result filter. At least one row is classified `improved_resolution` when the deployed catalog contains alias or unit improvements over the prior active revision.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH116-CLI-02: Apply the reviewed batch

**Precondition:** EH116-CLI-01 completed with `state = dry_run` and produced at least one apply-eligible row (`improved_resolution` or `identity_changed`).

1. Confirm the deployed release digest matches the value recorded on the batch (`counters.release.catalogManifestDigest`).
2. Run:
   ```
   pnpm reprocess:batch -- --batch <batchId from EH116-CLI-01> --apply --actor-id <uuid>
   ```
3. Note the returned `state`, `counters.appliedRevisions`, and `rowCount`.

**Expected result:** `state` equals `applied` (or `applied_with_errors` if the writer surfaces a per-row failure). `appliedRevisions` equals the pre-apply pending-row count. Re-running `--apply` with the same `batchId` prints the same summary and does not create additional revisions.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH116-CLI-03: Manual-decision protection is on by default

**Precondition:** `EH116-DOC-02` has at least one row whose active normalization revision has `verification_status = 'user_verified'`.

1. Run:
   ```
   pnpm reprocess:batch -- --document EH116-DOC-02 --batch-limit 100 --dry-run --actor-id <uuid>
   ```
2. Query the audit trail:
   ```
   select diff_classification, count(*)
   from public.registry_reprocess_batch_rows
   where batch_id = '<batchId>'
   group by 1 order by 1;
   ```

**Expected result:** The verified row is either absent from the batch selection (default filter) or, if present because it also matched other criteria, is recorded as `skipped_manual_decision` with `apply_state = 'skipped'` and a `diff_reason_code` starting with `default_protection_`. No user_verified row is materialized on subsequent `--apply`.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH116-CLI-04: Manual-decision override goes through the correction path

**Precondition:** Same setup as EH116-CLI-03; ensure the override target is intentional.

1. Attempt the override without a reason (should fail):
   ```
   pnpm reprocess:batch -- --document EH116-DOC-03 --batch-limit 100 --dry-run \
     --include-manual-decisions --actor-id <uuid>
   ```
2. Retry with a non-empty reason:
   ```
   pnpm reprocess:batch -- --document EH116-DOC-03 --batch-limit 100 --dry-run \
     --include-manual-decisions --reason "EH116 QA override" --actor-id <uuid>
   ```
3. Apply the batch and inspect the new revision:
   ```
   pnpm reprocess:batch -- --batch <batchId> --apply --actor-id <uuid>

   select verification_status, verification_actor_type, mapping_change_classification
   from public.observation_normalization_revisions
   where id = '<applied_revision_id from apply_state = applied>';
   ```

**Expected result:** Step 1 exits with a non-zero code and the message `--include-manual-decisions requires --reason "<non-empty>"`. Step 2 opens a batch and includes the manually-corrected row with an appropriate classification (`manual_selection_lost` if identity would change, otherwise `improved_resolution`). The applied revision has `verification_status = 'pending'`, `verification_actor_type = 'system'`, and `mapping_change_classification = 'review_required'`. The prior verified snapshot in `registry_reprocess_batch_rows.prior_verification_status` remains `user_verified` or `manually_corrected`.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH116-CLI-05: Catalog manifest digest drift aborts apply

**Precondition:** A `dry_run` batch exists whose `catalog_manifest_digest` differs from the deployed runtime digest. Simulate by opening a batch, then rebuilding the runtime with a catalog change, or by manually mutating `catalog_manifest_digest` in a disposable environment.

1. Attempt to apply:
   ```
   pnpm reprocess:batch -- --batch <batchId> --apply --actor-id <uuid>
   ```
2. Inspect the batch:
   ```
   select state, abort_reason from public.registry_reprocess_batches where id = '<batchId>';
   ```

**Expected result:** The CLI exits non-zero with `catalog_manifest_drift`. `state` transitions to `aborted` with `abort_reason = 'catalog_manifest_drift'`. No new `observation_normalization_revisions` rows are created for the batch.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

### EH116-CLI-06: Global scope refuses to run without confirmation

**Precondition:** No `EH116_CONFIRM_GLOBAL` environment variable in the shell.

1. Run:
   ```
   pnpm reprocess:batch -- --global --batch-limit 10 --max-documents 2 --dry-run --actor-id <uuid>
   ```
2. Export `EH116_CONFIRM_GLOBAL=yes` and rerun.

**Expected result:** Step 1 exits non-zero with a message that names `EH116_CONFIRM_GLOBAL=yes`. Step 2 succeeds and produces a `dry_run` batch with `scope_kind = 'global'`; `candidates_total` is bounded by both `--batch-limit` and, if provided, `--max-documents`.

**Result:** `Pass | Fail | Blocked | N/A`
**Notes / evidence link:** `________`

## Developer evidence required

- [x] `pnpm test:eh116` passes locally (deterministic diff classifier, release capture, default filter, apply-eligible classifications, static writer/HTTP-admin boundary, instrumental exclusion).
- [x] `pnpm exec tsc --noEmit` clean.
- [x] Migration `041_eh116_registry_reprocess_batches.sql` applies cleanly on a full `supabase db reset` (001..041, no errors).
- [x] `supabase/tests/eh116_registry_reprocess_batches.sql` passes **42/42** against a freshly reset local Supabase, covering: function-privilege matrix, append-only DELETE/UPDATE rejection, durable digest-drift abort, matching-digest transition, per-row writer-outcome recording, `applied_with_errors` sealing, idempotent re-apply, settled-row outcome lock, all five header check constraints, table-privilege denial for `anon`/`authenticated`, RLS enablement, and structural instrumental exclusion.
- [x] `openspec validate eh-116-safe-registry-2-observation-reprocessing --strict` returns clean.
- [ ] Deployment owner confirms migration `041_eh116_registry_reprocess_batches.sql` has applied to the target environment before product QA.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and other required env vars are provisioned in the CLI's execution environment; the CLI is only run by a named operator.

## Known local-tooling limitation

`pnpm test:eh116-db` shells out to `supabase test db --local`, which spawns a
separate ephemeral pgTAP container. On Supabase CLI `2.109.0` that step fails
with `LegacyDockerRunError: failed to run docker` even when Docker Desktop is
running and `supabase db reset` works (the reset path talks to the database
over TCP instead). The suite itself is unaffected: it was executed against the
same local database at `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
and passed 42/42.

If you hit the same error, either upgrade the CLI (`npm i -g supabase@latest`,
`2.111.0` or newer was available at the time of writing) or run the file
directly against the local database with any Postgres client after
`create extension if not exists pgtap;`.

## Out of scope or not manually testable yet

- HTTP admin surface (`/api/admin/...`) is intentionally absent in EH-116 v1. A future change introduces a real admin auth-role first.
- In-database catalog release registry and in-prod preview of undeployed catalog: out of scope; the CLI captures the deployed release digest at dry-run.
- Instrumental observation reprocessing: excluded by construction (`observation_kind = 'lab'` filter and the diff-service check).
- Post-apply trends/Health Profile/Reports invalidation triggers: not part of EH-116; readers already project the active revision on the next read.
- Cross-batch merging, partial-apply retry across batches, and row-level operator retry inside an already-applied batch.
