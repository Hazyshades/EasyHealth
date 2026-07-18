## MODIFIED Requirements

### Requirement: Document type on upload

The upload handler SHALL persist `document_type` on new document rows. Supported values are `lab_result`, `instrumental_report`, `consultation_note`, `discharge_summary`, `prescription`, and `referral`. When not specified, default is `lab_result`.

#### Scenario: Upload with discharge type

- **WHEN** a paid upload includes `document_type=discharge_summary` in the form data
- **THEN** the created document row stores `document_type` as `discharge_summary`

#### Scenario: Upload with prescription type

- **WHEN** a paid upload includes `document_type=prescription` in the form data
- **THEN** the created document row stores `document_type` as `prescription`

### Requirement: Document type database constraint

The database SHALL restrict `document_type` to `lab_result`, `instrumental_report`, `consultation_note`, `discharge_summary`, `prescription`, `referral`, or `dicom`.

#### Scenario: Invalid document type rejected

- **WHEN** an insert or update sets `document_type` to an unsupported value
- **THEN** the database rejects the operation

## ADDED Requirements

### Requirement: Type mismatch fields on document detail

`GET /api/documents/[id]` SHALL return `detected_document_type`, `type_mismatch_warning`, and `type_mismatch_reason` when present.

#### Scenario: Document detail with mismatch

- **WHEN** a document has `type_mismatch_warning` true
- **THEN** the detail response includes suggested type in `detected_document_type` and explanation in `type_mismatch_reason`

### Requirement: Reprocess with document type override

The reprocess endpoint SHALL accept an optional JSON body field `document_type` to override the stored type before re-queuing the job.

#### Scenario: Reprocess override

- **WHEN** an authenticated user POSTs reprocess with `{ "document_type": "consultation_note" }`
- **THEN** the document type is updated
- **AND** mismatch flags are cleared
- **AND** a new job is enqueued
