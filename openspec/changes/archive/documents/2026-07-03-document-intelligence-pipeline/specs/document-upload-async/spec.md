## ADDED Requirements

### Requirement: Async job enqueue on upload

After a successful x402-paid upload, the system SHALL save the original file to storage, create or update the `documents` row, insert a `document_processing_jobs` row with `job_type = 'full_pipeline'` and `status = 'queued'`, and return `{ documentId, processingStatus: 'processing' }` without blocking on extraction.

#### Scenario: New upload enqueues job

- **WHEN** a user completes a paid upload of a valid PDF or image
- **THEN** the file is stored, a job is queued, and the API responds without waiting for worker completion

### Requirement: No auto-upsert on new uploads

The upload handler MUST NOT call `upsertObservations` or write to `observations` directly. Biomarkers enter the health profile only via the accept flow.

#### Scenario: Upload does not create observations

- **WHEN** a new document upload completes and the worker has not yet run
- **THEN** no new `observations` rows exist for that document

### Requirement: Upload validation unchanged

The upload endpoint SHALL continue to validate file type (PDF, JPEG, PNG), max size 10 MB, and require x402 payment before storage work.

#### Scenario: Invalid file rejected

- **WHEN** a user uploads an unsupported file type without payment bypass
- **THEN** the system returns HTTP 400 before enqueueing a job

### Requirement: Client handles async upload response

The upload UI SHALL redirect to `/app/documents` or document detail and show a processing state instead of expecting immediate biomarker results.

#### Scenario: Upload success redirect

- **WHEN** upload API returns `documentId` with processing status
- **THEN** the client shows processing feedback and navigates away from the upload spinner expecting immediate extraction results
