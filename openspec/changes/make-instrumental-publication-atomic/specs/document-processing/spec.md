## MODIFIED Requirements

### Requirement: Processing status lifecycle

The `documents` table SHALL track `processing_status` with values exposed to UI: `processing`, `needs_review`, `ready`, `failed`, plus `processing_error`, `page_count`, `mime_type`, `file_size_bytes`, `processing_version`, and `processed_at`. For instrumental documents, transition to a successful status SHALL commit atomically with publication of the exact prepared instrumental version and completion of the processing job.

#### Scenario: Pipeline completes with biomarkers

- **WHEN** laboratory extraction finishes with one or more biomarkers
- **THEN** `processing_status` is set to `needs_review`

#### Scenario: Instrumental pipeline completes

- **WHEN** summary generation has completed for an exact prepared instrumental publication
- **THEN** one transaction publishes that version, supersedes the prior current publication, writes its summary, completes the document, completes the job, and invalidates health synthesis

#### Scenario: Pipeline fails

- **WHEN** the worker exhausts retries or any required instrumental finalizer step fails
- **THEN** `processing_status` is `failed` and `processing_error` is populated
- **AND** no partially published instrumental version or successful job status is committed

## ADDED Requirements

### Requirement: Instrumental findings and summary share the publication commit

Instrumental measures, findings, impression, and summary MUST become reader-visible only through one current publication. Summary generation MAY occur outside the database but MUST identify the exact `prepared_snapshot_id`, canonicalization version, and snapshot hash it summarizes.

#### Scenario: Summary generation fails

- **WHEN** measures/findings/impression were prepared but summary generation fails
- **THEN** the prepared version remains invisible
- **AND** the previous current publication remains unchanged

#### Scenario: Summary references another prepared version

- **WHEN** finalize receives a summary binding that does not match the locked prepared publication
- **THEN** the transaction is rejected without changing publication, document, job, or synthesis state

### Requirement: Populated instrumental data migrates before reader cutover

A retained environment MUST pass preflight and create legacy-version content/publication records before readers use the new current-publication pointer. The migration MUST preserve provable current/superseded measure history and MUST NOT fabricate missing historical findings.

#### Scenario: Existing current snapshot is unambiguous

- **WHEN** one current hash has consistent ownership, observations, and attachable current findings/summary
- **THEN** the migration creates legacy immutable content, publication history, and an authoritative current pointer

#### Scenario: Existing retained data is ambiguous

- **WHEN** ownership, hash groups, current cardinality, or finding attachment cannot be proven
- **THEN** migration/preflight aborts with diagnostics
- **AND** only an explicitly disposable environment may reset and reprocess

### Requirement: Reader cutover preserves current-only behavior

During transition, the atomic finalizer SHALL keep legacy `is_current` projections equivalent to the authoritative current-publication pointer until every reader uses the new pointer. The legacy replacement RPC SHALL be removed only after equivalence and consumer inventory pass.

#### Scenario: Old and new readers coexist

- **WHEN** a new publication is finalized during reader migration
- **THEN** both reader models expose the same current content in the same commit
- **AND** neither exposes prepared or superseded content by default
