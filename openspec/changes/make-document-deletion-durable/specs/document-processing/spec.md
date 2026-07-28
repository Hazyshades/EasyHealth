## ADDED Requirements

### Requirement: Document processing respects deletion generation

Enqueue, claim, extraction persistence, storage-write registration, publication preparation, and finalization MUST validate that the document is active and use its current write generation. No processing transition may revive or complete a tombstoned document.

#### Scenario: Reprocess races deletion

- **WHEN** reprocess and owner deletion target the same document concurrently
- **THEN** document-first locking serializes them
- **AND** once tombstone commits no queued/processing job can return the document to an active state

#### Scenario: Prepared publication exists at tombstone

- **WHEN** a document enters `deleting` with an inactive prepared instrumental publication
- **THEN** finalization is permanently fenced
- **AND** final deletion purges the prepared publication/content according to the deletion-retention contract

### Requirement: Job cancellation distinguishes request from quiescence

Tombstone SHALL cancel queued jobs and mark active jobs/attempts `cancellation_requested`, but cleanup MUST treat cancellation as incomplete until the shared attempt lease and storage-write intents are released, completed, expired, or safely recovered.

#### Scenario: Active worker acknowledges cancellation

- **WHEN** a lease-aware worker observes cancellation
- **THEN** it stops new work, releases or completes registered intents, records a safe terminal attempt state, and releases its lease

#### Scenario: Active worker does not acknowledge

- **WHEN** the worker is crashed or unreachable
- **THEN** cleanup waits for bounded lease/request expiry and deterministic takeover before storage verification

### Requirement: Storage artifacts are generation-scoped and recoverable

Before uploading, a worker MUST register a server-generated path under the current document generation with processing-attempt id, lease token, operation kind, start time, and bounded deadline. It MUST perform a post-upload fence check and record completion; failed post-check cleanup remains recoverable by deletion.

#### Scenario: Tombstone commits during upload

- **WHEN** an upload started under generation N and deletion increments the document to N+1
- **THEN** the worker cannot commit extraction or publication state
- **AND** the registered generation-N path is included in deletion cleanup even if immediate removal fails

#### Scenario: Worker proposes arbitrary path

- **WHEN** a worker requests an unregistered or client-selected storage path
- **THEN** registration/upload authorization is rejected

### Requirement: Legacy and future storage paths have complete inventory

Generation-0 preflight and cleanup MUST cover all document storage columns, page preview/OCR columns, recursive legacy document prefix objects, and retained path patterns. Future artifact kinds MUST be registered in the storage-write-intent contract and deletion inventory before deployment.

#### Scenario: New artifact kind lacks deletion registration

- **WHEN** a release introduces a persisted document object without a registered path kind and cleanup rule
- **THEN** preflight/contract verification fails and deployment is blocked
