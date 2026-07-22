## ADDED Requirements

### Requirement: Post-upload content classification

The document processing worker SHALL classify document content into a detected document type after shared preview and OCR, before type-specific extraction.

#### Scenario: Classification runs for every job

- **WHEN** a `full_pipeline` job processes a PDF or image document
- **THEN** the worker invokes a lightweight classification step
- **AND** stores `detected_document_type` on the document row

### Requirement: Type mismatch detection

The system SHALL flag a type mismatch when `detected_document_type` differs from user-selected `document_type` and classification confidence is at least 0.7.

#### Scenario: H&P uploaded as lab

- **WHEN** a user uploads a History and Physical document as `lab_result`
- **AND** classification detects `consultation_note` with confidence ≥ 0.7
- **THEN** `type_mismatch_warning` is set to true on the document
- **AND** `type_mismatch_reason` contains a brief English explanation

#### Scenario: Matching types

- **WHEN** user-selected `document_type` matches `detected_document_type`
- **THEN** `type_mismatch_warning` is false

### Requirement: Mismatch warning in document viewer

The document viewer SHALL display a non-blocking warning banner when `type_mismatch_warning` is true, showing the suggested type in plain English.

#### Scenario: Banner with suggested type

- **WHEN** a user opens a document with `type_mismatch_warning` true
- **THEN** an amber banner explains the likely correct document type
- **AND** offers actions to reprocess with the suggested type or dismiss the warning

### Requirement: Reprocess with corrected type

The reprocess flow SHALL accept an optional `document_type` override, update the document type, clear mismatch flags, and re-queue extraction without requiring a new paid upload.

#### Scenario: Reprocess as consultation from mismatch banner

- **WHEN** a user clicks reprocess with suggested type `consultation_note`
- **THEN** `documents.document_type` is updated to `consultation_note`
- **AND** prior extraction rows for the document are cleared
- **AND** a new processing job is enqueued

### Requirement: Classification does not auto-change type

The system SHALL NOT change `document_type` without explicit user action.

#### Scenario: Mismatch flagged only

- **WHEN** classification detects a mismatch
- **THEN** extraction still runs using the user-selected type until the user reprocesses with override
