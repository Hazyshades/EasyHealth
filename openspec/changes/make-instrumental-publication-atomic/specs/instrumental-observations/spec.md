## MODIFIED Requirements

### Requirement: Deduplication of instrumental observations

The system SHALL deduplicate immutable instrumental snapshot content by `(document_id, canonicalization_version, snapshot_hash)` only after database-side canonicalization, SHA-256 verification, and exact canonical-payload equality. Publication attempts and current/superseded history SHALL remain separate from deduplicated content.

#### Scenario: Unchanged reprocess reuses content

- **WHEN** a new processing attempt prepares the same document, canonicalization version, hash, and exact payload
- **THEN** the immutable content and its source rows/observations are reused
- **AND** a distinct publication attempt records the new processing lifecycle without mutating old history

#### Scenario: Claimed hash has different payload

- **WHEN** a caller submits a hash that does not match database canonicalization or existing exact payload
- **THEN** preparation fails with a deterministic conflict
- **AND** no content or publication state changes

#### Scenario: Reprocess changes measures or structured findings

- **WHEN** canonical measures, findings, impression, or extraction metadata change
- **THEN** a new immutable content version is prepared
- **AND** the previous current publication remains visible until atomic finalization succeeds

## ADDED Requirements

### Requirement: Snapshot content and publication history are separate

The system MUST store immutable instrumental content separately from publication attempts and the authoritative current-publication pointer. A publication SHALL transition only `prepared → current`, `prepared → abandoned`, or `current → superseded`; superseded and abandoned publications are terminal.

#### Scenario: A payload is republished after an intervening payload

- **WHEN** content A is published, content B supersedes it, and a later processing attempt produces exact content A again
- **THEN** the system creates publication history `A(current→superseded)`, `B(current→superseded)`, `A(current)`
- **AND** both A publications reference the same immutable content

#### Scenario: Abandoned content is retried

- **WHEN** a prepared publication is abandoned and a later eligible attempt produces the same exact content
- **THEN** the abandoned publication remains terminal
- **AND** a new prepared publication references the reusable immutable content

### Requirement: Publication authority belongs to one processing attempt and generation

Every prepared publication MUST reference the retained `processing_attempt_id` that created it and the attempt's captured document write generation. A later attempt may reuse immutable content but MUST create its own publication event; it cannot revive or finalize another attempt's prepared event.

#### Scenario: Retry receives a new attempt

- **WHEN** a failed or reclaimed job is claimed again
- **THEN** the new `processing_attempt_id` may reference matching immutable content
- **AND** the previous attempt's prepared publication remains terminal or cleanup-eligible, not transferable

#### Scenario: Generation differs

- **WHEN** prepare or finalize observes a document generation different from the attempt's captured generation
- **THEN** publication is rejected without changing current content

### Requirement: Same-hash behavior is state-specific and idempotent

The prepare/finalize boundary MUST distinguish same-attempt retry, another live preparation, committed current retry, superseded content, and abandoned publication. Hash equality alone MUST NOT authorize a state transition.

#### Scenario: Same prepared attempt retries

- **WHEN** the same processing attempt retries preparation with exact payload
- **THEN** the same prepared publication id is returned without duplicate rows

#### Scenario: Another live attempt owns the preparation

- **WHEN** a different live attempt prepares the same content while the owning attempt is non-terminal
- **THEN** the request is rejected as concurrent or stale

#### Scenario: Finalizer response is retried

- **WHEN** the committed attempt repeats finalize with the same snapshot and publication/completion digest
- **THEN** the committed publication result is returned without another publication transition

### Requirement: Canonical snapshot hashing is versioned and database verified

Canonicalization SHALL include every persisted immutable measure, finding, impression, and extraction-context field with explicit nulls and deterministic ordering. It SHALL exclude database ids, timestamps, job ids, processing-attempt ids, publication state, and generated summary. The database SHALL compute and verify the authoritative SHA-256 digest.

#### Scenario: Array order differs but occurrences are identical

- **WHEN** the same measures/findings arrive in a different input array order
- **THEN** deterministic source locator and occurrence ordering produces the same canonical payload and hash

#### Scenario: Canonicalization rules change

- **WHEN** serialization or included fields change
- **THEN** a new canonicalization version is required
- **AND** hashes from different versions are never treated as identical content
