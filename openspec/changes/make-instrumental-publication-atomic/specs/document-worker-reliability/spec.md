## ADDED Requirements

### Requirement: Job claim creates the authoritative processing attempt

Job claim MUST be one database transaction that locks an eligible job/document, creates a unique retained processing attempt with the current document write generation, marks the job processing, and returns `processing_attempt_id`. A client-side select-then-update sequence SHALL NOT be authoritative.

#### Scenario: Two workers claim one job

- **WHEN** two sessions concurrently claim the same queued job
- **THEN** exactly one active processing attempt is created
- **AND** only that attempt can prepare or finalize publication

#### Scenario: Failed work is retried

- **WHEN** an attempt becomes terminal and the job is eligible for retry
- **THEN** the next claim creates a new processing attempt id
- **AND** the new attempt may reuse exact immutable content without inheriting the old attempt's publication authority

### Requirement: Instrumental finalization uses deterministic ownership and lock order

Prepare and finalize RPCs MUST validate document, profile, job, processing-attempt id, and captured write generation internally and SHALL lock document, active job, active attempt, current pointer, target preparation, content children, and synthesis in the documented deterministic order.

#### Scenario: Prepared publication belongs to another document

- **WHEN** a service caller attempts to finalize a prepared publication under a different document, profile, job, or attempt
- **THEN** the database rejects the call before any state transition

#### Scenario: Two sessions finalize concurrently

- **WHEN** two database sessions attempt to finalize competing publications for one document
- **THEN** document-first locking serializes them
- **AND** at most one eligible publication becomes current
- **AND** the stale session fails or returns the already committed idempotent result

### Requirement: Every finalizer step rolls back atomically

The integration suite MUST inject failure after each finalizer mutation, including prior supersession, target activation, current-pointer update, compatibility projection update, summary write, document completion, job/attempt completion, and synthesis invalidation. Every injected failure SHALL leave the prior current publication and pre-finalization document/job/attempt state intact.

#### Scenario: Job completion write fails

- **WHEN** the finalizer fails after document fields were tentatively updated but before job and attempt completion commit
- **THEN** the transaction rolls back all publication and completion writes
- **AND** retry with the same eligible preparation can succeed exactly once

#### Scenario: Synthesis invalidation fails

- **WHEN** synthesis invalidation is forced to fail inside finalization
- **THEN** no new current publication, summary, completed document, completed job, or completed attempt is visible

### Requirement: Stale processing attempts cannot publish

A prepare/finalizer call MUST validate the active `processing_attempt_id` and captured document write generation at commit time. Failed, cancelled, expired, superseded, or deletion-fenced attempts SHALL NOT publish. Durable deletion SHALL extend this same attempt with lease-token validation rather than introducing another attempt identity.

#### Scenario: Worker resumes after its attempt is reclaimed

- **WHEN** a stale worker calls prepare or finalize after another attempt owns the job/document
- **THEN** its call is rejected
- **AND** the current publication remains unchanged

### Requirement: Orphan prepared publications are cleaned safely

Cleanup MAY mark a prepared publication abandoned only after its processing attempt is terminal and no finalizer can still own it. After durable deletion adds lease expiry, expiry is additional eligibility evidence but deterministic lock/state validation remains mandatory. Cleanup MUST be idempotent and MUST retain immutable content referenced by current, superseded, or audit history.

#### Scenario: Cleanup races finalization

- **WHEN** cleanup and finalization target the same prepared publication from two sessions
- **THEN** deterministic locking permits exactly one valid terminal transition
- **AND** a current publication is never changed to abandoned

### Requirement: Publication RPCs are service-only

Claim, prepare, finalize, attempt-transition, migration-reset, and cleanup functions MUST use fixed search paths and explicit ownership checks. `PUBLIC`, `anon`, and `authenticated` MUST have no execution or direct state-mutation grants.

#### Scenario: Authenticated role calls finalizer

- **WHEN** an authenticated client invokes the finalizer directly
- **THEN** permission is denied and no rows change
