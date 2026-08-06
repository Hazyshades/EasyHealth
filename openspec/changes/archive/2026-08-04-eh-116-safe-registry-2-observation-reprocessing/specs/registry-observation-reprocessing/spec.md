## ADDED Requirements

### Requirement: Deterministic dry-run and batch audit

The system SHALL expose a service-role batch trigger that captures a
snapshot of the deployed Registry 2.0 release (catalog manifest
version, catalog manifest digest, resolver version, normalization
version, and compatibility policy version) and computes a
deterministic per-row diff between each selected extracted laboratory
row’s current active normalization revision and the resolution the
runtime would produce for the same input. The batch and its rows SHALL
be persisted append-only in `registry_reprocess_batches` and
`registry_reprocess_batch_rows`; the tables SHALL be service-role only
and unreadable by `anon`, `authenticated`, or `public`.

Every batch row SHALL carry: the extracted-row identifier; a prior
snapshot with the active revision id, resolver result, measurement
definition key, verification status, mapping confidence band, and
input evidence hash; a next snapshot with the resolver result, next
measurement definition key, next mapping confidence band, next input
evidence hash, and mapping change classification; the persisted
resolver decision trace exactly as
`buildPersistedResolverDecisionTrace` would emit it; and one of the
enumerated diff classifications
(`unchanged`, `improved_resolution`, `regressed_resolution`,
`identity_changed`, `manual_selection_lost`,
`skipped_manual_decision`, `skipped_manual_correction`, `needs_review`,
`writer_error`).

Reprocessing SHALL be restricted to laboratory extracted rows.
Instrumental measures SHALL NOT enter the batch.

#### Scenario: Identical inputs produce identical batch rows
- **WHEN** a batch is dry-run twice with the same primary selector,
  filter, deployed catalog manifest digest, and extracted row content
- **THEN** the two dry-runs SHALL produce the same per-row diff
  classifications, the same next `input_evidence_hash`, and the same
  canonical `resolver_decision_trace` for every row

#### Scenario: Batch tables are service-role only
- **WHEN** an `anon` or `authenticated` role queries
  `registry_reprocess_batches` or `registry_reprocess_batch_rows`
- **THEN** the query SHALL return no rows and any RPC on those tables
  SHALL be denied

#### Scenario: Instrumental observations are excluded
- **WHEN** the CLI targets a document that contains instrumental
  measures
- **THEN** the batch SHALL persist only laboratory extracted rows and
  SHALL exclude every row without a laboratory source or lineage

### Requirement: Digest-bound apply

Apply SHALL be a separate step and SHALL be denied unless the runtime
`MEASUREMENT_CATALOG_MANIFEST_RELEASE.manifestDigest` at the moment of
apply is identical to the digest captured on the batch at dry-run. The
service-only RPC `registry_reprocess_apply_batch(p_batch_id uuid,
p_current_catalog_manifest_digest text, p_actor_id uuid)` SHALL be the
sole authority for that comparison. On drift, the RPC SHALL set the
batch state to `aborted`, record `abort_reason =
catalog_manifest_drift`, return the reason, and SHALL NOT invoke the
normalization writer for any row.

Apply SHALL invoke the existing
`writeExtractedBiomarkerNormalization` per selected batch row and
SHALL NOT introduce a second observation or revision writer. A batch
that has already reached state `applied`, `applied_with_errors`, or
`aborted` SHALL be a no-op on re-apply and SHALL report the recorded
summary.

#### Scenario: Digest drift between dry-run and apply
- **WHEN** the catalog manifest digest recorded at dry-run differs
  from the deployed runtime digest at apply
- **THEN** the RPC SHALL abort the batch with
  `catalog_manifest_drift` and no normalization revision or
  observation SHALL be written

#### Scenario: Apply uses the existing atomic writer
- **WHEN** an operator applies a batch whose digest matches
- **THEN** every materialization SHALL go through
  `writeExtractedBiomarkerNormalization` and each new revision SHALL
  be created by `write_observation_normalization_revision_v2` inside
  its own transaction

#### Scenario: Re-apply is idempotent
- **WHEN** `--apply` is invoked twice for the same batch id
- **THEN** the second invocation SHALL not create additional
  revisions and SHALL report the batch’s existing summary

### Requirement: Manual-decision protection with explicit override

The batch SHALL by default exclude every active revision whose
`verification_status` is `user_verified` or `manually_corrected` and
SHALL mark any row it does include but rejects for that reason as
`skipped_manual_decision`.

An explicit `--include-manual-decisions --reason "<non-empty>"`
override SHALL be required to include manual-decision rows in a
batch. Overridden rows SHALL be persisted with an override marker,
their prior verified snapshot, and the operator reason; on apply they
SHALL be written through the correction path
(`writeKind = "correction"`,
`mappingChangeClassification = "review_required"`,
`correctionReason` = the operator reason) so the row SHALL NOT be
auto-promoted and SHALL NOT be recorded as a system decision that
silently overwrites the human decision. The prior verified snapshot
SHALL remain immutable in the batch row for audit.

