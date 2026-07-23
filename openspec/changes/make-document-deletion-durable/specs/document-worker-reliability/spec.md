## ADDED Requirements

### Requirement: Processing workers hold generation-fenced leases

A processing worker MUST claim a job with a random lease token, document write generation, expiry, and heartbeat. Every database mutation and finalization MUST validate the active lease token, unchanged generation, and non-deleting document state.

#### Scenario: Deletion tombstones an active document

- **WHEN** deletion increments the document generation while an older worker lease exists
- **THEN** subsequent database writes/finalization from that lease are rejected
- **AND** no new lease or storage-write intent can be created for the old generation

#### Scenario: Stale worker resumes

- **WHEN** a worker resumes after its lease expired or job was reclaimed
- **THEN** its mutation/finalization token is rejected without changing document or publication state

### Requirement: Storage writes are registered and recoverable

Before uploading, a worker MUST register a generation-scoped storage-write intent with lease token, server-generated path, start time, and bounded deadline. It MUST perform a post-upload fence check and record completion; failed post-check cleanup remains recoverable by the deletion worker.

#### Scenario: Tombstone occurs during upload

- **WHEN** upload began under a valid old-generation intent and deletion tombstones the document before upload completes
- **THEN** the worker cannot publish the artifact
- **AND** its registered path remains discoverable for cleanup

#### Scenario: Worker crashes after object creation

- **WHEN** the object exists but the worker did not complete its intent
- **THEN** expiry/takeover logic makes the intent eligible for deletion cleanup

### Requirement: Cleanup waits for writer quiescence

Deletion cleanup MUST NOT declare storage stable until all prior-generation leases are released/expired, all intents are terminal or takeover-eligible, the maximum bounded storage-request interval has passed, and repeated paginated listings remain empty across the stability interval.

#### Scenario: In-flight request may still complete

- **WHEN** the last old-generation lease has just expired but its registered request deadline/quiescence interval has not elapsed
- **THEN** cleanup stays `waiting_for_writers`
- **AND** does not mark storage verified

### Requirement: Legacy unfenced workers are drained before enablement

The deletion API MUST NOT enable tombstone cleanup while any deployed worker can write storage without leases/intents. Rollout SHALL pause job claims, drain or terminate legacy workers, deploy fencing-aware workers, and prove lease behavior before enabling asynchronous deletion.

#### Scenario: Legacy worker inventory is non-empty

- **WHEN** rollout detects an active old worker version
- **THEN** the deletion feature remains disabled
- **AND** production cleanup does not start

### Requirement: Deletion concurrency is verified with real sessions

The database suite MUST use separate concurrent sessions to cover delete versus finalize, cleanup versus storage-intent completion, competing cleanup claims, lease expiry/takeover, and repeated DELETE.

#### Scenario: Delete races atomic finalization

- **WHEN** one session tombstones while another finalizes the same document
- **THEN** document-first locking produces one serial outcome
- **AND** either publication commits before tombstone or deletion fences it completely
- **AND** no mixed completed-and-deleting state commits
