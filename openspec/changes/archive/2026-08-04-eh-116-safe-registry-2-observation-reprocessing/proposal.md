## Why

The Registry 2.0 launch catalog will keep improving after cutover: new
alias approvals, corrected unit policies, expanded compatibility rules,
and additional reviewed definitions. Persisted `partial`, `ambiguous`,
`unmapped`, and even historically `resolved` observations should be able
to benefit from those improvements safely, without rewriting raw
evidence, silently overwriting a human decision, or moving trends and
Health Profile scores before an operator has reviewed the change.

EH-103 fixed provenance metadata, EH-104 Phase B made revisions
append-only under `MATCH FULL` same-source lineage, EH-106 delivered the
service-only atomic normalization writer, EH-109 defined evidence-based
resolution, EH-112 defined the four-outcome contract, and EH-115
persisted a redacted decision trace on every revision. The remaining
gap is a safe **operator-triggered batch reprocessing surface**: a way
to re-run the deployed resolver against selected extracted rows, review
what would change, and apply only what was reviewed — with audit trail,
digest protection, and manual-decision protection.

EH-116 closes that gap with a service-role CLI on top of the existing
writer family. It does not add a second writer, does not backfill
history, and does not activate anything without an explicit apply after
review.

## What Changes

- Add a `registry-observation-reprocessing` capability that defines the
  reprocess batch lifecycle (`dry_run → reviewed → applied|aborted`),
  audit trail schema, deterministic per-row diff, catalog-digest binding,
  scope selectors, and manual-decision protection.
- Add a service-only `registry_reprocess_batches` and
  `registry_reprocess_batch_rows` table pair. Rows are the append-only
  candidate revision records: one immutable diff per extracted row per
  batch, materialized as an actual `observation_normalization_revisions`
  row only on apply.
- Add a service-only SQL RPC `registry_reprocess_apply_batch` that
  rechecks the catalog manifest digest recorded at dry-run against the
  live `MEASUREMENT_CATALOG_MANIFEST_RELEASE` before the writer is
  invoked, so a runtime drift between dry-run and apply aborts the whole
  batch instead of writing partial results.
- Add a batch service under `src/lib/registry-reprocessing/`:
  release capture, selection query with default manual-decision skip,
  deterministic per-row diff computation, and apply orchestration that
  reuses `writeExtractedBiomarkerNormalization` per row — no second
  writer family.
- Add `scripts/reprocess-batch.ts` as the only admin trigger. It takes
  exactly one primary selector (`--document`, `--profile`, or
  `--global`), an optional `--resolver-result` secondary filter, an
  optional `--include-manual-decisions --reason "…"` override, a
  required `--batch-limit`, and a mandatory `--dry-run` or `--apply`
  mode. It writes structured JSON output and its identifier to the audit
  table.
- Add `scripts/verify-eh116-reprocess-batch.ts` static/integration
  verifier plus pgTAP fixtures for authorization, digest guard, scope
  matrix, manual-decision skip, and idempotent re-apply.
- Add `QA/eh-116/checklist.md` with product-visible manual scenarios and
  the separate developer evidence section required by the roadmap QA
  rules.
- **Non-goal:** any HTTP endpoint under `/api/admin/…`. Until an admin
  authentication role exists, the surface is CLI-only.
- **Non-goal:** any in-database catalog release registry, in-prod
  preview of an undeployed catalog, per-row targeted user-facing
  reprocessing, or changes to `MeasurementResolution`, EH-104 Phase B
  guards, EH-106 atomic writer semantics, or EH-115 trace persistence.

## Capabilities

### New Capabilities

- `registry-observation-reprocessing`: Operator-triggered dry-run,
  review, apply, and audit lifecycle for reprocessing extracted
  laboratory observations against the deployed Registry 2.0 release.

### Modified Capabilities

- None. This change consumes the existing
  `context-aware-measurement-resolution`,
  `incomplete-laboratory-outcomes`, and `resolver-decision-trace`
  contracts unchanged.

## Impact

- **Domain:** documents (observation lineage, normalization revisions,
  audit trail). No changes to health-profile, reports, or agent-api
  domains beyond the automatic effect of new revisions becoming active
  after apply.
- **Database:** one additive migration for
  `registry_reprocess_batches` and `registry_reprocess_batch_rows`,
  their RLS/service-role grants, the `registry_reprocess_apply_batch`
  RPC, and the digest-drift guard. No changes to existing tables,
  triggers, or RPCs.
- **Runtime:** new `src/lib/registry-reprocessing/` module; the existing
  user reprocess endpoint (`POST /api/documents/[id]/reprocess`) is
  untouched.
- **CLI/ops:** `scripts/reprocess-batch.ts` requires service-role
  credentials from environment variables, like other maintenance
  scripts (`eh104-phase-b-reset.ts`, `eh105-pr2-reset.ts`). No new
  runtime credentials.
- **Verification:** unit tests for diff computation and manual-decision
  skip; pgTAP fixtures for the batch tables, RLS, digest drift,
  idempotency, and no-drift apply; a static/integration verifier
  registered as `pnpm test:eh116`; `QA/eh-116/checklist.md`.
- **Dependencies satisfied:** EH-103 provenance, EH-104 Phase B
  append-only revisions and `MATCH FULL`, EH-106 atomic writer, EH-109
  resolver evidence, EH-112 four-outcome contract, EH-115 decision
  trace persistence. No blocker on `enforce-strict-observation-provenance`
  or `make-document-deletion-durable`: EH-116 does not introduce a
  second writer family and does not create observations or lineage
  outside the EH-106 writer.
