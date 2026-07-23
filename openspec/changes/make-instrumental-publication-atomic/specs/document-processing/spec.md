## MODIFIED Requirements

### Requirement: Processing status lifecycle

The `documents` table SHALL track `processing_status` with values exposed to UI: `processing`, `needs_review`, `ready`, `failed`, plus `processing_error`, `page_count`, `mime_type`, `file_size_bytes`, `processing_version`, and `processed_at`. For instrumental documents, transition to a successful status SHALL commit atomically with publication of the exact prepared instrumental version and completion of the processing job and processing attempt.

#### Scenario: Pipeline completes with biomarkers

- **WHEN** laboratory extraction finishes with one or more biomarkers
- **THEN** `processing_status` is set to `needs_review`

#### Scenario: Instrumental pipeline completes

- **WHEN** summary generation has completed for an exact prepared instrumental publication
- **THEN** one transaction publishes that version, supersedes the prior current publication, writes its summary, completes the document, completes the job and attempt, and invalidates health synthesis

#### Scenario: Pipeline fails

- **WHEN** the worker exhausts retries or any required instrumental finalizer step fails
- **THEN** the attempt follows its guarded retry/failure transition and terminal document failure populates `processing_error`
- **AND** no partially published instrumental version or successful job/attempt status is committed

## ADDED Requirements

### Requirement: Every processing claim has retained attempt identity and generation

The system MUST create one retained `document_processing_attempts` row for every atomic job claim. The attempt MUST identify its job, document, profile, attempt number, captured `documents.write_generation`, state, and claim/terminal timestamps. Existing documents use write generation `0`; reclaimed or retried work receives a new `processing_attempt_id`.

#### Scenario: A queued job is claimed

- **WHEN** the worker atomically claims an eligible job
- **THEN** the database creates and returns one active processing attempt bound to the job/document/profile and current write generation
- **AND** no competing claim can create another active attempt for the same job/document

#### Scenario: A stale worker resumes after reclaim

- **WHEN** a previous attempt calls prepare or finalize after a new attempt owns the job
- **THEN** its `processing_attempt_id` is rejected
- **AND** it cannot mutate publication, document, job, or current-pointer state

### Requirement: Instrumental findings and summary share the publication commit

Instrumental measures, findings, impression, and summary MUST become reader-visible only through one current publication. Summary generation MAY occur outside the database but MUST identify the exact `prepared_snapshot_id`, canonicalization version, snapshot hash, processing attempt, and publication digest it summarizes.

#### Scenario: Summary generation fails

- **WHEN** measures/findings/impression were prepared but summary generation fails
- **THEN** the prepared version remains invisible
- **AND** the previous current publication remains unchanged

#### Scenario: Summary references another prepared version

- **WHEN** finalize receives a summary binding that does not match the locked prepared publication and processing attempt
- **THEN** the transaction is rejected without changing publication, document, job, attempt, or synthesis state

### Requirement: Populated instrumental data migrates before reader cutover

A retained environment MUST pass preflight and create legacy-version content/publication records before readers use the new current-publication pointer. The migration MUST preserve provable current/superseded measure history, attach only provable current findings/summary, establish generation `0`, and MUST NOT fabricate missing historical findings or attempt ownership.

#### Scenario: Existing current snapshot is unambiguous

- **WHEN** one current hash has consistent ownership, observations, and attachable current findings/summary
- **THEN** the migration creates legacy immutable content, publication history, an authoritative current pointer, and generation-0 state

#### Scenario: Existing retained data is ambiguous

- **WHEN** ownership, hash groups, current cardinality, finding attachment, or active job/attempt state cannot be proven
- **THEN** migration/preflight aborts with diagnostics
- **AND** only an explicitly disposable environment may reset and reprocess

### Requirement: Reader cutover preserves current-only behavior

During transition, the system MUST preserve `document_extracted_findings` as a current-only, read-compatible relation and SHALL keep legacy instrumental-measure `is_current` projections equivalent to the authoritative current-publication pointer until every reader uses the new pointer. Old workers MUST be drained before the findings relation changes and MUST NOT write through the compatibility relation.

#### Scenario: Old and new readers coexist

- **WHEN** a new publication is finalized during reader migration
- **THEN** the compatibility findings relation, legacy measure projection, and new pointer expose the same current content in the same commit
- **AND** none exposes prepared, superseded, or abandoned content by default

#### Scenario: Old worker remains active

- **WHEN** deployment inventory finds a worker that writes `document_extracted_findings` directly or uses the legacy replacement RPC
- **THEN** the migration/cutover remains blocked until that worker is drained or terminated
