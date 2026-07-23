## ADDED Requirements

### Requirement: Document processing respects deletion generation

Enqueue, claim, extraction persistence, storage-write registration, publication preparation, and finalization MUST validate that the document is active and use its current write generation. No processing transition may revive or complete a tombstoned document.

#### Scenario: Reprocess races deletion

- **WHEN** reprocess and owner deletion target the same document concurrently
- **THEN** document locking serializes them
- **AND** once deletion commits, no queued/processing job can publish or return the document to an active state

#### Scenario: Prepared publication exists at tombstone

- **WHEN** a document enters `deleting` with an inactive prepared publication
- **THEN** finalization is permanently fenced
- **AND** final deletion purges the prepared content according to the deletion retention contract

### Requirement: Job cancellation distinguishes request from quiescence

Tombstone SHALL cancel queued jobs and mark active jobs `cancellation_requested`, but cleanup MUST treat cancellation as incomplete until the worker lease and storage-write intents are released, expired, or recovered.

#### Scenario: Active worker acknowledges cancellation

- **WHEN** the worker observes a generation mismatch or cancellation request
- **THEN** it stops new work, records/reconciles outstanding storage intents, and releases its lease

#### Scenario: Active worker does not acknowledge

- **WHEN** the worker is crashed or unreachable
- **THEN** cleanup waits for bounded lease/request expiry and takeover before storage verification

### Requirement: Storage artifacts are generation scoped

All new document-processing artifacts SHALL be written under a server-generated document generation/lease scope or otherwise carry an authoritative registered path that deletion can enumerate. A worker MUST NOT choose an unregistered arbitrary path.

#### Scenario: Document is reprocessed before later deletion

- **WHEN** multiple write generations have produced artifacts
- **THEN** deletion cleanup enumerates and purges every generation rather than only the latest prefix
