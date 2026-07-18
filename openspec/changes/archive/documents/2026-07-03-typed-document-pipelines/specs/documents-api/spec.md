## MODIFIED Requirements

### Requirement: Filter documents by type

The list endpoint SHALL accept an optional `type` query parameter filtering by `document_type`.

#### Scenario: Filter lab documents

- **WHEN** an authenticated user sends `GET /api/documents?type=lab_result`
- **THEN** only documents with `document_type` equal to `lab_result` are returned

#### Scenario: Filter instrumental documents

- **WHEN** an authenticated user sends `GET /api/documents?type=instrumental_report`
- **THEN** only documents with `document_type` equal to `instrumental_report` are returned

### Requirement: Document type on upload

The upload handler SHALL persist `document_type` on new document rows. Supported values are `lab_result`, `instrumental_report`, and `consultation_note`. When not specified, default is `lab_result`.

#### Scenario: Lab upload without type parameter

- **WHEN** a paid upload completes successfully without a `document_type` field
- **THEN** the created document row has `document_type` set to `lab_result`

#### Scenario: Upload with explicit document type

- **WHEN** a paid upload includes `document_type=consultation_note` in the form data
- **THEN** the created document row stores `document_type` as `consultation_note`

### Requirement: Document type database constraint

The database SHALL restrict `document_type` to `lab_result`, `instrumental_report`, `consultation_note`, or `dicom`.

#### Scenario: Invalid document type rejected

- **WHEN** an insert or update sets `document_type` to an unsupported value
- **THEN** the database rejects the operation

## ADDED Requirements

### Requirement: File kind on document rows

New document rows SHALL include `file_kind` set at upload time.

#### Scenario: Document list includes file kind

- **WHEN** an authenticated user sends `GET /api/documents`
- **THEN** each document entry includes `file_kind` when present

### Requirement: Document summary on detail

`GET /api/documents/[id]` SHALL return `document_summary` when processing completed successfully.

#### Scenario: Summary returned for processed document

- **WHEN** a user requests a document that has `document_summary` populated
- **THEN** the response includes `document_summary` in English
