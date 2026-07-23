## ADDED Requirements

### Requirement: Deletion begins with an atomic tombstone and authoritative operation

An owner deletion request MUST atomically mark the document `deleting`, increment its write generation, prevent new access/mutations, request cancellation of active work, and insert one authoritative deletion operation/queue row before returning `202 Accepted`.

#### Scenario: Owner requests deletion

- **WHEN** the authenticated owner deletes an active document
- **THEN** the API returns `202 Accepted` with one deletion operation id after the tombstone transaction commits
- **AND** the response does not claim final storage or database purge

#### Scenario: Owner repeats deletion

- **WHEN** the same owner repeats DELETE for a deleting or already purged document with a retained operation
- **THEN** the API returns the existing operation/status
- **AND** no duplicate cleanup operation is created

### Requirement: One operation table is the transactional outbox and queue

The deletion operation SHALL be the sole authoritative queue, retry state, and owner-visible status. Cleanup workers MUST claim it transactionally and MUST NOT rely on a second queue whose delivery or status can diverge.

#### Scenario: Cleanup worker crashes after claim

- **WHEN** a cleanup claim lease expires without completion
- **THEN** another worker can reclaim the same operation from authoritative database state
- **AND** repeated cleanup remains idempotent

### Requirement: Storage cleanup is complete, paginated, and verified

Cleanup MUST remove every registered and listed object under every document generation, follow pagination and nested prefixes, treat not-found as success, and require repeated stable-empty listings after writer quiescence before database hard purge.

#### Scenario: More than one storage page exists

- **WHEN** a document has objects beyond the first list page or in nested prefixes
- **THEN** cleanup traverses every page/prefix and removes every object

#### Scenario: Storage returns an error

- **WHEN** list, remove, or verification fails
- **THEN** the operation becomes `retryable_error` with diagnostics
- **AND** the document remains tombstoned but not reported completed

#### Scenario: Object appears after the first empty listing

- **WHEN** a late in-flight write becomes visible during the stability interval
- **THEN** cleanup returns to storage purge/verification
- **AND** final database purge does not start

### Requirement: Final database purge follows verified storage absence

The cleanup worker MUST start the final database transaction only after stable-empty evidence and writer fencing pass. That transaction MUST hard-purge document-derived data and the document and mark the independent deletion operation completed, or roll back all database purge/completion changes.

#### Scenario: Database purge fails

- **WHEN** any derived-data or document deletion step fails
- **THEN** the database transaction rolls back
- **AND** the operation remains retryable without false completion

### Requirement: Completed deletion retains a non-PHI receipt

The system MUST retain an owner-queryable deletion operation after document hard purge for the configured audit/status retention period. The receipt MUST NOT retain filenames, raw storage paths, extracted text, clinical values, or other PHI.

#### Scenario: Owner checks completed operation

- **WHEN** the document row has been hard-purged
- **THEN** the owner can query the retained operation id and see completion timestamp/status
- **AND** the receipt exposes no document content

### Requirement: Previously issued signed URLs have bounded residual validity

After tombstone the system MUST issue no new signed URLs. A URL issued earlier MAY remain usable until its object is removed or its existing 900-second TTL expires; deletion status MUST remain non-final while required objects still exist.

#### Scenario: Cached URL exists at deletion time

- **WHEN** the owner previously received a signed URL and deletion is accepted
- **THEN** API reads no longer return new URLs
- **AND** cleanup removes the object as soon as fencing permits
- **AND** the product does not claim immediate revocation of the already issued token
