## MODIFIED Requirements

### Requirement: Document delete clears laboratory lineage through controlled purge

`DELETE /api/documents/:id` SHALL authorize the owner and atomically tombstone the document, increment the shared write generation, request work cancellation, invalidate persisted derivatives, and enqueue one durable deletion operation. It SHALL return `202 Accepted` with operation id/status rather than final success. After storage absence and writer quiescence are verified, final database purge SHALL directly remove document-derived laboratory observations/lineage and every other derived row in one transaction so no half-linked observation or partially purged document remains.

#### Scenario: Owner deletes a laboratory document with accepted observations

- **WHEN** an authenticated owner deletes a laboratory document with linked observations and normalization revisions
- **THEN** the API returns `202 Accepted` only after durable tombstone/enqueue
- **AND** no new reads, signed URLs, reprocess, or publication finalization are allowed
- **AND** final completion is reported only after storage verification and transactional database purge

#### Scenario: Cleanup fails

- **WHEN** storage cleanup, writer quiescence, verification, or database purge fails
- **THEN** the operation exposes its current queued, waiting, cleaning, retryable, or failed state without exposing PHI
- **AND** the API does not report final success

#### Scenario: Deletion is repeated

- **WHEN** the owner repeats DELETE after tombstone or final purge while the receipt is retained
- **THEN** the API returns the same deletion operation/status and creates no duplicate work

### Requirement: Tombstoned documents are inaccessible

All document list/detail/file/page/thumbnail/reprocess/mutation endpoints MUST exclude or deny documents in `deleting` state. File URL generation MUST revalidate state at mint time.

#### Scenario: File URL is requested after tombstone

- **WHEN** any caller requests a new signed file, page, or thumbnail URL for a deleting document
- **THEN** the request is denied or returns not found
- **AND** no signed URL is minted

#### Scenario: Mutation races tombstone

- **WHEN** a mutation and deletion overlap
- **THEN** document-first locking and generation validation produce one serial outcome
- **AND** no mutation commits against the tombstoned generation

### Requirement: Deletion operation status exposes no PHI

The owner status response MUST include only operation identifier, coarse state, retryability, request/completion timestamps, and a safe error code/message. It MUST NOT expose filename, storage path, extracted data, clinical values, generated narratives, or another profile's existence.

#### Scenario: Operation remains after document purge

- **WHEN** an owner queries a completed retained deletion operation after the document row is gone
- **THEN** the API returns the non-PHI completion receipt
- **AND** document content is unavailable
