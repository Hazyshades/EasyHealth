## MODIFIED Requirements

### Requirement: Document delete clears laboratory lineage through controlled purge

`DELETE /api/documents/:id` SHALL authorize the owner and atomically tombstone the document, fence writes, request cancellation, and enqueue one durable deletion operation. It SHALL return `202 Accepted` with operation status rather than final success. After storage absence is verified, final database purge SHALL remove document-derived laboratory observations/lineage and other derived data in one transaction so no half-linked laboratory observation or partially purged document remains.

#### Scenario: Owner deletes a laboratory document with accepted observations

- **WHEN** an authenticated owner deletes a laboratory document with linked observations and normalization revisions
- **THEN** the API returns `202 Accepted` after durable tombstone/enqueue
- **AND** no new reads, signed URLs, reprocess, or publication finalization are allowed
- **AND** final completion is reported only after storage verification and transactional database purge

#### Scenario: Cleanup failure does not report final success

- **WHEN** storage cleanup, writer quiescence, verification, or database purge fails
- **THEN** the deletion operation remains pending or `retryable_error`
- **AND** the API does not report completed deletion
- **AND** no database transaction commits a partial derived-data purge

#### Scenario: Unauthorized delete remains denied

- **WHEN** a caller without ownership attempts `DELETE /api/documents/:id`
- **THEN** the response is 401 or 403
- **AND** no tombstone or deletion operation is created

## ADDED Requirements

### Requirement: Deletion operation status is owner-scoped

The documents API SHALL expose an owner-authorized status lookup for a deletion operation after tombstone and after document hard purge. It SHALL return lifecycle status and safe timestamps/errors without document content or storage paths.

#### Scenario: Owner polls deletion

- **WHEN** the owner requests the operation id returned by DELETE
- **THEN** the API returns its current queued, waiting, cleaning, retryable, or completed status

#### Scenario: Another profile requests status

- **WHEN** a caller from another profile requests the operation
- **THEN** the API returns 403 or 404 without revealing its existence or document identity

### Requirement: Tombstoned documents are inaccessible

All document list/detail/file/page/thumbnail/reprocess/mutation endpoints MUST exclude or deny documents in `deleting` state, except the deletion-operation status contract.

#### Scenario: File URL is requested after tombstone

- **WHEN** any caller requests a new signed file/page/thumbnail URL for a deleting document
- **THEN** the request is denied or returns not found
- **AND** no signed URL is minted
