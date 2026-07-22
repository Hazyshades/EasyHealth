## ADDED Requirements

### Requirement: List documents endpoint

The system SHALL expose `GET /api/documents` returning documents for the authenticated user's profile.

#### Scenario: Authenticated list request

- **WHEN** an authenticated user sends `GET /api/documents`
- **THEN** the response status is 200
- **AND** the body contains a `documents` array ordered by `created_at` descending

#### Scenario: Unauthenticated list request

- **WHEN** a request without a valid session sends `GET /api/documents`
- **THEN** the response status is 401

### Requirement: Filter documents by type

The list endpoint SHALL accept an optional `type` query parameter filtering by `document_type`.

#### Scenario: Filter lab documents

- **WHEN** an authenticated user sends `GET /api/documents?type=lab`
- **THEN** only documents with `document_type` equal to `lab` are returned

### Requirement: Document type on upload

The upload handler SHALL persist `document_type` on new document rows, defaulting to `lab` when not specified.

#### Scenario: Lab upload without type parameter

- **WHEN** a paid upload completes successfully without a `document_type` field
- **THEN** the created document row has `document_type` set to `lab`

#### Scenario: Upload with explicit document type

- **WHEN** a paid upload includes `document_type=consultation` in the form data
- **THEN** the created document row stores `document_type` as `consultation`

### Requirement: Document type database constraint

The database SHALL restrict `document_type` to `lab`, `imaging`, `consultation`, or `dicom`.

#### Scenario: Invalid document type rejected

- **WHEN** an insert or update sets `document_type` to an unsupported value
- **THEN** the database rejects the operation
