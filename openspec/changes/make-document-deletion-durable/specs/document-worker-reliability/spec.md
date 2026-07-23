## ADDED Requirements

### Requirement: Processing workers hold generation-fenced leases on shared attempts

Each active processing attempt SHALL use the retained processing-attempt id created by atomic claim and add a random lease token, captured document generation, expiry, and heartbeat. Every database mutation and publication finalization MUST validate the active lease token, unchanged generation, and non-deleting document state.

#### Scenario: Deletion tombstones an active document

- **WHEN** deletion increments the document generation while an older worker lease exists
- **THEN** subsequent database writes/finalization from that lease are rejected
- **AND** no new lease or storage-write intent can be created for the old generation

#### Scenario: Stale worker resumes

- **WHEN** a worker resumes after its lease expired or a new attempt owns the job
- **THEN** its database mutations are rejected
- **AND** any registered object path remains discoverable by cleanup

### Requirement: Storage writes are registered and recoverable

Before uploading, a worker MUST register a generation-scoped storage-write intent with lease token, server-generated path, start time, and bounded request deadline. It MUST perform a post-upload document/lease/generation check and record completion. A failed post-check or crashed request SHALL remain recoverable by the deletion operation.

#### Scenario: Upload finishes after tombstone

- **WHEN** a storage request initiated before tombstone completes afterward
- **THEN** its post-check cannot authorize database publication
- **AND** cleanup discovers and removes the registered path before final completion

#### Scenario: Worker crashes during upload

- **WHEN** the intent remains incomplete past its bounded request/lease deadline
- **THEN** cleanup can claim recovery and purge its path without trusting the dead worker

### Requirement: Legacy workers are drained before deletion enablement

The deletion feature MUST remain disabled while any deployed worker can write storage or finalize database state without shared attempt id, lease token, generation validation, and storage-write intent registration.

#### Scenario: Legacy worker inventory is non-empty

- **WHEN** rollout detects an active old worker version
- **THEN** production cleanup does not start
- **AND** the rollout pauses/drains or terminates that worker before enabling DELETE

### Requirement: Deletion concurrency is verified with real sessions

The database suite MUST use separate concurrent sessions to cover deletion versus finalization, cleanup versus storage-intent completion, competing cleanup claims, lease expiry/takeover, repeated DELETE, and late object appearance.

#### Scenario: Delete races atomic finalization

- **WHEN** one session tombstones while another finalizes the same document
- **THEN** document-first locking produces one serial outcome
- **AND** either publication commits before tombstone or deletion fences it completely
- **AND** no mixed completed-and-deleting state commits

#### Scenario: Cleanup lease holder crashes

- **WHEN** a cleanup worker stops after claiming an operation
- **THEN** another worker can take over only after the bounded lease expires
- **AND** state/evidence guards prevent skipped storage or database steps
