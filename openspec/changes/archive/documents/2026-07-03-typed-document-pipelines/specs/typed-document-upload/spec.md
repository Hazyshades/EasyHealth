## ADDED Requirements

### Requirement: Explicit document type on upload

The upload flow SHALL require the user to select one of `lab_result`, `instrumental_report`, or `consultation_note` before file submission. The selected value SHALL be sent as `document_type` in the upload form data.

#### Scenario: User uploads instrumental report

- **WHEN** a signed-in user opens `/app/upload?type=instrumental_report` and submits a paid PDF upload
- **THEN** the created document row has `document_type` equal to `instrumental_report`
- **AND** a processing job is enqueued

#### Scenario: User uploads consultation note

- **WHEN** a signed-in user opens `/app/upload?type=consultation_note` and submits a paid image upload
- **THEN** the created document row has `document_type` equal to `consultation_note`

### Requirement: File kind at ingest

The upload handler SHALL set `file_kind` on new documents to `pdf` or `image` based on mime type or file extension, defaulting to `unknown` when unrecognized.

#### Scenario: PDF upload file kind

- **WHEN** a user uploads `application/pdf`
- **THEN** `file_kind` is stored as `pdf`

#### Scenario: Image upload file kind

- **WHEN** a user uploads `image/png` or `image/jpeg`
- **THEN** `file_kind` is stored as `image`

### Requirement: Per-type upload pages

The system SHALL provide upload entry points for lab results, imaging studies, and consultations with English type-specific titles and helper copy.

#### Scenario: Lab upload page

- **WHEN** a user opens `/app/upload?type=lab_result`
- **THEN** the page title and helper text describe laboratory results upload

#### Scenario: Imaging upload page

- **WHEN** a user opens `/app/upload?type=instrumental_report`
- **THEN** the page title and helper text describe imaging or instrumental study reports (e.g. ultrasound, X-ray, CT, MRI, ECG)

### Requirement: DICOM upload blocked

The system SHALL NOT accept uploads with `document_type` of `dicom` in this change.

#### Scenario: DICOM upload rejected

- **WHEN** a client attempts upload with `document_type=dicom`
- **THEN** the API returns HTTP 400 with an English message that DICOM upload is not available yet

### Requirement: Supported file formats unchanged

Uploads SHALL continue to accept PDF, JPEG, and PNG up to 10 MB for all active document types.

#### Scenario: Unsupported format rejected

- **WHEN** a user uploads an unsupported file type for any active document type
- **THEN** the API returns HTTP 400 with an English error message
