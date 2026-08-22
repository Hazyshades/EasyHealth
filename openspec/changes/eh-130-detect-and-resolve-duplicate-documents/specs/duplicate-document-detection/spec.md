## ADDED Requirements

### Requirement: Persisted exact and metadata duplicate detection

The documents domain SHALL persist a lower-case SHA-256 `content_sha256` for every new original upload and whenever the worker reprocesses an existing document. The value SHALL be either null for an unprocessed legacy row or exactly 64 hexadecimal characters. Detection SHALL compare documents only within the same profile.

A non-null matching hash SHALL create an `exact` duplicate candidate. When hashes do not match, the system SHALL calculate deterministic metadata similarity from normalized filename, file size, MIME type, document type, explicit medical date, and normalized lab/provider name using the versioned weights defined by the implementation. A score of at least `0.70` SHALL create a `metadata` candidate. A candidate SHALL NOT be created from a single filename or from a cross-profile match.

#### Scenario: Exact same file creates a candidate

- **WHEN** an owner uploads a second file whose SHA-256 matches an active document in the same profile
- **THEN** both document rows remain present
- **AND** one canonical candidate row is created with `match_kind = exact`
- **AND** the candidate is `pending`
- **AND** no document is archived or deleted automatically

#### Scenario: Metadata similarity creates a near candidate

- **WHEN** two active same-profile documents have different hashes but their deterministic metadata score is at least `0.70`
- **THEN** one canonical candidate row is created with `match_kind = metadata`
- **AND** the row contains the ordered reason codes and bounded score
- **AND** no raw file bytes, extracted text, or clinical payload is copied into the candidate

#### Scenario: Weak or cross-profile matches do not create candidates

- **WHEN** documents share only a common filename or belong to different profiles
- **THEN** no actionable duplicate candidate is created between them
- **AND** neither profile can read or resolve the other profile's candidate

#### Scenario: Worker metadata completes detection

- **WHEN** a worker reprocesses a legacy document and writes its content hash or explicit metadata
- **THEN** duplicate detection is rerun for that document in the same database write transaction
- **AND** a newly qualifying candidate becomes visible without requiring a second upload

### Requirement: Canonical candidate lifecycle

The system SHALL store at most one candidate for an unordered pair of same-profile documents. Candidate endpoints SHALL expose the pair's document summaries, `match_kind`, `similarity_score`, reason codes, and one of the states `pending`, `kept_both`, `archived_left`, or `archived_right`. Detection MAY refresh match evidence for a pending candidate but SHALL NOT change a resolved state back to pending or create a second directional row.

Creating or refreshing a candidate SHALL emit one non-PHI `detected` audit event for that candidate. Candidate and audit metadata SHALL use identifiers, state/decision codes, scores, and timestamps only; filenames and clinical content remain in the source document tables.

#### Scenario: Repeated detection stays canonical

- **WHEN** upload and worker updates both detect the same unordered document pair
- **THEN** the database retains one candidate row
- **AND** the pair's left/right identifiers remain deterministic
- **AND** the detection audit event is not duplicated

#### Scenario: Pending candidate is owner-visible

- **WHEN** an authenticated owner opens one of the documents in a pending candidate
- **THEN** the document bootstrap includes that pending candidate and the two owner-scoped document summaries
- **AND** a different profile's candidate is not included

### Requirement: Explicit owner resolution and safe archive

The system SHALL expose an owner-authenticated resolution operation accepting exactly `keep_both`, `archive_left`, or `archive_right`. The operation SHALL lock and validate the candidate and both documents, update the candidate state and any archive marker atomically, and be idempotent for a repeated identical decision. A conflicting decision after resolution SHALL fail without changing either document.

Archiving SHALL set `documents.archived_at` and `archive_reason = 'duplicate_document'` for exactly one candidate document. It SHALL NOT delete the document row, original Storage object, derived evidence, or audit event. Archived source documents SHALL be excluded from active Documents, timeline, Health Profile, report-eligibility, structured-context, and Biomarkers projections. Keeping both SHALL leave both documents active.

#### Scenario: Owner keeps both medical events

- **WHEN** the owner chooses `keep_both` for a pending candidate
- **THEN** the candidate becomes `kept_both`
- **AND** neither document receives an archive marker
- **AND** both documents remain in active document and timeline projections
- **AND** one resolution audit event records `keep_both`

#### Scenario: Owner archives one candidate document

- **WHEN** the owner chooses `archive_left` or `archive_right`
- **THEN** the selected document receives the duplicate archive marker
- **AND** the other document remains active
- **AND** the candidate state records which side was archived
- **AND** the selected document is absent from active source projections
- **AND** one resolution audit event records the actor and archived document id

#### Scenario: Resolution retry is idempotent

- **WHEN** the owner repeats the same resolution request after a successful response
- **THEN** the operation returns the stored candidate state and archived document id
- **AND** it does not create another resolution audit event or mutate the other document

#### Scenario: Conflicting resolution cannot overwrite the owner's choice

- **WHEN** a resolved candidate receives a different decision
- **THEN** the API returns a conflict response
- **AND** the candidate state, archive marker, and audit history remain unchanged

#### Scenario: Archive never invokes deletion

- **WHEN** a duplicate candidate is resolved with either archive decision
- **THEN** no database delete and no Storage removal is performed by the duplicate workflow
- **AND** the retained document remains available to the separate retention/deletion lifecycle

### Requirement: Duplicate review interface

The document viewer SHALL present pending duplicate candidates with an exact/near label, concise match evidence, both document summaries, and explicit actions to keep both or archive either side. Archive actions SHALL require an inline confirmation that explains the file is retained but removed from active views. The interface SHALL show loading, error, and completed feedback and SHALL return to the Documents hub if the currently viewed document was archived.

#### Scenario: Exact duplicate review

- **WHEN** a user opens a document with an exact pending candidate
- **THEN** the viewer shows an `Exact duplicate file` warning and the other document's filename/date
- **AND** the user can choose `Keep both` or explicitly archive one side
- **AND** the viewer does not remove either document before the choice

#### Scenario: Different medical events are retained

- **WHEN** two matching uploads represent distinct medical events and the user chooses `Keep both`
- **THEN** the viewer confirms that both documents were retained
- **AND** neither document disappears from the Documents hub or timeline

#### Scenario: Archive feedback is explicit

- **WHEN** the user confirms archiving one side
- **THEN** the viewer reports that the document was archived rather than deleted
- **AND** the archive target is absent from the active Documents hub after refresh
- **AND** a failed request leaves the candidate pending and offers a retry