#### Scenario: Default skips manual decisions
- **WHEN** an operator runs a batch without
  `--include-manual-decisions` over a row whose active revision is
  `user_verified`
- **THEN** the batch row SHALL be classified
  `skipped_manual_decision` and the row SHALL NOT be applied

#### Scenario: Override goes through correction path
- **WHEN** an operator runs
  `--include-manual-decisions --reason "corrected specimen catalog"`
  over a `manually_corrected` row and applies
- **THEN** the new revision SHALL be created with
  `verification_status = "pending"`,
  `mapping_change_classification = "review_required"`, and the
  operator reason SHALL be persisted on the batch row and used as the
  writer’s `correction_reason`

#### Scenario: Override requires a reason
- **WHEN** the CLI is invoked with `--include-manual-decisions` but
  without a non-empty `--reason "…"`
- **THEN** the CLI SHALL exit with a usage error before any database
  access

### Requirement: Scope selectors and batch limits

Exactly one primary selector SHALL be required for every batch:
`--document <uuid>`, `--profile <uuid>`, or `--global`. A required
`--batch-limit <N>` SHALL be applied as a hard row limit at
selection. `--global` SHALL additionally require either an
interactive terminal confirmation or the environment variable
`EH116_CONFIRM_GLOBAL=yes`. `--max-documents <N>` MAY further cap the
number of distinct documents in a `--global` batch.

An optional `--resolver-result <list>` SHALL default to
`resolved,partial,ambiguous,unmapped`. The batch SHALL apply that
filter to the current active revision resolver result. Rows without
an active revision SHALL be treated as `unmapped` for filtering.

#### Scenario: Missing primary selector is rejected
- **WHEN** the CLI is invoked with none of `--document`,
  `--profile`, `--global`
- **THEN** the CLI SHALL exit with a usage error before any database
  access

#### Scenario: Global without confirmation is rejected
- **WHEN** `--global` is invoked without
  `EH116_CONFIRM_GLOBAL=yes` and without an interactive TTY
- **THEN** the CLI SHALL exit with a confirmation error and SHALL NOT
  write to `registry_reprocess_batches`

#### Scenario: Resolver-result filter defaults to all four outcomes
- **WHEN** no `--resolver-result` is provided
- **THEN** the batch SHALL include rows whose active resolver result
  is `resolved`, `partial`, `ambiguous`, or `unmapped`

### Requirement: Append-only candidate revisions

`registry_reprocess_batch_rows` SHALL be append-only. The database
SHALL reject any direct `DELETE` on the table and SHALL allow at most
one write per row that records apply outcome (materialized revision
id, apply state, error code) through the service-only RPCs
`registry_reprocess_apply_batch` and `registry_reprocess_finish_row`.
Any other `UPDATE` or `INSERT` after the initial dry-run write SHALL
be rejected.

A materialized normalization revision SHALL be created only through
the existing `write_observation_normalization_revision_v2` atomic
writer. The reprocess capability SHALL NOT introduce a second writer
family, a candidate-revision column on
`observation_normalization_revisions`, or an `is_active = false`
staging state on that table.

#### Scenario: Direct DELETE is rejected
- **WHEN** a service-role query attempts to `DELETE` from
  `registry_reprocess_batch_rows`
- **THEN** the database SHALL reject the statement with a stable
  append-only error

#### Scenario: Non-outcome UPDATE is rejected
- **WHEN** an UPDATE targets any column of
  `registry_reprocess_batch_rows` other than the apply-outcome
  columns
- **THEN** the database SHALL reject the statement

### Requirement: Audit trail and CLI observability

The CLI SHALL write structured JSON to stdout containing at least:
batch id, deployed release identifiers, primary selector, filter,
`--include-manual-decisions` flag, actor id, requested_at, per-diff
classification counters, and (on apply) writer-error summary. It
SHALL NOT print raw extracted values, raw labels, raw units, raw
reference ranges, source text, section context, neighbouring labels,
document filenames, patient identifiers, or free-form correction
reasons beyond what the operator supplied.

Aggregate counters and diff classifications for each batch SHALL be
recoverable from `registry_reprocess_batches` alone, without joining
raw laboratory data.

#### Scenario: CLI output contains no PHI
- **WHEN** a dry-run or apply runs against real laboratory data
- **THEN** the CLI JSON output SHALL contain no raw labels, values,
  units, reference ranges, source text, or patient identifiers

#### Scenario: Audit table reports summary
- **WHEN** the batch reaches state `dry_run`, `applied`,
  `applied_with_errors`, or `aborted`
- **THEN** its counters SHALL sum to the count of rows in
  `registry_reprocess_batch_rows` for the same batch and its recorded
  state SHALL match the outcome
