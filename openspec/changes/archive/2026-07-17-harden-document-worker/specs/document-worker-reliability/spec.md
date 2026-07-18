## ADDED Requirements

### Requirement: Worker liveness is detectable
The system MUST expose document-processing worker liveness so the UI can distinguish a worker that is not running from a slow-but-healthy extraction.

#### Scenario: Worker heartbeat is fresh
- **WHEN** the worker has upserted a heartbeat within the liveness threshold
- **THEN** the system reports the worker as online

#### Scenario: Worker heartbeat is stale or absent
- **WHEN** no worker heartbeat has been recorded within the liveness threshold
- **THEN** the system reports the worker as offline

### Requirement: Stale jobs are reclaimed
The system MUST automatically reclaim jobs stuck in `processing` beyond a maximum age so documents do not hang.

#### Scenario: Job orphaned by a crashed worker
- **WHEN** a job has `status = "processing"` and `started_at` older than the stale threshold
- **THEN** the system requeues it if retry attempts remain, or marks it `failed` with a timeout error if attempts are exhausted

### Requirement: At most one active job per document
The system MUST prevent more than one non-terminal (`queued`/`processing`) job per document.

#### Scenario: Duplicate enqueue is attempted
- **WHEN** an enqueue is requested for a document that already has an active job
- **THEN** the system does not create a duplicate active job (idempotent enqueue)

### Requirement: Job enqueue sets a deterministic retry policy
The system MUST set `attempts` and `max_attempts` when enqueuing a job.

#### Scenario: Full-pipeline job is created
- **WHEN** a full-pipeline job is enqueued
- **THEN** it has `attempts = 0` and a configured `max_attempts`

### Requirement: Reasoning models are not sent unsupported parameters
The extraction pipeline MUST NOT pass `temperature` (or other unsupported parameters) to reasoning models.

#### Scenario: A reasoning model is invoked
- **WHEN** the resolved model for a pipeline stage is a reasoning model
- **THEN** the request omits `temperature` and does not emit an unsupported-parameter warning
