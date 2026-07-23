## ADDED Requirements

### Requirement: Instrumental finalization uses deterministic ownership and lock order

Prepare and finalize RPCs MUST validate document, profile, job, and processing-attempt ownership internally and SHALL lock document, active job/attempt, deletion generation, current pointer, target preparation, content children, and synthesis in the documented deterministic order.

#### Scenario: Prepared publication belongs to another document

- **WHEN** a service caller attempts to finalize a prepared publication under a different document, profile, or job
- **THEN** the database rejects the call before any state transition

#### Scenario: Two sessions finalize concurrently

- **WHEN** two database sessions attempt to finalize competing publications for one document
- **THEN** document-first locking serializes them
- **AND** at most one eligible publication becomes current
- **AND** the stale session fails or returns the already committed idempotent result

### Requirement: Every finalizer step rolls back atomically

The integration suite MUST inject failure after each finalizer mutation, including prior supersession, target activation, current-pointer update, structured-content publication, summary write, document completion, job completion, and synthesis invalidation. Every injected failure SHALL leave the prior current publication and pre-finalization document/job state intact.

#### Scenario: Job completion write fails

- **WHEN** the finalizer fails after document fields were tentatively updated but before job completion commits
- **THEN** the transaction rolls back all publication and completion writes
- **AND** retry with the same eligible preparation can succeed exactly once

#### Scenario: Synthesis invalidation fails

- **WHEN** synthesis invalidation is forced to fail inside finalization
- **THEN** no new current publication, summary, completed document, or completed job is visible

### Requirement: Stale processing attempts cannot publish

A finalizer MUST validate the active processing-attempt token and current document generation at commit time. Failed, cancelled, expired, superseded, or deletion-fenced attempts SHALL NOT publish.

#### Scenario: Worker resumes after its attempt is reclaimed

- **WHEN** a stale worker calls finalize after another attempt owns the job/document
- **THEN** its call is rejected
- **AND** the current publication remains unchanged

### Requirement: Orphan prepared publications are cleaned safely

Cleanup MAY mark a prepared publication abandoned only after its processing attempt is terminal or lease-expired and no finalizer can still own it. Cleanup MUST be idempotent and MUST retain immutable content referenced by current, superseded, or audit history.

#### Scenario: Cleanup races finalization

- **WHEN** cleanup and finalization target the same prepared publication from two sessions
- **THEN** deterministic locking permits exactly one valid terminal transition
- **AND** a current publication is never changed to abandoned

### Requirement: Publication RPCs are service-only

Prepare, finalize, migration-reset, and cleanup functions MUST use fixed search paths and explicit ownership checks. `PUBLIC`, `anon`, and `authenticated` MUST have no execution or direct state-mutation grants.

#### Scenario: Authenticated role calls finalizer

- **WHEN** an authenticated client invokes the finalizer directly
- **THEN** permission is denied and no rows change
